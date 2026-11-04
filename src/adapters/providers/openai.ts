import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { formatExactReset, type UsageWindow } from "../../usage/types.js"
import type { UsageAdapter } from "../types.js"

export const metadata = {
  id: "openai",
  name: "OpenAI",
}

// Implementation

const execFileAsync = promisify(execFile)
const baseURL = "https://chatgpt.com/backend-api/wham"

type OAuthCredential = { type: "oauth"; access: string; metadata?: Record<string, unknown> }
type ResolveOAuth = () => Promise<OAuthCredential | undefined>
type RawWindow = { used_percent?: unknown; reset_at?: unknown; limit_window_seconds?: unknown }
type UsageResponse = {
  rate_limit?: { primary_window?: RawWindow | null; secondary_window?: RawWindow | null } | null
  rate_limit_reset_credits?: { available_count?: unknown } | null
}

function accountID(credential: OAuthCredential) {
  const metadata = credential.metadata ?? {}
  const direct = metadata.accountId ?? metadata.account_id ?? metadata.chatgpt_account_id
  if (typeof direct === "string" && direct) return direct
  try {
    const [, payload] = credential.access.split(".")
    const auth = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))["https://api.openai.com/auth"]
    return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined
  } catch { return undefined }
}

function window(raw: RawWindow | null | undefined, id: string): UsageWindow | undefined {
  if (!raw || typeof raw.used_percent !== "number" || typeof raw.reset_at !== "number") return undefined
  const durationSeconds = typeof raw.limit_window_seconds === "number" && raw.limit_window_seconds > 0 ? raw.limit_window_seconds : undefined
  const weekly = Boolean(durationSeconds && durationSeconds >= 86_400)
  return { id, kind: weekly ? "week" : "session", label: weekly ? "W" : "S", usedPercent: Math.max(0, Math.min(100, raw.used_percent)), resetAt: raw.reset_at * 1000, durationSeconds }
}

export function createOpenAIAdapter(resolveOAuth: ResolveOAuth): UsageAdapter {
  const headers = async () => {
    const credential = await resolveOAuth()
    const account = credential && accountID(credential)
    if (!credential || !account) throw new Error("ChatGPT OAuth is not connected.")
    return { Authorization: `Bearer ${credential.access}`, "ChatGPT-Account-ID": account }
  }
  return {
    id: metadata.id,
    name: metadata.name,
    meterKinds: ["session", "week"],
    async isAvailable() {
      return Boolean(await resolveOAuth())
    },
    async load() {
      const auth = await headers()
      const response = await fetch(`${baseURL}/usage`, { headers: auth })
      if (!response.ok) throw new Error(`Usage request failed (${response.status}).`)
      const body = await response.json() as UsageResponse
      const windows = [window(body.rate_limit?.primary_window, "primary"), window(body.rate_limit?.secondary_window, "secondary")].filter((item): item is UsageWindow => Boolean(item)).toSorted((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0))
      if (!windows.length) throw new Error("No supported Codex usage windows were returned.")
      const count = body.rate_limit_reset_credits?.available_count
      const bankedResetCount = typeof count === "number" && count > 0 ? Math.floor(count) : undefined
      const credits = bankedResetCount
        ? await fetch(`${baseURL}/rate-limit-reset-credits`, { headers: auth }).then(async (response) => response.ok ? (await response.json() as { credits?: Array<{ status?: unknown; expires_at?: unknown }> }).credits ?? [] : []).catch(() => [])
        : []
      const bankedResets = credits.filter((credit) => credit.status === "available").map((credit) => {
        const expiresAt = typeof credit.expires_at === "string" ? Date.parse(credit.expires_at) : NaN
        return Number.isFinite(expiresAt) ? `Reset expires ${formatExactReset(expiresAt)}` : "Reset expiry not reported"
      })
      return {
        status: "ready",
        windows,
        sections: bankedResetCount ? [{ id: "banked-resets", title: "Banked resets", lines: [`${bankedResetCount} available`, ...bankedResets] }] : [],
        actions: [
          { id: "dashboard", label: "Usage" },
          ...(bankedResetCount ? [{ id: "reset", label: `Reset (${bankedResetCount})`, confirmLabel: "Confirm reset", confirmationMessage: "Click Confirm reset again to apply the banked reset.", refresh: true }] : []),
        ],
        refreshedAt: Date.now(),
      }
    },
    async runAction(actionID) {
      if (actionID === "dashboard") {
        const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open"
        await execFileAsync(command, process.platform === "win32" ? ["/c", "start", "", "https://chatgpt.com/codex/settings/usage"] : ["https://chatgpt.com/codex/settings/usage"])
        return { status: "success", message: "Opened usage dashboard." }
      }
      if (actionID !== "reset") return { status: "unsupported" }
      const response = await fetch(`${baseURL}/rate-limit-reset-credits/consume`, { method: "POST", headers: { ...(await headers()), "Content-Type": "application/json" }, body: JSON.stringify({ redeem_request_id: crypto.randomUUID() }) })
      if (!response.ok) return { status: "failed" }
      const body = await response.json() as { code?: unknown }
      return body.code === "reset" ? { status: "success", message: "Banked reset applied." } : { status: "failed" }
    },
  }
}
