import type { UsageAdapter } from "./types.js"

export function createAdapterRegistry(adapters: readonly UsageAdapter[]) {
  const byID = new Map(adapters.map((adapter) => [adapter.id, adapter]))
  return {
    get(providerID?: string) {
      return byID.get(providerID ?? "")
    },
    list() {
      return [...byID.values()]
    },
  }
}
