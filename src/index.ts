import { Plugin } from "@opencode/plugin"
import { createOpenAIAdapter } from "./adapters/providers/openai.js"
import { createAdapterRegistry } from "./adapters/registry.js"
import { CodexUsage } from "./rpc.js"
import { emptySnapshot, type UsageSnapshot } from "./usage/types.js"

const refreshInterval = 60_000

type CacheEntry = {
  current: UsageSnapshot
  inFlight?: Promise<UsageSnapshot>
  lastAttempt: number
}

export default Plugin.define({
  id: "codex-usage",
  async setup(ctx) {
    const adapters = createAdapterRegistry([
      createOpenAIAdapter(async () => {
        const connection = await ctx.integration.connection.active("openai")
        const credential = connection ? await ctx.integration.connection.resolve(connection) : undefined
        return credential?.type === "oauth" ? credential : undefined
      }),
    ])
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

    const registration = await ctx.rpc.register(CodexUsage, {
      get: async (input) => refresh(false, provider(input)),
      refresh: async (input) => refresh(true, provider(input)),
      openDashboard: async (input) => {
        const adapter = adapters.get(provider(input))
        if (!adapter?.supports.has("dashboard") || !adapter.openDashboard) return { opened: false }
        try { await adapter.openDashboard(); return { opened: true } } catch { return { opened: false } }
      },
      consumeReset: async (input) => {
        const adapter = adapters.get(provider(input))
        if (!adapter?.supports.has("reset") || !adapter.consumeReset) return { outcome: "unsupported_provider" }
        try {
          const outcome = await adapter.consumeReset()
          if (outcome === "reset") void refresh(true, adapter.id)
          return { outcome }
        } catch { return { outcome: "failed" } }
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
        const current = { ...snapshot, providerID: id }
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
