import { anomalyRuntimeConfig } from '../../lib/anomaly/config'
import { anomalySyncService } from '../../lib/anomaly/sync'

export default defineEventHandler(async () => {
  if (anomalyRuntimeConfig.ingestionMode !== 'real') {
    return {
      mode: anomalyRuntimeConfig.ingestionMode,
      skipped: true,
      reason: 'Background sync is only available in real mode.',
    }
  }

  const results = await anomalySyncService.syncAllScenarios()

  return {
    mode: anomalyRuntimeConfig.ingestionMode,
    skipped: false,
    results,
  }
})