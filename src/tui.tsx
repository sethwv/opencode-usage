import { Plugin } from "@opencode/plugin/tui"
import { RGBA } from "@opentui/core"
import { For, Show, createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { Usage } from "./rpc.js"
import { barSegments, emptySnapshot, formatCompactRemaining, formatDetailBar, formatExactReset, formatFullRemaining, type UsageAction, type UsageSnapshot } from "./usage/types.js"

export default Plugin.define({
  id: "opencode-usage.tui",
  setup(context) {
    const usage = context.client.rpc(Usage)
    const [snapshot, setSnapshot] = createSignal<UsageSnapshot>(emptySnapshot())
    const [armedActionID, setArmedActionID] = createSignal<string>()
    const activeProviderID = () => context.ui.model.current()?.providerID
    const providerInput = (providerID = activeProviderID()) => ({ providerID })

    const load = async (force = false, providerID = activeProviderID()) => {
      try {
        const next = force ? await usage.refresh(providerInput(providerID)) : await usage.get(providerInput(providerID))
        if (providerID === activeProviderID()) setSnapshot(next as UsageSnapshot)
      } catch {
        if (providerID === activeProviderID()) setSnapshot({ ...emptySnapshot(providerID), error: "Usage is temporarily unavailable." })
      }
    }

    createEffect(() => {
      const providerID = activeProviderID()
      setArmedActionID(undefined)
      setSnapshot(emptySnapshot(providerID))
      void load(false, providerID)
    })

    const runAction = (action: UsageAction) => {
      if (action.confirmationMessage && armedActionID() !== action.id) {
        setArmedActionID(action.id)
        context.ui.toast.show({ message: action.confirmationMessage, variant: "warning" })
        return
      }

      setArmedActionID(undefined)
      void usage.runAction({ ...providerInput(), actionID: action.id }).then(async (result) => {
        const outcome = result as { status: "success" | "failed" | "unsupported"; message?: string }
        if (outcome.status === "success") {
          if (outcome.message) context.ui.toast.show({ message: outcome.message, variant: "success" })
          if (!action.refresh) return
          await load(true)
          context.ui.dialog.clear()
          if (snapshot().windows.length > 0 || snapshot().sections.length > 0) showDetails()
          return
        }
        context.ui.toast.show({ message: outcome.message ?? "Could not complete action.", variant: "error" })
      }).catch(() => context.ui.toast.show({ message: "Could not complete action.", variant: "error" }))
    }

    const showDetails = () => {
      setArmedActionID(undefined)
      const refresh = () => {
        context.ui.dialog.clear()
        void load(true).then(() => {
            if (snapshot().windows.length > 0 || snapshot().sections.length > 0) showDetails()
        })
      }

      const action = (label: string, run: () => void) => (
        <box
          border
          borderColor={muted}
          paddingLeft={1}
          paddingRight={1}
          onMouseUp={(event: any) => {
            event.preventDefault()
            run()
          }}
        >
          <text fg={muted}>{label}</text>
        </box>
      )

      context.ui.dialog.set({ size: "medium", centered: true })
      context.ui.dialog.show(() => (
        <box flexDirection="column" alignItems="center" padding={1} gap={1}>
          <text fg={muted}>{snapshot().providerName || "Usage"}</text>
          <For each={snapshot().windows}>
            {(window) => (
              <box width={cardWidth()} flexDirection="column" alignItems="center" border borderColor={muted} paddingLeft={1} paddingRight={1}>
                <text>{`${windowName(window)} · ${Math.round(window.usedPercent)}%${window.valueLabel ? ` · ${window.valueLabel}` : ""}`}</text>
                <box flexDirection="row">
                  <text fg={barColor(window.usedPercent)}>{barSegments(window.usedPercent, 20).filled}</text>
                  <text fg={dimBarColor(window.usedPercent)}>{barSegments(window.usedPercent, 20).empty}</text>
                </box>
                {window.resetAt && <text fg={muted}>{`Resets ${formatExactReset(window.resetAt)} (${formatFullRemaining(window.resetAt)} remaining)`}</text>}
              </box>
            )}
          </For>
          <For each={snapshot().sections}>
            {(section) => (
              <box width={cardWidth()} flexDirection="column" alignItems="center" border borderColor={muted} paddingLeft={1} paddingRight={1}>
                <text>{section.title}</text>
                <For each={section.lines}>{(line) => <text fg={muted}>{line}</text>}</For>
              </box>
            )}
          </For>
          <box flexDirection="row" justifyContent="center" gap={1}>
            {action("[ Refresh ]", refresh)}
            <For each={snapshot().actions}>
              {(item) => action(`[ ${armedActionID() === item.id ? item.confirmLabel ?? item.label : item.label} ]`, () => runAction(item))}
            </For>
          </box>
          <text fg={muted}>Esc to close</text>
        </box>
      ))
    }

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "usage.show",
          title: "Show usage",
          group: "Usage",
          palette: true,
          slash: { name: "usage" },
          run: () => {
            if (snapshot().windows.length > 0 || snapshot().sections.length > 0) showDetails()
            else context.ui.toast.show({ message: snapshot().error ?? "Usage is unavailable.", variant: "info" })
          },
        },
      ],
    }))

    const muted = (context.theme as any).text?.muted ?? (context.theme as any).textMuted
    const composerBackground = (context.theme as any).background?.raised?.base
    const meterBackground = composerBackground
      ? RGBA.fromValues(composerBackground.r * 0.93, composerBackground.g * 0.93, composerBackground.b * 0.93, composerBackground.a)
      : undefined
    const warning = (context.theme as any).text?.feedback?.warning?.base ?? muted
    const error = (context.theme as any).text?.feedback?.error?.base ?? warning
    const orange = RGBA.fromValues((warning.r + error.r) / 2, (warning.g + error.g) / 2, (warning.b + error.b) / 2, (warning.a + error.a) / 2)
    const barColor = (usedPercent: number) => {
      const color = usedPercent > 90 ? error : usedPercent > 75 ? orange : usedPercent > 50 ? warning : muted
      return RGBA.fromValues(color.r * 0.85 + muted.r * 0.15, color.g * 0.85 + muted.g * 0.15, color.b * 0.85 + muted.b * 0.15, color.a * 0.85 + muted.a * 0.15)
    }
    const dimBarColor = (usedPercent: number) => {
      const color = barColor(usedPercent)
      return RGBA.fromValues(color.r * 0.4 + muted.r * 0.6, color.g * 0.4 + muted.g * 0.6, color.b * 0.4 + muted.b * 0.6, color.a * 0.4 + muted.a * 0.6)
    }
    const windowName = (window: { label: string; title?: string }) => window.title ?? (window.label === "W" ? "Week" : "Session")
    const windowLines = (window: UsageSnapshot["windows"][number]) => [
      `${windowName(window)} · ${Math.round(window.usedPercent)}%${window.valueLabel ? ` · ${window.valueLabel}` : ""}`,
      formatDetailBar(window.usedPercent),
      ...(window.resetAt ? [`Resets ${formatExactReset(window.resetAt)} (${formatFullRemaining(window.resetAt)} remaining)`] : []),
    ]
    const cardWidth = () => {
      const lines = [...snapshot().windows.flatMap(windowLines), ...snapshot().sections.flatMap((section) => [section.title, ...section.lines])]
      return Math.max(...lines.map((line) => [...line].length)) + 4
    }

    function Meters() {
      onMount(() => {
        const unsubscribe = usage.events.on("updated", (event) => {
          const next = event.data as UsageSnapshot
          if (next.providerID === activeProviderID()) setSnapshot(next)
        })
        onCleanup(unsubscribe)
      })

      return (
        <Show when={snapshot().windows.length > 0}>
          <box width="100%" height={1} flexDirection="row" backgroundColor={meterBackground} shouldFill>
            <box width="100%" height={1} flexDirection="row" justifyContent="center" paddingLeft={1} paddingRight={1}>
              <Show when={snapshot().providerName}>
                <text fg={muted}>{`${snapshot().providerName}: `}</text>
              </Show>
              <For each={snapshot().windows}>
                {(window, index) => (
                  <>
                    <box
                      flexDirection="row"
                      onMouseUp={(event: any) => {
                        event.preventDefault()
                        showDetails()
                      }}
                    >
                      <text fg={muted}>{index() > 0 ? "\u00a0" : ""}</text>
                      <text fg={barColor(window.usedPercent)}>{barSegments(window.usedPercent).filled}</text>
                      <text fg={dimBarColor(window.usedPercent)}>{barSegments(window.usedPercent).empty}</text>
                      <text fg={muted}>{`${window.label ? ` ${window.label}` : ""} ${Math.round(window.usedPercent)}%${window.composerValueLabel ? ` ${window.composerValueLabel}` : ""}${window.resetAt ? ` ${formatCompactRemaining(window.resetAt)}` : ""}${index() < snapshot().windows.length - 1 ? "\u00a0·" : ""}`}</text>
                    </box>
                  </>
                )}
              </For>
            </box>
          </box>
        </Show>
      )
    }

    return context.ui.slot({ append: "session.composer.top", render: () => <Meters /> })
  },
})
