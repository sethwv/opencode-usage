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
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          lines: { type: "array", items: { type: "string" } },
        },
        required: ["id", "title", "lines"],
        additionalProperties: false,
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          confirmLabel: { type: "string" },
          confirmationMessage: { type: "string" },
          refresh: { type: "boolean" },
        },
        required: ["id", "label"],
        additionalProperties: false,
      },
    },
    refreshedAt: { type: "number" },
    error: { type: "string" },
  },
  required: ["providerID", "status", "windows", "sections", "actions"],
  additionalProperties: false,
} as const

const providerInput = {
  type: "object",
  properties: { providerID: { type: "string" } },
  additionalProperties: false,
} as const

export const Usage = Rpc.define({
  id: "opencode-usage",
  methods: {
    get: {
      input: providerInput,
      output: snapshot,
    },
    refresh: {
      input: providerInput,
      output: snapshot,
    },
    runAction: {
      input: {
        type: "object",
        properties: { ...providerInput.properties, actionID: { type: "string" } },
        required: ["actionID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: { status: { type: "string", enum: ["success", "failed", "unsupported"] }, message: { type: "string" } },
        required: ["status"],
        additionalProperties: false,
      },
    },
  },
  events: {
    updated: { schema: snapshot },
  },
})
