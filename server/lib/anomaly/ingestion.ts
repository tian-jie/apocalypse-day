import { anomalyRuntimeConfig, type AnomalyRuntimeConfig } from './config'
import { getScenarioSnapshots, listFixtureScenarioIds } from './mock-data'
import { NoopSnapshotRepository, createSnapshotRepository, type SnapshotRepository } from './repository'
import { HttpRealAircraftSnapshotSource } from './real-source'
import type {
  AircraftSnapshotIngestionSource,
  FixtureScenarioId,
  IngestionMetadata,
  SnapshotIngestionQuery,
  SnapshotIngestionResult,
} from './types'

function toMockMetadata(
  scenarioId: FixtureScenarioId,
  latestObservedAt: string | undefined,
  fallbackReason?: string,
): IngestionMetadata {
  const isFallback = Boolean(fallbackReason)

  return {
    requestedMode: anomalyRuntimeConfig.ingestionMode,
    sourceKind: isFallback ? 'fallback' : 'mock',
    providerName: 'fixtures',
    sourceStatus: isFallback ? 'degraded' : 'healthy',
    syncStatus: 'healthy',
    dataState: 'ready',
    freshness: 'fresh',
    degraded: isFallback,
    providerObservedAt: latestObservedAt,
    lastSuccessfulObservedAt: latestObservedAt,
    lastSyncAttemptedAt: latestObservedAt,
    lastSyncSucceededAt: latestObservedAt,
    persistedAt: undefined,
    syncFailureReason: fallbackReason,
    notes: isFallback ? [`Scenario ${scenarioId} is using mock fallback.`] : [],
  }
}

export class MockAircraftSnapshotSource implements AircraftSnapshotIngestionSource {
  async getSnapshots({ scenarioId }: SnapshotIngestionQuery): Promise<SnapshotIngestionResult> {
    const snapshots = getScenarioSnapshots(scenarioId)
    const latestObservedAt = snapshots[snapshots.length - 1]?.observedAt

    return {
      scenarioId,
      snapshots,
      ingestion: toMockMetadata(scenarioId, latestObservedAt),
    }
  }

  listScenarioIds() {
    return listFixtureScenarioIds()
  }
}

export class ResolvedAircraftSnapshotSource implements AircraftSnapshotIngestionSource {
  private readonly mockSource: AircraftSnapshotIngestionSource
  private readonly repository: SnapshotRepository

  constructor(
    private readonly config: AnomalyRuntimeConfig = anomalyRuntimeConfig,
    dependencies: {
      mockSource?: AircraftSnapshotIngestionSource
      repository?: SnapshotRepository
    } = {},
  ) {
    this.mockSource = dependencies.mockSource ?? new MockAircraftSnapshotSource()
    this.repository = dependencies.repository ?? createSnapshotRepository(config)
  }

  listScenarioIds() {
    return this.mockSource.listScenarioIds()
  }

  async getSnapshots(query: SnapshotIngestionQuery): Promise<SnapshotIngestionResult> {
    if (this.config.ingestionMode === 'mock') {
      return this.mockSource.getSnapshots(query)
    }

    const persistedSnapshots = await this.repository.loadSnapshots(query.scenarioId)
    const persistedMetadata = await this.repository.loadIngestionMetadata(query.scenarioId)
    const latestObservedAt = persistedSnapshots[persistedSnapshots.length - 1]?.observedAt
    const hasEnoughHistory = persistedSnapshots.length >= 3

    if (persistedMetadata) {
      return {
        scenarioId: query.scenarioId,
        snapshots: persistedSnapshots,
        ingestion: {
          ...persistedMetadata,
          sourceKind: 'real',
          providerObservedAt: latestObservedAt ?? persistedMetadata.providerObservedAt,
          lastSuccessfulObservedAt:
            latestObservedAt ?? persistedMetadata.lastSuccessfulObservedAt ?? persistedMetadata.lastSyncSucceededAt,
          dataState: hasEnoughHistory ? 'ready' : 'insufficient',
          sourceStatus:
            persistedMetadata.syncStatus === 'failed' && !hasEnoughHistory
              ? 'failed'
              : persistedMetadata.freshness === 'stale' || !hasEnoughHistory
                ? 'degraded'
                : 'healthy',
          degraded:
            persistedMetadata.syncStatus === 'failed' || persistedMetadata.freshness === 'stale' || !hasEnoughHistory,
          notes: hasEnoughHistory
            ? persistedMetadata.notes
            : [...persistedMetadata.notes, 'Persisted history is not yet sufficient for full scoring.'],
        },
      }
    }

    return {
      scenarioId: query.scenarioId,
      snapshots: [],
      ingestion: {
        requestedMode: this.config.ingestionMode,
        sourceKind: 'real',
        providerName: this.config.providerName,
        sourceStatus: 'failed',
        syncStatus: this.config.validationErrors.length > 0 ? 'failed' : 'idle',
        dataState: 'insufficient',
        freshness: 'stale',
        degraded: true,
        syncFailureReason:
          this.config.validationErrors.length > 0
            ? this.config.validationErrors.join(' ')
            : 'Background sync has not produced persisted snapshots yet.',
        notes: ['No persisted synchronized snapshots are available yet.'],
      },
    }
  }
}

export const defaultIngestionSource = new ResolvedAircraftSnapshotSource()