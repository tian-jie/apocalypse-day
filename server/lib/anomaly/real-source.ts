import { anomalyRuntimeConfig, type AnomalyRuntimeConfig } from './config'
import { listFixtureScenarioIds } from './mock-data'
import type {
  AircraftSnapshotIngestionSource,
  ContextMarker,
  FixtureScenarioId,
  HourlyAircraftSnapshot,
  IngestionMetadata,
  SnapshotIngestionQuery,
  SnapshotIngestionResult,
} from './types'

const knownContextMarkers: ContextMarker[] = [
  'holiday',
  'weather',
  'conference',
  'sports-event',
  'maintenance',
]

interface RealProviderResponse {
  snapshots?: unknown[]
  data?: unknown[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getNumber(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return undefined
}

function getString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return undefined
}

function normalizeContextMarkers(value: unknown): ContextMarker[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is ContextMarker =>
    typeof item === 'string' && knownContextMarkers.includes(item as ContextMarker),
  )
}

function normalizeKeyCityDepartures(value: unknown) {
  if (!isRecord(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, count]) => typeof count === 'number' && Number.isFinite(count)),
  )
}

function normalizeSnapshot(
  entry: unknown,
  scenarioId: FixtureScenarioId,
): HourlyAircraftSnapshot {
  if (!isRecord(entry)) {
    throw new Error('Real provider returned a snapshot entry with an invalid shape.')
  }

  const observedAt = getString(entry, 'observedAt', 'observed_at', 'timestamp')
  if (!observedAt) {
    throw new Error('Real provider snapshot is missing observedAt.')
  }

  return {
    id: getString(entry, 'id', 'snapshotId') ?? `${scenarioId}-${observedAt}`,
    scenarioId,
    observedAt,
    takeoffs: getNumber(entry, 'takeoffs') ?? 0,
    landings: getNumber(entry, 'landings') ?? 0,
    activeAircraft: getNumber(entry, 'activeAircraft', 'active_aircraft') ?? 0,
    keyCityDepartures: normalizeKeyCityDepartures(
      entry.keyCityDepartures ?? entry.key_city_departures,
    ),
    destinationConcentration:
      getNumber(entry, 'destinationConcentration', 'destination_concentration') ?? 0,
    crossBorderRatio: getNumber(entry, 'crossBorderRatio', 'cross_border_ratio') ?? 0,
    missingIdentificationRatio:
      getNumber(entry, 'missingIdentificationRatio', 'missing_identification_ratio') ?? 0,
    contextMarkers: normalizeContextMarkers(entry.contextMarkers ?? entry.context_markers),
  }
}

function toFreshness(observedAt: string, thresholdMinutes: number): IngestionMetadata['freshness'] {
  const ageMs = Date.now() - new Date(observedAt).getTime()
  return ageMs > thresholdMinutes * 60_000 ? 'stale' : 'fresh'
}

export class HttpRealAircraftSnapshotSource implements AircraftSnapshotIngestionSource {
  constructor(private readonly config: AnomalyRuntimeConfig = anomalyRuntimeConfig) {}

  listScenarioIds() {
    return listFixtureScenarioIds()
  }

  async getSnapshots(query: SnapshotIngestionQuery): Promise<SnapshotIngestionResult> {
    if (!this.config.realSourceUrl) {
      throw new Error('Real ingestion mode is enabled without ANOMALY_REAL_SOURCE_URL.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.realSourceTimeoutMs)

    try {
      const response = await fetch(this.config.realSourceUrl, {
        headers: this.config.realSourceToken
          ? { Authorization: `Bearer ${this.config.realSourceToken}` }
          : undefined,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Real provider request failed with status ${response.status}.`)
      }

      const payload = (await response.json()) as RealProviderResponse
      const entries = payload.snapshots ?? payload.data ?? []
      if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error('Real provider returned no snapshots.')
      }

      const snapshots = entries.map((entry) => normalizeSnapshot(entry, query.scenarioId))
      snapshots.sort((left, right) => new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime())

      const latestObservedAt = snapshots[snapshots.length - 1]?.observedAt
      if (!latestObservedAt) {
        throw new Error('Real provider returned no usable snapshots.')
      }

      const freshness = toFreshness(latestObservedAt, this.config.freshnessThresholdMinutes)

      return {
        scenarioId: query.scenarioId,
        snapshots,
        ingestion: {
          requestedMode: this.config.ingestionMode,
          sourceKind: 'real',
          providerName: this.config.providerName,
          sourceStatus: freshness === 'fresh' ? 'healthy' : 'degraded',
          freshness,
          degraded: freshness !== 'fresh',
          providerObservedAt: latestObservedAt,
          lastSuccessfulObservedAt: latestObservedAt,
          persistedAt: new Date().toISOString(),
          fallbackReason: freshness === 'fresh' ? undefined : 'Real provider data is older than freshness threshold.',
          notes: [],
        },
      }
    }
    finally {
      clearTimeout(timeout)
    }
  }
}