import { Plugin } from "@opencode/plugin"
import { createProviderAdapters } from "./adapters/providers/index.js"
import { createAdapterRegistry } from "./adapters/registry.js"
import { parseUsageConfig, providerEnabled } from "./config.js"
import { Usage } from "./rpc.js"
import { emptySnapshot, type UsageSnapshot } from "./usage/types.js"

const refreshInterval = 60_000

type CacheEntry = {
  current: UsageSnapshot
  inFlight?: Promise<UsageSnapshot>
  lastAttempt: number
}

export default Plugin.define({
  id: "opencode-usage",
  async setup(ctx) {
    const config = parseUsageConfig(ctx.options)
    const adapters = createAdapterRegistry(createProviderAdapters(ctx).filter((adapter) => providerEnabled(config, adapter.id)))
    const cache = new Map<string, CacheEntry>()
    const provider = (input: unknown) => (input as { providerID?: string }).providerID
    const entryFor = (providerID?: string) => {
      const id = providerID ?? ""
      let entry = cache.get(id)
      if (!entry) {
        entry = { current: emptySnapshot(id), lastAttempt: 0 }
        cache.set(id, entry)
      }
      return entry
    }

    const registration = await ctx.rpc.register(Usage, {
      get: async (input) => refresh(false, provider(input)),
      refresh: async (input) => refresh(true, provider(input)),
      runAction: async (input) => {
        const adapter = adapters.get(provider(input))
        const actionID = (input as { actionID: string }).actionID
        if (!adapter) return { status: "unsupported" as const }
        try {
          const result = await adapter.runAction(actionID)
          if (result.status === "success") void refresh(true, adapter.id)
          return result
        } catch { return { status: "failed" as const } }
      },
    })

    const refresh = async (force: boolean, providerID?: string): Promise<UsageSnapshot> => {
      const id = providerID ?? ""
      const entry = entryFor(id)
      if (!force && Date.now() - entry.lastAttempt < refreshInterval) return entry.current
      if (entry.inFlight) return entry.inFlight

      entry.lastAttempt = Date.now()
      entry.inFlight = (async () => {
        const adapter = adapters.get(providerID)
        const snapshot = !adapter
          ? { ...emptySnapshot(id), error: "Usage is not supported for the selected provider." }
          : await adapter.load()
        const current = { ...snapshot, providerID: id, providerName: adapter?.name ?? "" }
        entry.current = current
        await registration.events.emit("updated", current)
        return current
      })().catch(async (error) => {
        const message = error instanceof Error ? error.message : "Usage is temporarily unavailable."
        const current = entry.current.windows.length
          ? { ...entry.current, status: "stale" as const, error: message }
          : { ...emptySnapshot(id), error: message }
        entry.current = current
        await registration.events.emit("updated", current)
        return current
      }).finally(() => {
        entry.inFlight = undefined
      })
      return entry.inFlight
    }

    const timer = setInterval(() => {
      for (const providerID of cache.keys()) void refresh(false, providerID)
    }, refreshInterval)
    return () => clearInterval(timer)
  },
})
