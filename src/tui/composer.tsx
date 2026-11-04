import type { RGBA } from "@opentui/core"
import { For, Show } from "solid-js"
import { formatCompactRemaining, type UsageSnapshot } from "../usage/types.js"
import { MeterBar } from "./meter.js"

export function ComposerMeters(props: {
  snapshot: () => UsageSnapshot
  windows: () => UsageSnapshot["windows"]
  showProviderName: () => boolean
  labelFor: (window: UsageSnapshot["windows"][number]) => string
  muted: RGBA
  colorFor: (usedPercent: number) => RGBA
  dimColorFor: (usedPercent: number) => RGBA
  onShowDetails: () => void
}) {
  return (
    <Show when={props.windows().length > 0}>
      <box width="100%" height={1} flexDirection="row">
        <box width="100%" height={1} flexDirection="row" justifyContent="center" paddingLeft={1} paddingRight={1}>
          <Show when={props.showProviderName() && props.snapshot().providerName}>
            <text fg={props.muted}>{`${props.snapshot().providerName}: `}</text>
          </Show>
          <For each={props.windows()}>
            {(window, index) => (
              <box flexDirection="row" onMouseUp={(event: any) => { event.preventDefault(); props.onShowDetails() }}>
                <text fg={props.muted}>{index() > 0 ? "\u00a0" : ""}</text>
                <MeterBar usedPercent={window.usedPercent} colorFor={props.colorFor} dimColorFor={props.dimColorFor} />
                <text fg={props.muted}>{`${props.labelFor(window) ? ` ${props.labelFor(window)}` : ""} ${Math.round(window.usedPercent)}%${window.composerValueLabel ? ` ${window.composerValueLabel}` : ""}${window.resetAt ? ` ${formatCompactRemaining(window.resetAt)}` : ""}${index() < props.windows().length - 1 ? "\u00a0·" : ""}`}</text>
              </box>
            )}
          </For>
        </box>
      </box>
    </Show>
  )
}
