import { describe, expect, it } from 'vitest'

import { getAnomalyRuntimeConfig } from '../server/lib/anomaly/config'
import { buildHealthStatus } from '../server/api/health.get'
import type { DatabaseConnectionStatus, SnapshotRepository } from '../server/lib/anomaly/repository'

function createRepository(status: DatabaseConnectionStatus): SnapshotRepository {
  return {
    async ensureSchema() {},
    async loadSnapshots() {
      return []
    },
    async loadIngestionMetadata() {
      return null
    },
    async saveIngestionResult() {},
    async saveIngestionMetadata() {},
    async getDatabaseStatus() {
      return status
    },
  }
}

describe('health api database status', () => {
  it('reports mock mode without requiring database readiness', async () => {
    const config = getAnomalyRuntimeConfig({
      ANOMALY_INGESTION_MODE: 'mock',
    })

    const health = await buildHealthStatus(
      config,
      createRepository({
        mode: 'mock',
        required: false,
        configured: false,
        status: 'mock-mode',
        source: null,
      }),
    )

    expect(health.database.status).toBe('mock-mode')
    expect(health.status).toContain('mock mode')
  })

  it('reports missing database configuration in real mode', async () => {
    const config = getAnomalyRuntimeConfig({
      ANOMALY_INGESTION_MODE: 'real',
      ANOMALY_REAL_SOURCE_URL: 'https://example.test/feed',
    })

    const health = await buildHealthStatus(
      config,
      createRepository({
        mode: 'real',
        required: true,
        configured: false,
        status: 'not-configured',
        source: null,
        failureReason: 'ANOMALY_PG_URL or DATABASE_URL is required when real ingestion is enabled.',
      }),
    )

    expect(health.database.status).toBe('not-configured')
    expect(health.database.failureReason).toContain('ANOMALY_PG_URL')
    expect(health.status).toContain('degraded')
  })

  it('reports reachable database with safe target summary', async () => {
    const config = getAnomalyRuntimeConfig({
      ANOMALY_INGESTION_MODE: 'real',
      ANOMALY_REAL_SOURCE_URL: 'https://example.test/feed',
      ANOMALY_PG_URL: 'postgres://postgres:postgres@localhost:5432/aether_watch',
    })

    const health = await buildHealthStatus(
      config,
      createRepository({
        mode: 'real',
        required: true,
        configured: true,
        status: 'ready',
        source: 'ANOMALY_PG_URL',
        host: 'localhost',
        port: '5432',
        databaseName: 'aether_watch',
      }),
    )

    expect(health.database.status).toBe('ready')
    expect(health.database.host).toBe('localhost')
    expect(health.database.databaseName).toBe('aether_watch')
    expect(health.status).toContain('PostgreSQL is reachable')
  })
})