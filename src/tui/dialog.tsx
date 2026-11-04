import type { RGBA } from "@opentui/core"
import { For, Show } from "solid-js"
import { formatExactReset, formatFullRemaining, type UsageAction, type UsageSnapshot } from "../usage/types.js"
import { MeterBar } from "./meter.js"

type Provider = { id: string; name: string }
type ColorFor = (usedPercent: number) => RGBA

export type UsageDialogProps = {
  providers: () => Provider[]
  selectedTab: () => string
  snapshot: () => UsageSnapshot
  windows: () => UsageSnapshot["windows"]
  settings: () => DialogSetting[]
  muted: RGBA
  textBase: RGBA
  cardWidth: () => number
  settingsWidth: () => number
  compact: boolean
  selectedSetting: () => number
  colorFor: ColorFor
  dimColorFor: ColorFor
  actionLabel: (action: UsageAction) => string
  onSelectProvider: (providerID: string) => void
  onSelectSettings: () => void
  onSelectSetting: (index: number) => void
  onRefresh: () => void
  onRunAction: (action: UsageAction) => void
}

export type DialogSetting = {
  group: string
  label: string
  value: string
  run: () => void
}

function Button(props: { label: string; muted: RGBA; run: () => void }) {
  return (
    <box border borderColor={props.muted} paddingLeft={1} paddingRight={1} onMouseUp={(event: any) => { event.preventDefault(); props.run() }}>
      <text fg={props.muted}>{props.label}</text>
    </box>
  )
}

function Tabs(props: Pick<UsageDialogProps, "providers" | "selectedTab" | "muted" | "textBase" | "onSelectProvider" | "onSelectSettings">) {
  return (
    <box width="100%" flexDirection="row" justifyContent="center" flexWrap="wrap">
      <For each={props.providers()}>
        {(provider, index) => (
          <>
            <Show when={index() > 0}><text fg={props.muted}> · </text></Show>
            <box onMouseUp={(event: any) => { event.preventDefault(); props.onSelectProvider(provider.id) }}>
              <text fg={props.selectedTab() === provider.id ? props.textBase : props.muted}>{provider.name}</text>
            </box>
          </>
        )}
      </For>
      <Show when={props.providers().length > 0}><text fg={props.muted}> · </text></Show>
      <box onMouseUp={(event: any) => { event.preventDefault(); props.onSelectSettings() }}>
        <text fg={props.selectedTab() === "settings" ? props.textBase : props.muted}>Settings</text>
      </box>
    </box>
  )
}

function MeterCard(props: Pick<UsageDialogProps, "cardWidth" | "muted" | "colorFor" | "dimColorFor"> & { window: UsageSnapshot["windows"][number] }) {
  const title = () => props.window.title ?? (props.window.label === "W" ? "Week" : "Session")
  const resetAt = props.window.resetAt
  return (
    <box width={props.cardWidth()} flexDirection="column" alignItems="center" border borderColor={props.muted} paddingLeft={1} paddingRight={1}>
      <text>{`${title()} · ${Math.round(props.window.usedPercent)}%${props.window.valueLabel ? ` · ${props.window.valueLabel}` : ""}`}</text>
      <MeterBar usedPercent={props.window.usedPercent} width={20} colorFor={props.colorFor} dimColorFor={props.dimColorFor} />
      {resetAt && <text fg={props.muted}>{`Resets ${formatExactReset(resetAt)} (${formatFullRemaining(resetAt)} remaining)`}</text>}
    </box>
  )
}

function UsagePanel(props: Pick<UsageDialogProps, "snapshot" | "windows" | "cardWidth" | "muted" | "colorFor" | "dimColorFor">) {
  return (
    <>
      <text fg={props.muted}>{props.snapshot().providerName || "Usage"}</text>
      <For each={props.windows()}>{(window) => <MeterCard {...props} window={window} />}</For>
      <For each={props.snapshot().sections}>
        {(section) => (
          <box width={props.cardWidth()} flexDirection="column" alignItems="center" border borderColor={props.muted} paddingLeft={1} paddingRight={1}>
            <text>{section.title}</text>
            <For each={section.lines}>{(line) => <text fg={props.muted}>{line}</text>}</For>
          </box>
        )}
      </For>
    </>
  )
}

function SettingsPanel(props: Pick<UsageDialogProps, "settings" | "settingsWidth" | "muted" | "textBase" | "selectedSetting" | "onSelectSetting">) {
  const groups = () => {
    const grouped = new Map<string, Array<{ setting: DialogSetting; index: number }>>()
    props.settings().forEach((setting, index) => {
      const rows = grouped.get(setting.group) ?? []
      rows.push({ setting, index })
      grouped.set(setting.group, rows)
    })
    return [...grouped.entries()]
  }
  return (
    <box width={props.settingsWidth()} flexDirection="column" gap={1}>
      <For each={groups()}>
        {([group, rows]) => (
          <box width="100%" flexDirection="column" border borderColor={props.muted} paddingLeft={1} paddingRight={1}>
            <text fg={props.textBase}>{group}</text>
            <For each={rows}>
              {({ setting, index }) => (
                <box width="100%" flexDirection="row" justifyContent="space-between" onMouseUp={(event: any) => { event.preventDefault(); props.onSelectSetting(index); setting.run() }}>
                  <text fg={props.selectedSetting() === index ? props.textBase : props.muted}>{setting.label}</text>
                  <text fg={props.textBase}>{setting.value}</text>
                </box>
              )}
            </For>
          </box>
        )}
      </For>
    </box>
  )
}

export function UsageDialog(props: UsageDialogProps) {
  return (
    <box flexDirection="column" alignItems="center" padding={props.compact ? 0 : 1} gap={props.compact ? 0 : 1}>
      <Tabs {...props} />
      <Show when={props.selectedTab() !== "settings"}><UsagePanel {...props} /></Show>
      <Show when={props.selectedTab() === "settings"}><SettingsPanel {...props} /></Show>
      <Show when={props.selectedTab() !== "settings"}>
        <box flexDirection="row" justifyContent="center" gap={1}>
          <Button label="[r] Refresh" muted={props.muted} run={props.onRefresh} />
          <For each={props.snapshot().actions}>{(action, index) => <Button label={`[${index() + 1}] ${props.actionLabel(action)}`} muted={props.muted} run={() => props.onRunAction(action)} />}</For>
        </box>
      </Show>
      <Show when={!props.compact}><text fg={props.muted}>{props.selectedTab() === "settings" ? "←/→ tabs · ↑/↓ select · Enter change · Esc close" : "←/→ tabs · r refresh · 1 action · Esc close"}</text></Show>
    </box>
  )
}
