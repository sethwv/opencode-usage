# OpenCode Usage

An OpenCode TUI plugin that shows usage for the selected model provider above the composer. Open the **Show usage** command or run `/usage` for provider-specific details and actions.

## Install

Add the package to global OpenCode configuration:

```jsonc
{
  "plugins": ["@sethwv/opencode-usage"]
}
```

Restart OpenCode after changing global plugin configuration.

## Supported providers

| Provider | Credential | Composer meter | Details |
| --- | --- | --- | --- |
| OpenAI | Active OpenCode OAuth connection | ChatGPT rate-limit windows | Reset time and available banked resets |
| OpenRouter | Active OpenCode API-key connection | Finite key cap, percent used, and spent amount | Key cap, remaining amount, total usage, and account credits |

The meter always follows the selected model's provider. It does not reuse usage data from another provider.

## Local development

OpenCode's local plugin discovery requires real files under its plugin directory. Copy the source after every change:

```sh
rsync -a --delete src/ ~/.config/opencode/plugin/opencode-usage/
```

Restart OpenCode if the running plugin does not reload the updated files. A restart interrupts active sessions.

## What it renders

- Compact usage meters above the composer with a provider-name prefix.
- A details dialog containing fuller bars, exact reset times, and remaining time.
- Adapter-defined sections for account or subscription details.
- Adapter-defined actions, including actions that require confirmation.

The plugin hides its meter when the selected provider has no registered adapter. It never shows one provider's quota while another provider is selected.

## Adding a provider

Add an adapter under `src/adapters/providers/` and register it in `src/adapters/providers/index.ts`.

```ts
type UsageAdapter = {
  id: string
  name: string
  load(): Promise<AdapterUsageSnapshot>
  runAction(actionID: UsageAction["id"]): Promise<UsageActionResult>
}
```

`load()` returns a normalized snapshot containing usage windows, optional sections, and action descriptors. The shared RPC, cache, composer meter, and dialog stay unchanged when an adapter is added.

Use the OpenCode provider ID as the adapter ID. The TUI sends the active model's provider ID to the server, which selects the matching adapter.

## Adapter boundaries

Each adapter owns its authentication, network behavior, detail sections, and actions. It should resolve credentials only in the server plugin, send them only to the associated service, and return normalized data to the TUI.

The shared code does not interpret adapter-specific responses or action IDs. It only renders the descriptors supplied by the adapter and sends a selected action ID back to that adapter.
