import { getLocaleCopy, getMetricLabels, type Locale } from './i18n'
import { getMetricValue, trackedMetrics } from './metrics'
import type { Baseline, HourlyAircraftSnapshot, MetricRangeMap, Prediction } from './types'

function shiftDateOneHour(iso: string) {
  const date = new Date(iso)
  date.setUTCHours(date.getUTCHours() + 1)
  return date.toISOString()
}

export function buildPrediction(
  baseline: Baseline,
  history: HourlyAircraftSnapshot[],
  currentSnapshot: HourlyAircraftSnapshot,
  locale: Locale,
): Prediction {
  const recentHistory = history.slice(-2)
  const ranges = trackedMetrics.reduce((map, metric) => {
    const baselineRange = baseline.ranges[metric]
    const recentAverage = recentHistory.length
      ? recentHistory.reduce((sum, snapshot) => sum + getMetricValue(snapshot, metric), 0) /
        recentHistory.length
      : baselineRange.average
    const currentValue = getMetricValue(currentSnapshot, metric)
    const trendAdjustment = (currentValue - recentAverage) * 0.35
    const average = baselineRange.average + trendAdjustment
    const width = Math.max((baselineRange.max - baselineRange.min) / 2, baselineRange.average * 0.04, 1)

    map[metric] = {
      min: average - width,
      max: average + width,
      average,
    }
    return map
  }, {} as MetricRangeMap)

  const rationale = getLocaleCopy(locale).predictionRationale(getMetricLabels(locale))

  return {
    targetObservedAt: shiftDateOneHour(currentSnapshot.observedAt),
    generatedAt: currentSnapshot.observedAt,
    ranges,
    rationale,
  }
}