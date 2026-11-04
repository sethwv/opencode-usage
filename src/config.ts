export type MeterThresholds = {
  warning: number
  alert: number
  critical: number
}

export type ProviderConfig = {
  enabled: boolean
}

export type MeterConfig = {
  enabled: boolean
}

export type MeterLabel = "short" | "word" | "none"

export type UsageSource =
  | { mode: "current-model" }
  | { mode: "provider"; providerID: string }

export type ComposerConfig = {
  showProviderName: boolean
  meterLabel: MeterLabel
  thresholds: MeterThresholds
  meters: Record<string, MeterConfig>
  source: UsageSource
}

export type ComposerPreferences = Pick<ComposerConfig, "showProviderName" | "meterLabel" | "meters" | "source">

export type UsageConfig = {
  composer: ComposerConfig
  providers: Record<string, ProviderConfig>
}

export const defaultUsageConfig: UsageConfig = {
  composer: {
    showProviderName: true,
    meterLabel: "short",
    thresholds: { warning: 50, alert: 75, critical: 90 },
    meters: {},
    source: { mode: "current-model" },
  },
  providers: {},
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

const boolean = (value: unknown, fallback: boolean) => typeof value === "boolean" ? value : fallback

const threshold = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : fallback

export function parseUsageConfig(options: unknown): UsageConfig {
  const input = isRecord(options) ? options : {}
  const composerInput = isRecord(input.composer) ? input.composer : {}
  const thresholdInput = isRecord(composerInput.thresholds) ? composerInput.thresholds : {}
  const thresholds = {
    warning: threshold(thresholdInput.warning, defaultUsageConfig.composer.thresholds.warning),
    alert: threshold(thresholdInput.alert, defaultUsageConfig.composer.thresholds.alert),
    critical: threshold(thresholdInput.critical, defaultUsageConfig.composer.thresholds.critical),
  }
  const validThresholds = thresholds.warning < thresholds.alert && thresholds.alert < thresholds.critical
  const meterInput = isRecord(composerInput.meters) ? composerInput.meters : {}
  const meters = Object.fromEntries(Object.entries(meterInput).flatMap(([kind, value]) => {
    if (!isRecord(value)) return []
    return [[kind, { enabled: boolean(value.enabled, true) }]]
  }))
  const providerInput = isRecord(input.providers) ? input.providers : {}
  const providers = Object.fromEntries(Object.entries(providerInput).flatMap(([id, value]) => {
    if (!isRecord(value)) return []
    return [[id, { enabled: boolean(value.enabled, true) }]]
  }))
  const sourceInput = isRecord(composerInput.source) ? composerInput.source : {}
  const meterLabel = composerInput.meterLabel === "word" || composerInput.meterLabel === "none" ? composerInput.meterLabel : defaultUsageConfig.composer.meterLabel
  const source: UsageSource = sourceInput.mode === "provider" && typeof sourceInput.providerID === "string" && sourceInput.providerID
    ? { mode: "provider", providerID: sourceInput.providerID }
    : defaultUsageConfig.composer.source

  return {
    composer: {
      showProviderName: boolean(composerInput.showProviderName, defaultUsageConfig.composer.showProviderName),
      meterLabel,
      thresholds: validThresholds ? thresholds : defaultUsageConfig.composer.thresholds,
      meters,
      source,
    },
    providers,
  }
}

export function providerEnabled(config: UsageConfig, providerID: string) {
  return config.providers[providerID]?.enabled ?? true
}

export function composerPreferences(config: UsageConfig): ComposerPreferences {
  return {
    showProviderName: config.composer.showProviderName,
    meterLabel: config.composer.meterLabel,
    meters: config.composer.meters,
    source: config.composer.source,
  }
}

export function meterEnabled(composer: Pick<ComposerConfig, "meters">, kind: string) {
  return composer.meters[kind]?.enabled ?? true
}
