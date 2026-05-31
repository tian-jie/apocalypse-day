import { toSignalSummaryResponse } from '../../lib/anomaly/api'
import { buildDashboardStatus } from '../../lib/anomaly/dashboard'
import { defaultIngestionSource } from '../../lib/anomaly/ingestion'
import { defaultLocale, isSupportedLocale } from '../../lib/anomaly/i18n'
import type { FixtureScenarioId } from '../../lib/anomaly/types'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const scenario = query.scenario
  const locale =
    typeof query.locale === 'string' && isSupportedLocale(query.locale)
      ? query.locale
      : defaultLocale
  const scenarioIds = defaultIngestionSource.listScenarioIds()
  const scenarioId =
    typeof scenario === 'string' && scenarioIds.includes(scenario as FixtureScenarioId)
      ? (scenario as FixtureScenarioId)
      : 'normal-day'
  const status = await buildDashboardStatus(scenarioId, locale)
  return toSignalSummaryResponse(status, locale)
})