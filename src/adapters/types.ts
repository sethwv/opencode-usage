import type { UsageSnapshot } from "../usage/types.js"

export type UsageAction = "dashboard" | "reset"

export type UsageAdapter = {
  id: string
  name: string
  supports: ReadonlySet<UsageAction>
  load(): Promise<UsageSnapshot>
  openDashboard?(): Promise<void>
  consumeReset?(): Promise<string>
}
