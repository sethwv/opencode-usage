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

## Configuration

Configure the plugin through its `options` object:

```jsonc
{
  "plugins": [
    {
      "package": "@sethwv/opencode-usage",
      "options": {
        "composer": {
          "showProviderName": true,
          "meterLabel": "short",
          "thresholds": {
            "warning": 50,
            "alert": 75,
            "critical": 90,
          },
          "meters": {
            "session": { "enabled": true },
            "week": { "enabled": true },
            "key-limit": { "enabled": true },
            "tokens": { "enabled": false },
          },
          "source": { "mode": "current-model" },
        },
        "providers": {
          "openrouter": { "enabled": true },
          "openai": { "enabled": true },
        },
      },
    },
  ],
}
```

- `composer.showProviderName` controls the provider prefix above the composer.
- `composer.meterLabel` controls compact meter labels: `short` uses adapter abbreviations, `word` uses full names, and `none` hides labels.
- `composer.thresholds` controls when meters become warning, orange, and critical colors. Values must be ordered from low to high and fall between 0 and 100.
- `composer.meters.<kind>.enabled` controls a meter type everywhere in the TUI. Current kinds are `session`, `week`, and `key-limit`. Future adapters can add kinds such as `tokens`.
- `composer.source` chooses which provider’s usage to show. Use `{ "mode": "current-model" }` to follow the selected model, or `{ "mode": "provider", "providerID": "openrouter" }` to pin a provider.
- `providers.<providerID>.enabled` disables usage collection and display for a provider.

`/usage` shows tabs for each enabled provider with an active OpenCode connection, plus **Settings**. Provider tabs let you inspect a provider without changing the composer meter. The Settings tab can toggle the provider prefix and known meter kinds, or pin usage to the current provider. These display preferences are stored locally by OpenCode and override their file-configured defaults. Provider enablement and threshold values remain file configuration.

Use Left and Right to switch dialog tabs. In Settings, use Up and Down to select a row and Enter to change it. Provider tabs support `r` to refresh and number keys to run visible actions.

## Supported providers

| Provider | Credential | Composer meter | Details |
| --- | --- | --- | --- |
| OpenAI | Active OpenCode OAuth connection | ChatGPT rate-limit windows | Reset time and available banked resets |
| OpenRouter | Active OpenCode API-key connection | Finite key cap, percent used, and spent amount | Key cap, remaining amount, total usage, and account credits |

The meter always follows the selected model's provider. It does not reuse usage data from another provider.

## UI examples

With an OpenRouter model selected, a finite API-key cap appears above the composer:

```text
OpenRouter: ━━━─────── 30% $3.00
```

`/usage` opens the provider details dialog:

```text
                 OpenRouter

          ┌─────────────────────────┐
          │ Key limit · 30% ·       │
          │ $3.00 / $10.00          │
          │ ━━━━━━──────────────────│
          └─────────────────────────┘

          ┌─────────────────────────┐
          │ Account credits         │
          │ $7.00 remaining         │
          │ $10.00 purchased        │
          │ $3.00 used total        │
          └─────────────────────────┘

              [ Refresh ] [ Account ]
```

With an OpenAI model selected, rate-limit windows render in the same location:

```text
OpenAI: ━━━━━───── S 50% 1h 30m · ━━──────── W 20% 4d 12h
```

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
