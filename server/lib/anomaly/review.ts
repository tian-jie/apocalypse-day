import { getMetricValue, metricLabels, trackedMetrics } from './metrics'
import type { AnomalyDriver, MetricDeviation, Prediction, PredictionReview } from './types'

const weights = {
  takeoffs: 0.18,
  landings: 0.12,
  activeAircraft: 0.18,
  keyCityDeparturesTotal: 0.14,
  destinationConcentration: 0.12,
  crossBorderRatio: 0.12,
  missingIdentificationRatio: 0.14,
} as const

export function reviewPrediction(prediction: Prediction, actualObservedAt: string, snapshot: Parameters<typeof getMetricValue>[0]): PredictionReview {
  const deviations: MetricDeviation[] = trackedMetrics.map((metric) => {
    const expected = prediction.ranges[metric]
    const actual = getMetricValue(snapshot, metric)
    const expectedMidpoint = expected.average
    const expectedWidth = Math.max(expected.max - expected.min, expected.average * 0.08, 1)
    const delta = actual - expectedMidpoint
    const deltaRatio = Math.abs(delta) / expectedWidth

    return {
      metric,
      expectedMidpoint,
      expectedMin: expected.min,
      expectedMax: expected.max,
      actual,
      delta,
      deltaRatio,
    }
  })

  const strongestDrivers: AnomalyDriver[] = deviations
    .map((deviation) => ({
      metric: deviation.metric,
      label: metricLabels[deviation.metric],
      deltaRatio: deviation.deltaRatio,
      weight: weights[deviation.metric],
      contribution: deviation.deltaRatio * weights[deviation.metric],
    }))
    .sort((left, right) => right.contribution - left.contribution)
    .slice(0, 3)

  return {
    targetObservedAt: prediction.targetObservedAt,
    reviewedAt: actualObservedAt,
    deviations,
    strongestDrivers,
  }
}

export function getDriverWeights() {
  return weights
}