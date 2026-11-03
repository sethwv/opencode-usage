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
  load(): Promise<UsageSnapshot>
  runAction(actionID: string): Promise<UsageActionResult>
}
```

`load()` returns a normalized snapshot containing usage windows, optional sections, and action descriptors. The shared RPC, cache, composer meter, and dialog stay unchanged when an adapter is added.

Use the OpenCode provider ID as the adapter ID. The TUI sends the active model's provider ID to the server, which selects the matching adapter.

## Adapter boundaries

Each adapter owns its authentication, network behavior, detail sections, and actions. It should resolve credentials only in the server plugin, send them only to the associated service, and return normalized data to the TUI.

The shared code does not interpret adapter-specific responses or action IDs. It only renders the descriptors supplied by the adapter and sends a selected action ID back to that adapter.
