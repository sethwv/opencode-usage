import type { UsageSnapshot } from "../usage/types.js"

export type UsageAction = "dashboard" | "reset"
export type AdapterUsageSnapshot = Omit<UsageSnapshot, "providerID">

export type UsageAdapter = {
  id: string
  name: string
  supports: ReadonlySet<UsageAction>
  load(): Promise<AdapterUsageSnapshot>
  openDashboard?(): Promise<void>
  consumeReset?(): Promise<string>
}
