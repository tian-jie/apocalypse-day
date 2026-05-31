import { Pool } from 'pg'

import { anomalyRuntimeConfig, type AnomalyRuntimeConfig } from './config'
import type { IngestionMode } from './types'
import type {
  FixtureScenarioId,
  HourlyAircraftSnapshot,
  IngestionMetadata,
  SnapshotIngestionResult,
} from './types'

export interface DatabaseConnectionStatus {
  mode: IngestionMode
  required: boolean
  configured: boolean
  status: 'mock-mode' | 'not-configured' | 'ready' | 'unreachable'
  source: 'ANOMALY_PG_URL' | 'DATABASE_URL' | null
  host?: string
  port?: string
  databaseName?: string
  failureReason?: string
}

export interface SnapshotRepository {
  ensureSchema: () => Promise<void>
  loadSnapshots: (scenarioId: FixtureScenarioId) => Promise<HourlyAircraftSnapshot[]>
  loadIngestionMetadata: (scenarioId: FixtureScenarioId) => Promise<IngestionMetadata | null>
  saveIngestionResult: (result: SnapshotIngestionResult) => Promise<void>
  saveIngestionMetadata: (scenarioId: FixtureScenarioId, metadata: IngestionMetadata) => Promise<void>
  getDatabaseStatus: () => Promise<DatabaseConnectionStatus>
}

export class NoopSnapshotRepository implements SnapshotRepository {
  constructor(protected readonly config: AnomalyRuntimeConfig = anomalyRuntimeConfig) {}

  async ensureSchema() {}

  async loadSnapshots() {
    return []
  }

  async loadIngestionMetadata() {
    return null
  }

  async saveIngestionResult() {}

  async saveIngestionMetadata() {}

  async getDatabaseStatus(): Promise<DatabaseConnectionStatus> {
    return {
      mode: this.config.ingestionMode,
      required: false,
      configured: this.config.databaseTarget.configured,
      status: 'mock-mode',
      source: this.config.postgresUrlSource,
      host: this.config.databaseTarget.host,
      port: this.config.databaseTarget.port,
      databaseName: this.config.databaseTarget.databaseName,
    }
  }
}

export class UnavailableSnapshotRepository extends NoopSnapshotRepository {
  constructor(
    config: AnomalyRuntimeConfig,
    private readonly status: DatabaseConnectionStatus,
  ) {
    super(config)
  }

  override async loadSnapshots() {
    throw new Error(this.status.failureReason ?? 'Database is not ready for real ingestion mode.')
  }

  override async loadIngestionMetadata() {
    throw new Error(this.status.failureReason ?? 'Database is not ready for real ingestion mode.')
  }

  override async saveIngestionResult() {
    throw new Error(this.status.failureReason ?? 'Database is not ready for real ingestion mode.')
  }

  override async saveIngestionMetadata() {
    throw new Error(this.status.failureReason ?? 'Database is not ready for real ingestion mode.')
  }

  override async getDatabaseStatus(): Promise<DatabaseConnectionStatus> {
    return this.status
  }
}

export class PgSnapshotRepository implements SnapshotRepository {
  private pool: Pool
  private schemaReady = false

  constructor(connectionString: string, private readonly config: AnomalyRuntimeConfig = anomalyRuntimeConfig) {
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

      await this.upsertIngestionMetadata(client, result.scenarioId, result.ingestion)

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

  async saveIngestionMetadata(scenarioId: FixtureScenarioId, metadata: IngestionMetadata) {
    await this.ensureSchema()
    await this.pool.query(
      `
        INSERT INTO anomaly_ingestion_state (scenario_id, metadata, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (scenario_id)
        DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = NOW()
      `,
      [scenarioId, JSON.stringify(metadata)],
    )
  }

  async getDatabaseStatus(): Promise<DatabaseConnectionStatus> {
    try {
      const result = await this.pool.query<{ database_name: string }>('SELECT current_database() AS database_name')

      return {
        mode: this.config.ingestionMode,
        required: this.config.ingestionMode !== 'mock',
        configured: true,
        status: 'ready',
        source: this.config.postgresUrlSource,
        host: this.config.databaseTarget.host,
        port: this.config.databaseTarget.port,
        databaseName: result.rows[0]?.database_name ?? this.config.databaseTarget.databaseName,
      }
    }
    catch (error) {
      return {
        mode: this.config.ingestionMode,
        required: this.config.ingestionMode !== 'mock',
        configured: true,
        status: 'unreachable',
        source: this.config.postgresUrlSource,
        host: this.config.databaseTarget.host,
        port: this.config.databaseTarget.port,
        databaseName: this.config.databaseTarget.databaseName,
        failureReason: error instanceof Error ? error.message : 'PostgreSQL connection check failed.',
      }
    }
  }

  private async upsertIngestionMetadata(
    client: { query: (query: string, values?: unknown[]) => Promise<unknown> },
    scenarioId: FixtureScenarioId,
    metadata: IngestionMetadata,
  ) {
    await client.query(
      `
        INSERT INTO anomaly_ingestion_state (scenario_id, metadata, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (scenario_id)
        DO UPDATE SET metadata = EXCLUDED.metadata, updated_at = NOW()
      `,
      [scenarioId, JSON.stringify(metadata)],
    )
  }
}

export function createSnapshotRepository(
  config: AnomalyRuntimeConfig = anomalyRuntimeConfig,
): SnapshotRepository {
  if (!config.postgresUrl) {
    if (config.ingestionMode === 'mock') {
      return new NoopSnapshotRepository(config)
    }

    return new UnavailableSnapshotRepository(config, {
      mode: config.ingestionMode,
      required: true,
      configured: false,
      status: 'not-configured',
      source: config.postgresUrlSource,
      host: config.databaseTarget.host,
      port: config.databaseTarget.port,
      databaseName: config.databaseTarget.databaseName,
      failureReason: 'ANOMALY_PG_URL or DATABASE_URL is required when real ingestion is enabled.',
    })
  }

  return new PgSnapshotRepository(config.postgresUrl, config)
}