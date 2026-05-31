import { describe, expect, it, vi, afterEach } from 'vitest'

import { getAnomalyRuntimeConfig } from '../server/lib/anomaly/config'
import { ResolvedAircraftSnapshotSource } from '../server/lib/anomaly/ingestion'
import { NoopSnapshotRepository, PgSnapshotRepository } from '../server/lib/anomaly/repository'
import { HttpRealAircraftSnapshotSource } from '../server/lib/anomaly/real-source'
import type {
  AircraftSnapshotIngestionSource,
  FixtureScenarioId,
  SnapshotIngestionQuery,
  SnapshotIngestionResult,
} from '../server/lib/anomaly/types'

class StaticSource implements AircraftSnapshotIngestionSource {
  constructor(private readonly result: SnapshotIngestionResult) {}

  listScenarioIds() {
    return ['normal-day', 'holiday-spike', 'extreme-anomaly'] as FixtureScenarioId[]
  }

  async getSnapshots(_query: SnapshotIngestionQuery) {
    return this.result
  }
}

class ThrowingSource implements AircraftSnapshotIngestionSource {
  listScenarioIds() {
    return ['normal-day', 'holiday-spike', 'extreme-anomaly'] as FixtureScenarioId[]
  }

  async getSnapshots() {
    throw new Error('provider offline')
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('real ingestion and persistence', () => {
  it('normalizes provider payload aliases into hourly snapshots', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              snapshotId: 'real-1',
              observed_at: '2099-01-01T10:00:00.000Z',
              takeoffs: 12,
              landings: 11,
              active_aircraft: 48,
              key_city_departures: { london: 3 },
              destination_concentration: 0.41,
              cross_border_ratio: 0.28,
              missing_identification_ratio: 0.05,
              context_markers: ['weather'],
            },
            {
              snapshotId: 'real-2',
              observed_at: '2099-01-01T11:00:00.000Z',
              takeoffs: 14,
              landings: 13,
              active_aircraft: 52,
              key_city_departures: { london: 4 },
              destination_concentration: 0.42,
              cross_border_ratio: 0.29,
              missing_identification_ratio: 0.06,
              context_markers: ['conference'],
            },
          ],
        }),
      }),
    )

    const source = new HttpRealAircraftSnapshotSource(
      getAnomalyRuntimeConfig({
        ANOMALY_INGESTION_MODE: 'real',
        ANOMALY_REAL_SOURCE_URL: 'https://example.test/feed',
        ANOMALY_PG_URL: 'postgres://postgres:postgres@localhost:5432/aether',
        ANOMALY_REAL_SOURCE_FRESHNESS_MINUTES: '120',
      }),
    )

    const result = await source.getSnapshots({ scenarioId: 'normal-day' })

    expect(result.snapshots).toHaveLength(2)
    expect(result.snapshots[0]?.keyCityDepartures.london).toBe(3)
    expect(result.snapshots[1]?.contextMarkers).toContain('conference')
    expect(result.ingestion.sourceKind).toBe('real')
  })

  it('falls back to mock-like source when real ingestion fails and fallback is enabled', async () => {
    const fallbackResult: SnapshotIngestionResult = {
      scenarioId: 'normal-day',
      snapshots: [
        {
          id: 'fallback-1',
          scenarioId: 'normal-day',
          observedAt: '2026-05-31T10:00:00.000Z',
          takeoffs: 100,
          landings: 99,
          activeAircraft: 300,
          keyCityDepartures: { london: 12 },
          destinationConcentration: 0.3,
          crossBorderRatio: 0.22,
          missingIdentificationRatio: 0.03,
          contextMarkers: [],
        },
        {
          id: 'fallback-2',
          scenarioId: 'normal-day',
          observedAt: '2026-05-31T11:00:00.000Z',
          takeoffs: 104,
          landings: 103,
          activeAircraft: 305,
          keyCityDepartures: { london: 13 },
          destinationConcentration: 0.31,
          crossBorderRatio: 0.23,
          missingIdentificationRatio: 0.03,
          contextMarkers: [],
        },
      ],
      ingestion: {
        requestedMode: 'real-with-fallback',
        sourceKind: 'mock',
        providerName: 'fixtures',
        sourceStatus: 'healthy',
        freshness: 'fresh',
        degraded: false,
        providerObservedAt: '2026-05-31T11:00:00.000Z',
        lastSuccessfulObservedAt: '2026-05-31T11:00:00.000Z',
        notes: [],
      },
    }

    const source = new ResolvedAircraftSnapshotSource(
      getAnomalyRuntimeConfig({
        ANOMALY_INGESTION_MODE: 'real-with-fallback',
        ANOMALY_ALLOW_MOCK_FALLBACK: 'true',
        ANOMALY_REAL_SOURCE_URL: 'https://example.test/feed',
        ANOMALY_PG_URL: 'postgres://postgres:postgres@localhost:5432/aether',
      }),
      {
        mockSource: new StaticSource(fallbackResult),
        realSource: new ThrowingSource(),
        repository: new NoopSnapshotRepository(),
      },
    )

    const result = await source.getSnapshots({ scenarioId: 'normal-day' })

    expect(result.ingestion.sourceKind).toBe('fallback')
    expect(result.ingestion.degraded).toBe(true)
    expect(result.ingestion.fallbackReason).toContain('provider offline')
  })

  it('persists snapshots and ingestion metadata through the pg repository contract', async () => {
    const repository = new PgSnapshotRepository('postgres://postgres:postgres@localhost:5432/aether')
    const queries: string[] = []
    const storedRows = {
      snapshots: [{ payload: { id: 'stored-1', scenarioId: 'normal-day', observedAt: '2026-05-31T10:00:00.000Z', takeoffs: 1, landings: 1, activeAircraft: 1, keyCityDepartures: {}, destinationConcentration: 0.1, crossBorderRatio: 0.1, missingIdentificationRatio: 0.1, contextMarkers: [] } }],
      metadata: [{ metadata: { requestedMode: 'real', sourceKind: 'real', providerName: 'http-json', sourceStatus: 'healthy', freshness: 'fresh', degraded: false, notes: [] } }],
    }

    const fakeClient = {
      query: vi.fn(async (queryText: string) => {
        queries.push(queryText)
        return { rows: [] }
      }),
      release: vi.fn(),
    }

    ;(repository as unknown as { pool: { query: unknown; connect: unknown } }).pool = {
      query: vi.fn(async (queryText: string) => {
        queries.push(queryText)
        if (queryText.includes('SELECT payload')) {
          return { rows: storedRows.snapshots }
        }
        if (queryText.includes('SELECT metadata')) {
          return { rows: storedRows.metadata }
        }
        return { rows: [] }
      }),
      connect: vi.fn(async () => fakeClient),
    }

    await repository.saveIngestionResult({
      scenarioId: 'normal-day',
      snapshots: [
        {
          id: 'stored-1',
          scenarioId: 'normal-day',
          observedAt: '2026-05-31T10:00:00.000Z',
          takeoffs: 1,
          landings: 1,
          activeAircraft: 1,
          keyCityDepartures: {},
          destinationConcentration: 0.1,
          crossBorderRatio: 0.1,
          missingIdentificationRatio: 0.1,
          contextMarkers: [],
        },
      ],
      ingestion: {
        requestedMode: 'real',
        sourceKind: 'real',
        providerName: 'http-json',
        sourceStatus: 'healthy',
        freshness: 'fresh',
        degraded: false,
        notes: [],
      },
    })

    const snapshots = await repository.loadSnapshots('normal-day')
    const metadata = await repository.loadIngestionMetadata('normal-day')

    expect(queries.some((query) => query.includes('CREATE TABLE IF NOT EXISTS anomaly_snapshots'))).toBe(true)
    expect(snapshots).toHaveLength(1)
    expect(metadata?.sourceKind).toBe('real')
  })
})