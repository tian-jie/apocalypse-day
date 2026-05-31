import { Pool } from 'pg'

import { anomalyRuntimeConfig, type AnomalyRuntimeConfig } from './config'
import type {
  FixtureScenarioId,
  HourlyAircraftSnapshot,
  IngestionMetadata,
  SnapshotIngestionResult,
} from './types'

export interface SnapshotRepository {
  ensureSchema: () => Promise<void>
  loadSnapshots: (scenarioId: FixtureScenarioId) => Promise<HourlyAircraftSnapshot[]>
  loadIngestionMetadata: (scenarioId: FixtureScenarioId) => Promise<IngestionMetadata | null>
  saveIngestionResult: (result: SnapshotIngestionResult) => Promise<void>
}

export class NoopSnapshotRepository implements SnapshotRepository {
  async ensureSchema() {}

  async loadSnapshots() {
    return []
  }

  async loadIngestionMetadata() {
    return null
  }

  async saveIngestionResult() {}
}

export class PgSnapshotRepository implements SnapshotRepository {
  private pool: Pool
  private schemaReady = false

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
  }

  async ensureSchema() {
    if (this.schemaReady) {
      return
    }

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS anomaly_snapshots (
        scenario_id TEXT NOT NULL,
        snapshot_id TEXT NOT NULL,
        observed_at TIMESTAMPTZ NOT NULL,
        payload JSONB NOT NULL,
        PRIMARY KEY (scenario_id, snapshot_id)
      );

      CREATE INDEX IF NOT EXISTS anomaly_snapshots_scenario_observed_at_idx
      ON anomaly_snapshots (scenario_id, observed_at);

      CREATE TABLE IF NOT EXISTS anomaly_ingestion_state (
        scenario_id TEXT PRIMARY KEY,
        metadata JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `)

    this.schemaReady = true
  }

  async loadSnapshots(scenarioId: FixtureScenarioId) {
    await this.ensureSchema()

    const result = await this.pool.query<{ payload: HourlyAircraftSnapshot }>(
      `
        SELECT payload
        FROM anomaly_snapshots
        WHERE scenario_id = $1
        ORDER BY observed_at ASC
      `,
      [scenarioId],
    )

    return result.rows.map((row) => row.payload)
  }

  async loadIngestionMetadata(scenarioId: FixtureScenarioId) {
    await this.ensureSchema()

    const result = await this.pool.query<{ metadata: IngestionMetadata }>(
      `
        SELECT metadata
        FROM anomaly_ingestion_state
        WHERE scenario_id = $1
      `,
      [scenarioId],
    )

    return result.rows[0]?.metadata ?? null
  }

  async saveIngestionResult(result: SnapshotIngestionResult) {
    await this.ensureSchema()

    const client = await this.pool.connect()

    try {
      await client.query('BEGIN')

      for (const snapshot of result.snapshots) {
        await client.query(
          `
            INSERT INTO anomaly_snapshots (scenario_id, snapshot_id, observed_at, payload)
            VALUES ($1, $2, $3, $4::jsonb)
            ON CONFLICT (scenario_id, snapshot_id)
            DO UPDATE SET observed_at = EXCLUDED.observed_at, payload = EXCLUDED.payload
          `,
          [
            result.scenarioId,
            snapshot.id,
            snapshot.observedAt,
            JSON.stringify(snapshot),
          ],
        )
      }

      await client.query(
        `
          INSERT INTO anomaly_ingestion_state (scenario_id, metadata, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (scenario_id)
          DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = NOW()
        `,
        [result.scenarioId, JSON.stringify(result.ingestion)],
      )

      await client.query('COMMIT')
    }
    catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
    finally {
      client.release()
    }
  }
}

export function createSnapshotRepository(
  config: AnomalyRuntimeConfig = anomalyRuntimeConfig,
): SnapshotRepository {
  if (!config.postgresUrl) {
    return new NoopSnapshotRepository()
  }

  return new PgSnapshotRepository(config.postgresUrl)
}