import { getLocaleCopy, getMetricLabels, type Locale } from './i18n'
import type { DashboardStatus } from './types'

export interface SignalSummaryResponse {
  locale: Locale
  scenarioId: DashboardStatus['scenarioId']
  ingestion: DashboardStatus['ingestion']
  currentLevel: number
  previousLevel: number
  trend: DashboardStatus['trend']
  headline: string
  summary: string
  benignContext: string[]
  window: string
  forecastTakeoffs: number
  actualTakeoffs: number
  deviationPercent: number
  drivers: string[]
  latestSnapshot: DashboardStatus['latestSnapshot']
  baseline: DashboardStatus['baseline']
  prediction: DashboardStatus['prediction']
  predictionReview: DashboardStatus['predictionReview']
}

export function toSignalSummaryResponse(status: DashboardStatus, locale: Locale): SignalSummaryResponse {
  const takeoffDeviation = status.predictionReview.deviations.find(
    (deviation) => deviation.metric === 'takeoffs',
  )
  const copy = getLocaleCopy(locale)
  const metricLabels = getMetricLabels(locale)

  return {
    locale,
    scenarioId: status.scenarioId,
    ingestion: status.ingestion,
    currentLevel: status.currentLevel,
    previousLevel: status.previousLevel,
    trend: status.trend,
    headline: status.explanation.headline,
    summary: status.explanation.summary,
    benignContext: status.explanation.benignContext,
    window: status.window,
    forecastTakeoffs: Number(status.prediction.ranges.takeoffs.average.toFixed(1)),
    actualTakeoffs: status.latestSnapshot.takeoffs,
    deviationPercent: takeoffDeviation
      ? Number((takeoffDeviation.deltaRatio * 100).toFixed(1))
      : 0,
    drivers: status.topDrivers.map(
      (driver) =>
        copy.driverLine(metricLabels[driver.metric], driver.weight, driver.contribution),
    ),
    latestSnapshot: status.latestSnapshot,
    baseline: status.baseline,
    prediction: status.prediction,
    predictionReview: {
      ...status.predictionReview,
      strongestDrivers: status.predictionReview.strongestDrivers.map((driver) => ({
        ...driver,
        label: metricLabels[driver.metric],
      })),
    },
  }
}