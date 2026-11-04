export type MeterThresholds = {
  warning: number
  alert: number
  critical: number
}

export type ProviderConfig = {
  enabled: boolean
}

export type UsageConfig = {
  composer: {
    showProviderName: boolean
    thresholds: MeterThresholds
  }
  providers: Record<string, ProviderConfig>
}

export const defaultUsageConfig: UsageConfig = {
  composer: {
    showProviderName: true,
    thresholds: { warning: 50, alert: 75, critical: 90 },
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
  const providerInput = isRecord(input.providers) ? input.providers : {}
  const providers = Object.fromEntries(Object.entries(providerInput).flatMap(([id, value]) => {
    if (!isRecord(value)) return []
    return [[id, { enabled: boolean(value.enabled, true) }]]
  }))

  return {
    composer: {
      showProviderName: boolean(composerInput.showProviderName, defaultUsageConfig.composer.showProviderName),
      thresholds: validThresholds ? thresholds : defaultUsageConfig.composer.thresholds,
    },
    providers,
  }
}

export function providerEnabled(config: UsageConfig, providerID: string) {
  return config.providers[providerID]?.enabled ?? true
}
