import { Plugin } from "@opencode/plugin/tui"
import { For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { CodexUsage } from "./rpc.js"
import { emptySnapshot, formatBar, formatCompactRemaining, formatDetailBar, formatExactReset, formatFullRemaining, type UsageSnapshot } from "./usage/types.js"

export default Plugin.define({
  id: "codex-usage.tui",
  setup(context) {
    const usage = context.client.rpc(CodexUsage)
    const [snapshot, setSnapshot] = createSignal<UsageSnapshot>(emptySnapshot())
    const [resetArmed, setResetArmed] = createSignal(false)
    const providerInput = () => ({ providerID: context.ui.model.current()?.providerID })

    const load = async (force = false) => {
      try {
        const next = force ? await usage.refresh(providerInput()) : await usage.get(providerInput())
        setSnapshot(next as UsageSnapshot)
      } catch {
        setSnapshot({ ...emptySnapshot(), error: "Usage is temporarily unavailable." })
      }
    }

    const openDashboard = async () => {
      const result = await usage.openDashboard(providerInput())
      if (!(result as { opened: boolean }).opened) {
        context.ui.toast.show({ message: "Could not open the Codex usage dashboard.", variant: "error" })
      }
    }

    const useReset = () => {
      if (!resetArmed()) {
        setResetArmed(true)
        context.ui.toast.show({ message: "Click Use banked reset again to confirm.", variant: "warning" })
        return
      }

      setResetArmed(false)
      void usage.consumeReset(providerInput()).then(async (result) => {
        const outcome = (result as { outcome: string }).outcome
        if (outcome === "reset") {
          context.ui.toast.show({ message: "Banked reset applied.", variant: "success" })
          await load(true)
          context.ui.dialog.clear()
          if (snapshot().windows.length > 0) showDetails()
          return
        }
        context.ui.toast.show({ message: `Could not apply reset: ${outcome.replaceAll("_", " ")}.`, variant: "error" })
      }).catch(() => context.ui.toast.show({ message: "Could not apply reset.", variant: "error" }))
    }

    const showDetails = () => {
      setResetArmed(false)
      const refresh = () => {
        context.ui.dialog.clear()
        void load(true).then(() => {
          if (snapshot().windows.length > 0) showDetails()
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
          <text fg={muted}>Codex usage</text>
          <For each={snapshot().windows}>
            {(window) => (
              <box width={cardWidth()} flexDirection="column" alignItems="center" border borderColor={muted} paddingLeft={1} paddingRight={1}>
                <text>{`${windowName(window)} · ${Math.round(window.usedPercent)}%`}</text>
                <text>{formatDetailBar(window.usedPercent)}</text>
                <text fg={muted}>{`Resets ${formatExactReset(window.resetAt)} (${formatFullRemaining(window.resetAt)} remaining)`}</text>
              </box>
            )}
          </For>
          <Show when={(snapshot().bankedResetCount ?? 0) > 0}>
            <box width={cardWidth()} flexDirection="column" alignItems="center" border borderColor={muted} paddingLeft={1} paddingRight={1}>
              <text>Banked resets</text>
              <text fg={muted}>{`${snapshot().bankedResetCount} available`}</text>
              <For each={snapshot().bankedResets ?? []}>
                {(reset, index) => (
                  <text fg={muted}>{`Reset ${index() + 1}: ${reset.expiresAt ? `expires ${formatExactReset(reset.expiresAt)}` : "no expiry reported"}`}</text>
                )}
              </For>
            </box>
          </Show>
          <box flexDirection="row" justifyContent="center" gap={1}>
            {action("[ Refresh ]", refresh)}
            {action("[ Usage ]", () => void openDashboard())}
            {(snapshot().bankedResetCount ?? 0) > 0 && action(resetArmed() ? "[ Confirm reset ]" : `[ Reset (${snapshot().bankedResetCount}) ]`, useReset)}
          </box>
          <text fg={muted}>Esc to close</text>
        </box>
      ))
    }

    context.keymap.layer(() => ({
      mode: "global",
      commands: [
        {
          id: "codex-usage.show",
          title: "Show Codex usage",
          group: "Codex usage",
          palette: true,
          slash: { name: "usage" },
          run: () => {
            const first = snapshot().windows[0]
            if (first) showDetails()
            else context.ui.toast.show({ message: snapshot().error ?? "Usage is unavailable.", variant: "info" })
          },
        },
      ],
    }))

    const muted = (context.theme as any).text?.muted ?? (context.theme as any).textMuted
    const windowName = (window: { label: string }) => (window.label === "W" ? "Week" : "Session")
    const windowLines = (window: UsageSnapshot["windows"][number]) => [
      `${windowName(window)} · ${Math.round(window.usedPercent)}%`,
      formatDetailBar(window.usedPercent),
      `Resets ${formatExactReset(window.resetAt)} (${formatFullRemaining(window.resetAt)} remaining)`,
    ]
    const bankedResetLines = () => [
      "Banked resets",
      `${snapshot().bankedResetCount} available`,
      ...(snapshot().bankedResets ?? []).map((reset, index) =>
        `Reset ${index + 1}: ${reset.expiresAt ? `expires ${formatExactReset(reset.expiresAt)}` : "no expiry reported"}`,
      ),
    ]
    const cardWidth = () => {
      const lines = [...snapshot().windows.flatMap(windowLines), ...(snapshot().bankedResetCount ? bankedResetLines() : [])]
      return Math.max(...lines.map((line) => [...line].length)) + 4
    }

    function Meters() {
      onMount(() => {
        void load()
        const unsubscribe = usage.events.on("updated", (event) => {
          setSnapshot(event.data as UsageSnapshot)
        })
        onCleanup(unsubscribe)
      })

      return (
        <Show when={snapshot().windows.length > 0}>
          <box width="100%" height={1} flexDirection="row" justifyContent="center">
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
                    <text fg={muted}>{`${index() > 0 ? "\u00a0" : ""}${formatBar(window.usedPercent)} ${window.label} ${Math.round(window.usedPercent)}% ${formatCompactRemaining(window.resetAt)}${index() < snapshot().windows.length - 1 ? "\u00a0·" : ""}`}</text>
                  </box>
                </>
              )}
            </For>
          </box>
        </Show>
      )
    }

    return context.ui.slot({ append: "session.composer.top", render: () => <Meters /> })
  },
})
