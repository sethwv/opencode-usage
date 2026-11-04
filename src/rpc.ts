import { Rpc } from "@opencode/plugin/rpc"

const window = {
  type: "object",
  properties: {
    id: { type: "string" },
    kind: { type: "string" },
    label: { type: "string" },
    title: { type: "string" },
    usedPercent: { type: "number" },
    valueLabel: { type: "string" },
    composerValueLabel: { type: "string" },
    resetAt: { type: "number" },
    durationSeconds: { type: "number" },
  },
  required: ["id", "label", "usedPercent"],
  additionalProperties: false,
} as const

const snapshot = {
  type: "object",
  properties: {
    providerID: { type: "string" },
    providerName: { type: "string" },
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
  required: ["providerID", "providerName", "status", "windows", "sections", "actions"],
  additionalProperties: false,
} as const

const providerInput = {
  type: "object",
  properties: { providerID: { type: "string" } },
  additionalProperties: false,
} as const

const providers = {
  type: "array",
  items: {
    type: "object",
    properties: { id: { type: "string" }, name: { type: "string" }, meterKinds: { type: "array", items: { type: "string" } } },
    required: ["id", "name", "meterKinds"],
    additionalProperties: false,
  },
} as const

export const Usage = Rpc.define({
  id: "opencode-usage",
  methods: {
    providers: {
      input: { type: "object", additionalProperties: false },
      output: providers,
    },
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
