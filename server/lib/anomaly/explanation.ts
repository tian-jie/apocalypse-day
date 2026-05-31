import { getBenignContextCopy, getLocaleCopy, getMetricLabels, type Locale } from './i18n'
import type { AnomalyExplanation, DashboardStatus } from './types'

export function buildExplanation(
  status: Omit<DashboardStatus, 'explanation'>,
  locale: Locale,
): AnomalyExplanation {
  const topDriver = status.topDrivers[0]
  const benignContextCopy = getBenignContextCopy(locale)
  const metricLabels = getMetricLabels(locale)
  const copy = getLocaleCopy(locale)
  const benignContext = status.latestSnapshot.contextMarkers.map((marker) => benignContextCopy[marker])
  const levelCopy =
    status.currentLevel >= 4
      ? copy.headlineLevel.high
      : status.currentLevel === 3
        ? copy.headlineLevel.medium
        : copy.headlineLevel.low

  return {
    headline: `Level ${status.currentLevel} | ${levelCopy}`,
    summary: copy.explanationSummary(
      metricLabels[topDriver.metric],
      topDriver.deltaRatio,
      status.prediction.rationale,
    ),
    benignContext,
  }
}