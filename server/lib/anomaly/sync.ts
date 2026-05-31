import { anomalyRuntimeConfig, type AnomalyRuntimeConfig } from './config'
import { listFixtureScenarioIds } from './mock-data'
import { createSnapshotRepository, type SnapshotRepository } from './repository'
import { HttpRealAircraftSnapshotSource } from './real-source'
import type { FixtureScenarioId, IngestionMetadata, SnapshotIngestionResult } from './types'

function buildSyncMetadata(
  partial: Partial<IngestionMetadata> & Pick<IngestionMetadata, 'requestedMode' | 'providerName' | 'sourceKind'>,
): IngestionMetadata {
  return {
    sourceStatus: 'failed',
    syncStatus: 'failed',
    dataState: 'insufficient',
    freshness: 'stale',
    degraded: true,
    notes: [],
    ...partial,
  }
}

export class AnomalySyncService {
  private readonly repository: SnapshotRepository
  private readonly realSource: HttpRealAircraftSnapshotSource

  constructor(
    private readonly config: AnomalyRuntimeConfig = anomalyRuntimeConfig,
    dependencies: {
      repository?: SnapshotRepository
      realSource?: HttpRealAircraftSnapshotSource
    } = {},
  ) {
    this.repository = dependencies.repository ?? createSnapshotRepository(config)
    this.realSource = dependencies.realSource ?? new HttpRealAircraftSnapshotSource(config)
  }

  async syncScenario(scenarioId: FixtureScenarioId): Promise<SnapshotIngestionResult> {
    const attemptedAt = new Date().toISOString()
    const existingMetadata = await this.repository.loadIngestionMetadata(scenarioId)

    await this.repository.saveIngestionMetadata(
      scenarioId,
      buildSyncMetadata({
        ...(existingMetadata ?? {}),
        requestedMode: this.config.ingestionMode,
        providerName: this.config.providerName,
        sourceKind: 'real',
        sourceStatus: existingMetadata?.sourceStatus ?? 'degraded',
        syncStatus: 'running',
        dataState: existingMetadata?.dataState ?? 'insufficient',
        freshness: existingMetadata?.freshness ?? 'stale',
        degraded: true,
        lastSyncAttemptedAt: attemptedAt,
        notes: existingMetadata?.notes ?? [],
      }),
    )

    try {
      const liveResult = await this.realSource.getSnapshots({ scenarioId })
      const persistedAt = new Date().toISOString()
      const successResult: SnapshotIngestionResult = {
        ...liveResult,
        ingestion: {
          ...liveResult.ingestion,
          syncStatus: 'healthy',
          dataState: liveResult.snapshots.length >= 3 ? 'ready' : 'insufficient',
          sourceStatus:
            liveResult.ingestion.freshness === 'fresh' && liveResult.snapshots.length >= 3
              ? 'healthy'
              : 'degraded',
          degraded: liveResult.ingestion.freshness !== 'fresh' || liveResult.snapshots.length < 3,
          lastSyncAttemptedAt: attemptedAt,
          lastSyncSucceededAt: attemptedAt,
          lastSuccessfulObservedAt: liveResult.snapshots[liveResult.snapshots.length - 1]?.observedAt,
          persistedAt,
          syncFailureReason: undefined,
          notes:
            liveResult.snapshots.length >= 3
              ? []
              : ['Persisted history is not yet sufficient for full scoring.'],
        },
      }

      await this.repository.saveIngestionResult(successResult)
      return successResult
    }
    catch (error) {
      const failureReason = error instanceof Error ? error.message : 'Background sync failed.'
      await this.repository.saveIngestionMetadata(
        scenarioId,
        buildSyncMetadata({
          ...(existingMetadata ?? {}),
          requestedMode: this.config.ingestionMode,
          providerName: this.config.providerName,
          sourceKind: 'real',
          sourceStatus: existingMetadata?.lastSuccessfulObservedAt ? 'degraded' : 'failed',
          syncStatus: 'failed',
          dataState: existingMetadata?.dataState ?? 'insufficient',
          freshness: existingMetadata?.freshness ?? 'stale',
          degraded: true,
          lastSyncAttemptedAt: attemptedAt,
          lastSyncFailedAt: attemptedAt,
          lastSuccessfulObservedAt: existingMetadata?.lastSuccessfulObservedAt,
          providerObservedAt: existingMetadata?.providerObservedAt,
          persistedAt: existingMetadata?.persistedAt,
          syncFailureReason: failureReason,
          notes: [...(existingMetadata?.notes ?? []), 'Background sync failed.'],
        }),
      )
      throw error
    }
  }

  async syncAllScenarios() {
    const scenarioIds = listFixtureScenarioIds()
    const results: Partial<Record<FixtureScenarioId, string>> = {}

    for (const scenarioId of scenarioIds) {
      try {
        await this.syncScenario(scenarioId)
        results[scenarioId] = 'ok'
      }
      catch (error) {
        results[scenarioId] = error instanceof Error ? error.message : 'Background sync failed.'
      }
    }

    return results
  }
}

export const anomalySyncService = new AnomalySyncService()