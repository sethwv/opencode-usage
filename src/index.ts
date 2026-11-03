import { Plugin } from "@opencode/plugin"
import { createOpenAIAdapter } from "./adapters/providers/openai.js"
import { createAdapterRegistry } from "./adapters/registry.js"
import { CodexUsage } from "./rpc.js"
import { emptySnapshot, type UsageSnapshot } from "./usage/types.js"

const refreshInterval = 60_000

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
    let current = emptySnapshot()
    let inFlight: Promise<UsageSnapshot> | undefined
    let lastAttempt = 0
    const provider = (input: unknown) => (input as { providerID?: string }).providerID
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
    const publish = async (snapshot: UsageSnapshot) => { current = snapshot; await registration.events.emit("updated", snapshot); return snapshot }
    const refresh = async (force: boolean, providerID?: string): Promise<UsageSnapshot> => {
      if (!force && Date.now() - lastAttempt < refreshInterval) return current
      if (inFlight) return inFlight
      lastAttempt = Date.now()
      inFlight = (async () => {
        const adapter = adapters.get(providerID)
        if (!adapter) return publish({ ...emptySnapshot(), error: "Usage is not supported for the selected provider." })
        try { return publish(await adapter.load()) }
        catch (error) {
          const message = error instanceof Error ? error.message : "Usage is temporarily unavailable."
          return publish(current.windows.length ? { ...current, status: "stale", error: message } : { ...emptySnapshot(), error: message })
        } finally { inFlight = undefined }
      })()
      return inFlight
    }
    void refresh(true)
    const timer = setInterval(() => void refresh(false), refreshInterval)
    return () => clearInterval(timer)
  },
})
