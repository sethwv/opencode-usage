import { Rpc } from "@opencode/plugin/rpc"

const window = {
  type: "object",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
    usedPercent: { type: "number" },
    resetAt: { type: "number" },
    durationSeconds: { type: "number" },
  },
  required: ["id", "label", "usedPercent", "resetAt"],
  additionalProperties: false,
} as const

const snapshot = {
  type: "object",
  properties: {
    providerID: { type: "string" },
    status: { type: "string", enum: ["ready", "stale", "unavailable"] },
    windows: { type: "array", items: window },
    bankedResetCount: { type: "number" },
    bankedResets: {
      type: "array",
      items: {
        type: "object",
        properties: { expiresAt: { type: "number" } },
        additionalProperties: false,
      },
    },
    refreshedAt: { type: "number" },
    error: { type: "string" },
  },
  required: ["providerID", "status", "windows"],
  additionalProperties: false,
} as const

const providerInput = {
  type: "object",
  properties: { providerID: { type: "string" } },
  additionalProperties: false,
} as const

export const CodexUsage = Rpc.define({
  id: "codex-usage",
  methods: {
    get: {
      input: providerInput,
      output: snapshot,
    },
    refresh: {
      input: providerInput,
      output: snapshot,
    },
    openDashboard: {
      input: providerInput,
      output: {
        type: "object",
        properties: { opened: { type: "boolean" } },
        required: ["opened"],
        additionalProperties: false,
      },
    },
    consumeReset: {
      input: providerInput,
      output: {
        type: "object",
        properties: { outcome: { type: "string" } },
        required: ["outcome"],
        additionalProperties: false,
      },
    },
  },
  events: {
    updated: { schema: snapshot },
  },
})
