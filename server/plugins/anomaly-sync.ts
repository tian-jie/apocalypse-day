import { anomalyRuntimeConfig } from '../lib/anomaly/config'
import { anomalySyncService } from '../lib/anomaly/sync'

export default defineNitroPlugin(() => {
  if (anomalyRuntimeConfig.ingestionMode !== 'real' || !anomalyRuntimeConfig.autoSyncEnabled) {
    return
  }

  void anomalySyncService.syncAllScenarios()

  setInterval(() => {
    void anomalySyncService.syncAllScenarios()
  }, anomalyRuntimeConfig.syncIntervalMs)
})