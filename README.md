# OpenCode Usage

An OpenCode TUI plugin for showing subscription or account usage above the composer. It renders the usage windows supported by the currently selected provider, then opens a shared details dialog with provider-specific sections and actions.

## Install

Add the package to global OpenCode configuration:

```jsonc
{
  "plugins": ["@sethwv/opencode-usage"]
}
```

For a local checkout:

```jsonc
{
  "plugins": ["/path/to/opencode-usage"]
}
```

Restart OpenCode after changing global plugin configuration.

## What it renders

- Compact usage meters above the composer for available usage windows.
- A provider details dialog containing fuller bars, exact reset times, and remaining time.
- Provider-defined sections, such as banked reset credits and individual expiry times.
- Only the actions supported by that provider, such as refresh, opening a usage dashboard, or redeeming a reset.

The plugin hides its meter when the selected provider has no registered adapter. It never shows one provider's quota while another provider is selected.

## Provider support

| Provider ID | Authentication | Windows | Extra sections | Actions |
| --- | --- | --- | --- | --- |
| `openai` | ChatGPT OAuth | Weekly and session | Banked reset credits | Dashboard and reset redemption |

The OpenAI adapter reuses OpenCode's active connection server-side. Credentials are never sent to the TUI, saved by the plugin, or logged.

## Adding a provider

Add a provider adapter under `src/adapters/providers/` and register it in `src/index.ts`. The bundled OpenAI adapter is `src/adapters/providers/openai.ts`.

```ts
type UsageAdapter = {
  id: string
  name: string
  supports: ReadonlySet<"dashboard" | "reset">
  load(): Promise<UsageSnapshot>
  openDashboard?(): Promise<void>
  consumeReset?(): Promise<string>
}
```

`load()` returns a provider-neutral `UsageSnapshot` containing zero or more usage windows and optional detail sections such as banked resets. The shared RPC, cache, composer meter, and dialog stay unchanged when a provider is added.

Use the OpenCode provider ID as the adapter ID. The TUI sends the active model's provider ID to the server, which selects the matching adapter.

## Security and provider APIs

Each adapter owns its authentication and network behavior. It should resolve credentials only in the server plugin, send them only to its provider, and return normalized usage data to the TUI.

The bundled OpenAI adapter uses undocumented ChatGPT backend endpoints for subscription usage and reset credits. Those endpoints can change or become unavailable. Redeeming a reset is irreversible, so the UI requires two activations before the request is sent.
