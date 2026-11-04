export type UsageWindow = {
  id: string
  label: string
  title?: string
  usedPercent: number
  valueLabel?: string
  composerValueLabel?: string
  resetAt?: number
  durationSeconds?: number
}

export type UsageSection = {
  id: string
  title: string
  lines: string[]
}

export type UsageAction = {
  id: string
  label: string
  confirmLabel?: string
  confirmationMessage?: string
  refresh?: boolean
}

export type UsageSnapshot = {
  providerID: string
  providerName: string
  status: "ready" | "stale" | "unavailable"
  windows: UsageWindow[]
  sections: UsageSection[]
  actions: UsageAction[]
  refreshedAt?: number
  error?: string
}

export const emptySnapshot = (providerID = "", providerName = ""): UsageSnapshot => ({ providerID, providerName, status: "unavailable", windows: [], sections: [], actions: [] })

export function formatBar(usedPercent: number) {
  const { filled, empty } = barSegments(usedPercent)
  return `${filled}${empty}`
}

export function formatDetailBar(usedPercent: number, width = 20) {
  const { filled, empty } = barSegments(usedPercent, width)
  return `${filled}${empty}`
}

export function barSegments(usedPercent: number, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((usedPercent / 100) * width)))
  return { filled: "━".repeat(filled), empty: "─".repeat(width - filled) }
}

export function formatCompactRemaining(resetAt: number, now = Date.now()) {
  let minutes = Math.max(0, Math.ceil((resetAt - now) / 60_000))
  const days = Math.floor(minutes / 1_440)
  minutes %= 1_440
  const hours = Math.floor(minutes / 60)
  minutes %= 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return "<1m"
}

export function formatFullRemaining(resetAt: number, now = Date.now()) {
  let seconds = Math.max(0, Math.ceil((resetAt - now) / 1000))
  const days = Math.floor(seconds / 86_400)
  seconds %= 86_400
  const hours = Math.floor(seconds / 3_600)
  seconds %= 3_600
  const minutes = Math.ceil(seconds / 60)
  const parts = [days ? `${days}d` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean)
  return parts.join(" ") || "<1m"
}

export function formatExactReset(resetAt: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(resetAt))
}
