import type { UsageAction, UsageSnapshot } from "../usage/types.js"

export type AdapterUsageSnapshot = Omit<UsageSnapshot, "providerID">
export type UsageActionResult = { status: "success" | "failed" | "unsupported"; message?: string }

export type UsageAdapter = {
  id: string
  name: string
  load(): Promise<AdapterUsageSnapshot>
  runAction(actionID: UsageAction["id"]): Promise<UsageActionResult>
}
