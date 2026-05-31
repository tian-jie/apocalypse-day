import { getMetricValue, trackedMetrics } from './metrics'
import type { Baseline, HourlyAircraftSnapshot, MetricKey, MetricRangeMap } from './types'

function toDateParts(observedAt: string) {
  const date = new Date(observedAt)
  return {
    hourOfDay: date.getUTCHours(),
    dayOfWeek: date.getUTCDay(),
  }
}

function buildMetricRange(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length

  return { min, max, average }
}

export function calculateBaseline(
  history: HourlyAircraftSnapshot[],
  targetSnapshot: HourlyAircraftSnapshot,
): Baseline {
  const { hourOfDay, dayOfWeek } = toDateParts(targetSnapshot.observedAt)
  const matchingHistory = history.filter((snapshot) => {
    const parts = toDateParts(snapshot.observedAt)
    return parts.hourOfDay === hourOfDay || parts.dayOfWeek === dayOfWeek
  })

  const baselineHistory = (matchingHistory.length > 0 ? matchingHistory : history).slice(-4)
  const ranges = trackedMetrics.reduce((map, metric) => {
    map[metric] = buildMetricRange(
      baselineHistory.map((snapshot) => getMetricValue(snapshot, metric)),
    )
    return map
  }, {} as MetricRangeMap)

  return {
    sampleSize: baselineHistory.length,
    hourOfDay,
    dayOfWeek,
    ranges,
  }
}

export function describeRange(ranges: MetricRangeMap, metric: MetricKey) {
  const range = ranges[metric]
  return `${range.min.toFixed(2)}-${range.max.toFixed(2)}`
}