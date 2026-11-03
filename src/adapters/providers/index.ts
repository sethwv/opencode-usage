import type { Plugin } from "@opencode/plugin"
import type { UsageAdapter } from "../types.js"
import { createOpenAIAdapter } from "./openai.js"

export function createProviderAdapters(context: Plugin.Context): UsageAdapter[] {
  return [
    createOpenAIAdapter(async () => {
      const connection = await context.integration.connection.active("openai")
      const credential = connection ? await context.integration.connection.resolve(connection) : undefined
      return credential?.type === "oauth" ? credential : undefined
    }),
  ]
}
