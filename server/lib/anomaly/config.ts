import type { IngestionMode } from './types'

const defaultTimeoutMs = 5_000
const defaultFreshnessMinutes = 90
const defaultSyncIntervalMs = 5 * 60_000

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value == null) {
    return fallback
  }

  return value === '1' || value.toLowerCase() === 'true'
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (value == null) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseMode(value: string | undefined): IngestionMode {
  if (value === 'real' || value === 'real-with-fallback') {
    return value
  }

  return 'mock'
}

export interface DatabaseTargetSummary {
  configured: boolean
  source: 'ANOMALY_PG_URL' | 'DATABASE_URL' | null
  host?: string
  port?: string
  databaseName?: string
}

function summarizeDatabaseTarget(postgresUrl: string | undefined, source: DatabaseTargetSummary['source']): DatabaseTargetSummary {
  if (!postgresUrl || !source) {
    return {
      configured: false,
      source: null,
    }
  }

  try {
    const parsed = new URL(postgresUrl)

    return {
      configured: true,
      source,
      host: parsed.hostname || undefined,
      port: parsed.port || undefined,
      databaseName: parsed.pathname.replace(/^\//, '') || undefined,
    }
  }
  catch {
    return {
      configured: true,
      source,
    }
  }
}

export interface AnomalyRuntimeConfig {
  ingestionMode: IngestionMode
  allowMockFallback: boolean
  autoSyncEnabled: boolean
  syncIntervalMs: number
  postgresUrl?: string
  postgresUrlSource: DatabaseTargetSummary['source']
  databaseTarget: DatabaseTargetSummary
  realSourceUrl?: string
  realSourceToken?: string
  realSourceTimeoutMs: number
  freshnessThresholdMinutes: number
  providerName: string
  validationErrors: string[]
}

export function getAnomalyRuntimeConfig(env: NodeJS.ProcessEnv = process.env): AnomalyRuntimeConfig {
  const ingestionMode = parseMode(env.ANOMALY_INGESTION_MODE)
  const allowMockFallback =
    ingestionMode === 'real-with-fallback' || parseBoolean(env.ANOMALY_ALLOW_MOCK_FALLBACK, false)
  const postgresUrlSource = env.ANOMALY_PG_URL ? 'ANOMALY_PG_URL' : env.DATABASE_URL ? 'DATABASE_URL' : null
  const postgresUrl = env.ANOMALY_PG_URL ?? env.DATABASE_URL
  const realSourceUrl = env.ANOMALY_REAL_SOURCE_URL
  const validationErrors: string[] = []

  if (ingestionMode !== 'mock' && !realSourceUrl) {
    validationErrors.push('ANOMALY_REAL_SOURCE_URL is required when real ingestion is enabled.')
  }

  if (ingestionMode !== 'mock' && !postgresUrl) {
    validationErrors.push('ANOMALY_PG_URL or DATABASE_URL is required when real ingestion is enabled.')
  }

  return {
    ingestionMode,
    allowMockFallback,
    autoSyncEnabled: parseBoolean(env.ANOMALY_AUTO_SYNC_ENABLED, ingestionMode === 'real'),
    syncIntervalMs: parsePositiveInteger(env.ANOMALY_SYNC_INTERVAL_MS, defaultSyncIntervalMs),
    postgresUrl,
    postgresUrlSource,
    databaseTarget: summarizeDatabaseTarget(postgresUrl, postgresUrlSource),
    realSourceUrl,
    realSourceToken: env.ANOMALY_REAL_SOURCE_TOKEN,
    realSourceTimeoutMs: parsePositiveInteger(env.ANOMALY_REAL_SOURCE_TIMEOUT_MS, defaultTimeoutMs),
    freshnessThresholdMinutes: parsePositiveInteger(
      env.ANOMALY_REAL_SOURCE_FRESHNESS_MINUTES,
      defaultFreshnessMinutes,
    ),
    providerName: env.ANOMALY_REAL_SOURCE_PROVIDER ?? 'http-json',
    validationErrors,
  }
}

export const anomalyRuntimeConfig = getAnomalyRuntimeConfig()