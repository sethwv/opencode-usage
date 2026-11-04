import { Plugin } from "@opencode/plugin/tui"
import { RGBA } from "@opentui/core"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import { composerPreferences, meterEnabled, parseUsageConfig } from "./config.js"
import { Usage } from "./rpc.js"
import { ComposerMeters } from "./tui/composer.js"
import { UsageDialog, type DialogSetting } from "./tui/dialog.js"
import { meterLabel } from "./tui/meter.js"
import { emptySnapshot, formatDetailBar, formatExactReset, formatFullRemaining, type UsageAction, type UsageSnapshot } from "./usage/types.js"

export default Plugin.define({
  id: "opencode-usage.tui",
  setup(context) {
    const config = parseUsageConfig(context.options)
    const [preferences, updatePreferences] = context.storage.store("composer-preferences-v3", { initial: composerPreferences(config) })
    const usage = context.client.rpc(Usage)
    const [snapshot, setSnapshot] = createSignal<UsageSnapshot>(emptySnapshot())
    const [dialogSnapshot, setDialogSnapshot] = createSignal<UsageSnapshot>(emptySnapshot())
    const [providers, setProviders] = createSignal<Array<{ id: string; name: string; meterKinds: string[] }>>([])
    const [armedActionID, setArmedActionID] = createSignal<string>()
    const [dialogTab, setDialogTab] = createSignal<string>("settings")
    const [detailsOpen, setDetailsOpen] = createSignal(false)
    const [settingsIndex, setSettingsIndex] = createSignal(0)
    const composerWindows = () => snapshot().windows.filter((window) => meterEnabled(preferences, window.kind ?? window.id))
    const dialogWindows = () => dialogSnapshot().windows.filter((window) => meterEnabled(preferences, window.kind ?? window.id))
    const meterKinds = () => [...new Set([...Object.keys(preferences.meters), ...providers().flatMap((provider) => provider.meterKinds), ...dialogSnapshot().windows.map((window) => window.kind ?? window.id)])].toSorted()
    const currentModelProviderID = () => context.ui.model.current()?.providerID
    const usageProviderID = () => preferences.source.mode === "provider" ? preferences.source.providerID : currentModelProviderID()
    const providerInput = (providerID = usageProviderID()) => ({ providerID })
    const selectedProviderID = () => dialogTab() === "settings" ? usageProviderID() : dialogTab()

    const loadComposer = async (force = false, providerID = usageProviderID()) => {
      try {
        const next = force ? await usage.refresh(providerInput(providerID)) : await usage.get(providerInput(providerID))
        if (providerID === usageProviderID()) setSnapshot(next as UsageSnapshot)
      } catch {
        if (providerID === usageProviderID()) setSnapshot({ ...emptySnapshot(providerID), error: "Usage is temporarily unavailable." })
      }
    }

    const loadDialog = async (force = false, providerID = selectedProviderID()) => {
      try {
        const next = force ? await usage.refresh(providerInput(providerID)) : await usage.get(providerInput(providerID))
        if (providerID === selectedProviderID()) setDialogSnapshot(next as UsageSnapshot)
      } catch {
        if (providerID === selectedProviderID()) setDialogSnapshot({ ...emptySnapshot(providerID), error: "Usage is temporarily unavailable." })
      }
    }

    const loadProviders = () => void usage.providers({}).then((result) => setProviders(result as Array<{ id: string; name: string; meterKinds: string[] }>)).catch(() => setProviders([]))

    loadProviders()

    createEffect(() => {
      const providerID = usageProviderID()
      setArmedActionID(undefined)
      setSnapshot(emptySnapshot(providerID))
      void loadComposer(false, providerID)
    })

    const runAction = (action: UsageAction) => {
      if (action.confirmationMessage && armedActionID() !== action.id) {
        setArmedActionID(action.id)
        context.ui.toast.show({ message: action.confirmationMessage, variant: "warning" })
        return
      }

      setArmedActionID(undefined)
      const providerID = selectedProviderID()
      void usage.runAction({ ...providerInput(providerID), actionID: action.id }).then(async (result) => {
        const outcome = result as { status: "success" | "failed" | "unsupported"; message?: string }
        if (outcome.status === "success") {
          if (outcome.message) context.ui.toast.show({ message: outcome.message, variant: "success" })
          if (!action.refresh) return
          await loadDialog(true, providerID)
          if (providerID === usageProviderID()) await loadComposer(true, providerID)
          context.ui.dialog.clear()
          if (dialogSnapshot().windows.length > 0 || dialogSnapshot().sections.length > 0) showDetails()
          return
        }
        context.ui.toast.show({ message: outcome.message ?? "Could not complete action.", variant: "error" })
      }).catch(() => context.ui.toast.show({ message: "Could not complete action.", variant: "error" }))
    }

    const showDetails = () => {
      setDetailsOpen(true)
      setArmedActionID(undefined)
      loadProviders()
      setDialogTab(usageProviderID() ?? "settings")
      setDialogSnapshot(snapshot())
      void loadDialog(false, usageProviderID())
      const refresh = () => {
        void loadDialog(true)
      }

      context.ui.dialog.set({ size: "medium", centered: context.renderer.height >= 18 })
      context.ui.dialog.show(() => (
        <UsageDialog
          providers={providers}
          selectedTab={dialogTab}
          snapshot={dialogSnapshot}
          windows={dialogWindows}
          settings={settingsRows}
          muted={muted}
          textBase={textBase}
          cardWidth={cardWidth}
          settingsWidth={settingsWidth}
          compact={context.renderer.height < 18}
          selectedSetting={settingsIndex}
          colorFor={barColor}
          dimColorFor={dimBarColor}
          actionLabel={(action) => armedActionID() === action.id ? action.confirmLabel ?? action.label : action.label}
          onSelectProvider={selectProvider}
          onSelectSettings={openSettings}
          onSelectSetting={setSettingsIndex}
          onRefresh={refresh}
          onRunAction={runAction}
        />
      ), () => setDetailsOpen(false))
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
    const textBase = (context.theme as any).text?.base ?? (context.theme as any).textBase ?? muted
    const warning = (context.theme as any).text?.feedback?.warning?.base ?? muted
    const error = (context.theme as any).text?.feedback?.error?.base ?? warning
    const orange = RGBA.fromValues((warning.r + error.r) / 2, (warning.g + error.g) / 2, (warning.b + error.b) / 2, (warning.a + error.a) / 2)
    const barColor = (usedPercent: number) => {
      const { warning: warningThreshold, alert, critical } = config.composer.thresholds
      const color = usedPercent > critical ? error : usedPercent > alert ? orange : usedPercent > warningThreshold ? warning : muted
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
    const dialogContentWidth = () => Math.max(20, Math.min(60, context.renderer.width - 2) - 4)
    const cardWidth = () => {
      const lines = [...dialogWindows().flatMap(windowLines), ...dialogSnapshot().sections.flatMap((section) => [section.title, ...section.lines])]
      return Math.min(Math.max(20, ...lines.map((line) => [...line].length)) + 4, dialogContentWidth())
    }
    const settingsWidth = () => Math.min(Math.max(cardWidth(), ...settingsRows().map((row) => [...row.label, ...row.value].length + 4), 24), dialogContentWidth())
    const toggleProviderName = () => void updatePreferences((draft) => {
      draft.showProviderName = !draft.showProviderName
    })
    const cycleMeterLabel = () => void updatePreferences((draft) => {
      draft.meterLabel = draft.meterLabel === "short" ? "word" : draft.meterLabel === "word" ? "none" : "short"
    })
    const toggleMeter = (kind: string) => void updatePreferences((draft) => {
      draft.meters[kind] = { enabled: !meterEnabled(draft, kind) }
    })
    const toggleSource = () => {
      if (preferences.source.mode === "provider") {
        void updatePreferences((draft) => { draft.source = { mode: "current-model" } })
        return
      }
      const providerID = currentModelProviderID()
      if (providerID) void updatePreferences((draft) => { draft.source = { mode: "provider", providerID } })
    }
    const resetPreferences = () => void updatePreferences((draft) => {
      const defaults = composerPreferences(config)
      draft.showProviderName = defaults.showProviderName
      draft.meters = defaults.meters
      draft.source = defaults.source
    })
    const selectProvider = (providerID: string) => {
      setDialogTab(providerID)
      void loadDialog(false, providerID)
    }
    const openSettings = () => {
      setSettingsIndex(0)
      setDialogTab("settings")
    }
    function settingsRows(): DialogSetting[] {
      return [
        { group: "Composer", label: "Provider prefix", value: preferences.showProviderName ? "On" : "Off", run: toggleProviderName },
        { group: "Composer", label: "Meter label", value: preferences.meterLabel[0].toUpperCase() + preferences.meterLabel.slice(1), run: cycleMeterLabel },
        { group: "Composer", label: "Usage source", value: preferences.source.mode === "provider" ? `Pinned: ${preferences.source.providerID}` : "Follow active model", run: toggleSource },
        ...meterKinds().map((kind) => ({ group: "Meters", label: kind, value: meterEnabled(preferences, kind) ? "On" : "Off", run: () => toggleMeter(kind) })),
        { group: "Reset", label: "Reset settings", value: "Defaults", run: resetPreferences },
      ]
    }
    const dialogTabs = () => [...providers().map((provider) => provider.id), "settings"]
    const moveTab = (direction: number) => {
      const tabs = dialogTabs()
      const index = Math.max(0, tabs.indexOf(dialogTab()))
      const next = tabs[(index + direction + tabs.length) % tabs.length]
      if (next === "settings") openSettings()
      else selectProvider(next)
    }
    const moveSetting = (direction: number) => {
      const rows = settingsRows()
      if (!rows.length) return
      setSettingsIndex((index) => (index + direction + rows.length) % rows.length)
    }
    const activateSetting = () => settingsRows()[settingsIndex()]?.run()

    context.keymap.layer(() => ({
      mode: "global",
      priority: 20,
      commands: [
        { id: "usage.dialog.previous-tab", bind: "left", enabled: detailsOpen, run: () => moveTab(-1) },
        { id: "usage.dialog.next-tab", bind: "right", enabled: detailsOpen, run: () => moveTab(1) },
        { id: "usage.dialog.previous-setting", bind: "up", enabled: () => detailsOpen() && dialogTab() === "settings", run: () => moveSetting(-1) },
        { id: "usage.dialog.next-setting", bind: "down", enabled: () => detailsOpen() && dialogTab() === "settings", run: () => moveSetting(1) },
        { id: "usage.dialog.toggle-setting", bind: "enter", enabled: () => detailsOpen() && dialogTab() === "settings", run: activateSetting },
        { id: "usage.dialog.refresh", bind: "r", enabled: () => detailsOpen() && dialogTab() !== "settings", run: () => void loadDialog(true) },
        ...dialogSnapshot().actions.slice(0, 9).map((action, index) => ({
          id: `usage.dialog.action.${action.id}`,
          bind: `${index + 1}`,
          enabled: () => detailsOpen() && dialogTab() !== "settings",
          run: () => runAction(action),
        })),
      ],
    }))
    function Meters() {
      onMount(() => {
        const unsubscribe = usage.events.on("updated", (event) => {
          const next = event.data as UsageSnapshot
          if (next.providerID === usageProviderID()) setSnapshot(next)
          if (next.providerID === selectedProviderID()) setDialogSnapshot(next)
        })
        onCleanup(unsubscribe)
      })

      return (
        <ComposerMeters
          snapshot={snapshot}
          windows={composerWindows}
          showProviderName={() => preferences.showProviderName}
          labelFor={(window) => meterLabel(window, preferences.meterLabel)}
          muted={muted}
          colorFor={barColor}
          dimColorFor={dimBarColor}
          onShowDetails={showDetails}
        />
      )
    }

    return context.ui.slot({ append: "session.composer.top", render: () => <Meters /> })
  },
})
