import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { UsageAdapter } from "../types.js"

export const metadata = {
  id: "openrouter",
  name: "OpenRouter",
}

const execFileAsync = promisify(execFile)
const apiURL = "https://openrouter.ai/api/v1"

type APIKeyCredential = { type: "key"; key: string }
type ResolveKey = () => Promise<APIKeyCredential | undefined>
type KeyResponse = {
  data?: {
    label?: unknown
    limit?: unknown
    limit_reset?: unknown
    limit_remaining?: unknown
    usage?: unknown
    usage_daily?: unknown
    usage_weekly?: unknown
    usage_monthly?: unknown
  }
}
type CreditsResponse = {
  data?: {
    total_credits?: unknown
    total_usage?: unknown
  }
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function currency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(value)
}

export function createOpenRouterAdapter(resolveKey: ResolveKey): UsageAdapter {
  const headers = async () => {
    const credential = await resolveKey()
    if (!credential) throw new Error("OpenRouter API key is not connected.")
    return { Authorization: `Bearer ${credential.key}` }
  }

  return {
    id: metadata.id,
    name: metadata.name,
    meterKinds: ["key-limit"],
    async isAvailable() {
      return Boolean(await resolveKey())
    },
    async load() {
      const auth = await headers()
      const [keyResponse, creditsResponse] = await Promise.all([
        fetch(`${apiURL}/key`, { headers: auth }),
        fetch(`${apiURL}/credits`, { headers: auth }),
      ])
      if (!keyResponse.ok) throw new Error(`Key usage request failed (${keyResponse.status}).`)
      if (!creditsResponse.ok) throw new Error(`Credit balance request failed (${creditsResponse.status}).`)

      const key = (await keyResponse.json() as KeyResponse).data ?? {}
      const credits = (await creditsResponse.json() as CreditsResponse).data ?? {}
      const limit = number(key.limit)
      const remaining = number(key.limit_remaining)
      const totalCredits = number(credits.total_credits)
      const totalUsage = number(credits.total_usage)
      const keyUsage = number(key.usage)
      const label = typeof key.label === "string" && key.label ? key.label : "Active key"
      const reset = typeof key.limit_reset === "string" && key.limit_reset ? key.limit_reset : undefined
      const windows = limit !== undefined && remaining !== undefined && limit > 0
        ? [{ id: "key-limit", kind: "key-limit", label: "", title: "Key limit", usedPercent: Math.max(0, Math.min(100, ((limit - remaining) / limit) * 100)), valueLabel: `${currency(limit - remaining)} / ${currency(limit)}`, composerValueLabel: currency(limit - remaining) }]
        : []
      const keyLines = [
        label,
        limit === undefined ? "No key spending cap" : `Cap ${currency(limit)}`,
        remaining === undefined ? undefined : `${currency(remaining)} remaining`,
        reset ? `Resets ${reset}` : undefined,
        keyUsage === undefined ? undefined : `${currency(keyUsage)} used total`,
        number(key.usage_daily) === undefined ? undefined : `${currency(number(key.usage_daily)!)} used today`,
        number(key.usage_weekly) === undefined ? undefined : `${currency(number(key.usage_weekly)!)} used this week`,
        number(key.usage_monthly) === undefined ? undefined : `${currency(number(key.usage_monthly)!)} used this month`,
      ].filter((line): line is string => Boolean(line))
      const creditLines = [
        totalCredits === undefined || totalUsage === undefined ? undefined : `${currency(totalCredits - totalUsage)} remaining`,
        totalCredits === undefined ? undefined : `${currency(totalCredits)} purchased`,
        totalUsage === undefined ? undefined : `${currency(totalUsage)} used total`,
      ].filter((line): line is string => Boolean(line))

      return {
        status: "ready",
        windows,
        sections: [
          { id: "key", title: "Key limit", lines: keyLines },
          ...(creditLines.length ? [{ id: "credits", title: "Account credits", lines: creditLines }] : []),
        ],
        actions: [{ id: "account", label: "Account" }],
        refreshedAt: Date.now(),
      }
    },
    async runAction(actionID) {
      if (actionID !== "account") return { status: "unsupported" }
      const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open"
      await execFileAsync(command, process.platform === "win32" ? ["/c", "start", "", "https://openrouter.ai/settings/keys"] : ["https://openrouter.ai/settings/keys"])
      return { status: "success", message: "Opened OpenRouter account settings." }
    },
  }
}
