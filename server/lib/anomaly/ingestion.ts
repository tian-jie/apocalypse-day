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
    freshness: 'fresh',
    degraded: isFallback,
    providerObservedAt: latestObservedAt,
    lastSuccessfulObservedAt: latestObservedAt,
    persistedAt: undefined,
    fallbackReason,
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
  private readonly realSource: AircraftSnapshotIngestionSource
  private readonly repository: SnapshotRepository

  constructor(
    private readonly config: AnomalyRuntimeConfig = anomalyRuntimeConfig,
    dependencies: {
      mockSource?: AircraftSnapshotIngestionSource
      realSource?: AircraftSnapshotIngestionSource
      repository?: SnapshotRepository
    } = {},
  ) {
    this.mockSource = dependencies.mockSource ?? new MockAircraftSnapshotSource()
    this.realSource = dependencies.realSource ?? new HttpRealAircraftSnapshotSource(config)
    this.repository = dependencies.repository ?? createSnapshotRepository(config)
  }

  listScenarioIds() {
    return this.mockSource.listScenarioIds()
  }

  async getSnapshots(query: SnapshotIngestionQuery): Promise<SnapshotIngestionResult> {
    if (this.config.ingestionMode === 'mock') {
      return this.mockSource.getSnapshots(query)
    }

    if (this.config.validationErrors.length > 0) {
      if (!this.config.allowMockFallback) {
        throw new Error(this.config.validationErrors.join(' '))
      }

      const fallback = await this.mockSource.getSnapshots(query)
      return {
        ...fallback,
        ingestion: {
          ...fallback.ingestion,
          sourceKind: 'fallback',
          sourceStatus: 'degraded',
          degraded: true,
          fallbackReason: this.config.validationErrors.join(' '),
          notes: [...fallback.ingestion.notes, 'Real ingestion config validation failed.'],
        },
      }
    }

    try {
      const liveResult = await this.realSource.getSnapshots(query)

      if (liveResult.ingestion.freshness === 'stale' && this.config.allowMockFallback) {
        const fallback = await this.mockSource.getSnapshots(query)
        return {
          ...fallback,
          ingestion: {
            ...fallback.ingestion,
            sourceKind: 'fallback',
            sourceStatus: 'degraded',
            degraded: true,
            providerObservedAt: liveResult.ingestion.providerObservedAt,
            lastSuccessfulObservedAt: liveResult.ingestion.lastSuccessfulObservedAt,
            fallbackReason: liveResult.ingestion.fallbackReason,
            notes: [...fallback.ingestion.notes, 'Real provider data was stale, using mock fallback.'],
          },
        }
      }

      await this.repository.saveIngestionResult(liveResult)
      const persistedSnapshots = await this.repository.loadSnapshots(query.scenarioId)
      const persistedMetadata = await this.repository.loadIngestionMetadata(query.scenarioId)

      if (persistedSnapshots.length >= 2 && persistedMetadata) {
        return {
          scenarioId: query.scenarioId,
          snapshots: persistedSnapshots,
          ingestion: persistedMetadata,
        }
      }

      return liveResult
    }
    catch (error) {
      const persistedSnapshots = await this.repository.loadSnapshots(query.scenarioId)
      const persistedMetadata = await this.repository.loadIngestionMetadata(query.scenarioId)

      if (persistedSnapshots.length >= 2 && persistedMetadata) {
        return {
          scenarioId: query.scenarioId,
          snapshots: persistedSnapshots,
          ingestion: {
            ...persistedMetadata,
            sourceStatus: 'degraded',
            degraded: true,
            fallbackReason: error instanceof Error ? error.message : 'Real ingestion failed.',
            notes: [...persistedMetadata.notes, 'Loaded most recent persisted snapshots after live fetch failed.'],
          },
        }
      }

      if (this.config.allowMockFallback) {
        const fallback = await this.mockSource.getSnapshots(query)
        return {
          ...fallback,
          ingestion: {
            ...fallback.ingestion,
            sourceKind: 'fallback',
            sourceStatus: 'degraded',
            degraded: true,
            fallbackReason: error instanceof Error ? error.message : 'Real ingestion failed.',
            notes: [...fallback.ingestion.notes, 'Real provider failed, using mock fallback.'],
          },
        }
      }

      throw error
    }
  }
}

export const defaultIngestionSource = new ResolvedAircraftSnapshotSource()