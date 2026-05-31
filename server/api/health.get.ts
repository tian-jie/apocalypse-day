import { anomalyRuntimeConfig, type AnomalyRuntimeConfig } from '../lib/anomaly/config'
import { createSnapshotRepository, type DatabaseConnectionStatus, type SnapshotRepository } from '../lib/anomaly/repository'

function toHealthMessage(database: DatabaseConnectionStatus) {
  if (database.status === 'ready') {
    return 'Nuxt server is ready for signal ingestion and PostgreSQL is reachable.'
  }

  if (database.status === 'mock-mode') {
    return 'Nuxt server is ready for signal ingestion in mock mode.'
  }

  return 'Nuxt server is running, but real-mode database readiness is degraded.'
}

export async function buildHealthStatus(
  config: AnomalyRuntimeConfig = anomalyRuntimeConfig,
  repository: SnapshotRepository = createSnapshotRepository(config),
) {
  const database = await repository.getDatabaseStatus()

  return {
    service: 'Aether Watch API',
    status: toHealthMessage(database),
    checkedAt: new Date().toISOString(),
    database,
  }
}

const healthHandler = async () => buildHealthStatus()

export default typeof defineEventHandler === 'function'
  ? defineEventHandler(healthHandler)
  : healthHandler