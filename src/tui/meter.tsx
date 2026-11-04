import type { RGBA } from "@opentui/core"
import { barSegments, type UsageSnapshot } from "../usage/types.js"
import type { MeterLabel } from "../config.js"

export function meterLabel(window: UsageSnapshot["windows"][number], mode: MeterLabel) {
  switch (mode) {
    case "none":
      return ""
    case "word":
      return window.title ?? (window.label === "W" ? "Week" : window.label === "S" ? "Session" : window.label)
    case "short":
      return window.label
  }
}

export function MeterBar(props: {
  usedPercent: number
  width?: number
  colorFor: (usedPercent: number) => RGBA
  dimColorFor: (usedPercent: number) => RGBA
}) {
  const width = props.width ?? 10
  const segments = () => barSegments(props.usedPercent, width)
  return (
    <box flexDirection="row">
      <text fg={props.colorFor(props.usedPercent)}>{segments().filled}</text>
      <text fg={props.dimColorFor(props.usedPercent)}>{segments().empty}</text>
    </box>
  )
}
