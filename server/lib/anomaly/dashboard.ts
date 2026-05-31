import { calculateBaseline } from './baseline'
import { buildExplanation } from './explanation'
import { defaultIngestionSource } from './ingestion'
import { defaultLocale, getLocaleCopy, type Locale } from './i18n'
import { buildPrediction } from './prediction'
import { reviewPrediction } from './review'
import { scoreAnomaly } from './scoring'
import type { DashboardStatus, FixtureScenarioId, HourlyAircraftSnapshot, MetricRangeMap } from './types'

function sortByObservedAt(left: { observedAt: string }, right: { observedAt: string }) {
  return new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime()
}

const emptyRanges = {
  takeoffs: { min: 0, max: 0, average: 0 },
  landings: { min: 0, max: 0, average: 0 },
  activeAircraft: { min: 0, max: 0, average: 0 },
  keyCityDeparturesTotal: { min: 0, max: 0, average: 0 },
  destinationConcentration: { min: 0, max: 0, average: 0 },
  crossBorderRatio: { min: 0, max: 0, average: 0 },
  missingIdentificationRatio: { min: 0, max: 0, average: 0 },
} satisfies MetricRangeMap

function createPlaceholderSnapshot(scenarioId: FixtureScenarioId): HourlyAircraftSnapshot {
  return {
    id: `${scenarioId}-unavailable`,
    scenarioId,
    observedAt: new Date(0).toISOString(),
    takeoffs: 0,
    landings: 0,
    activeAircraft: 0,
    keyCityDepartures: {},
    destinationConcentration: 0,
    crossBorderRatio: 0,
    missingIdentificationRatio: 0,
    contextMarkers: [],
  }
}

function buildUnavailableStatus(
  scenarioId: FixtureScenarioId,
  locale: Locale,
  reason: string,
  ingestion: DashboardStatus['ingestion'],
): DashboardStatus {
  const placeholderSnapshot = createPlaceholderSnapshot(scenarioId)

  return {
    scenarioId,
    locale,
    ingestion,
    currentLevel: 0,
    previousLevel: 0,
    trend: 'stable',
    window: getLocaleCopy(locale).window,
    latestSnapshot: placeholderSnapshot,
    baseline: {
      sampleSize: 0,
      hourOfDay: 0,
      dayOfWeek: 0,
      ranges: emptyRanges,
    },
    prediction: {
      targetObservedAt: placeholderSnapshot.observedAt,
      generatedAt: placeholderSnapshot.observedAt,
      ranges: emptyRanges,
      rationale: reason,
    },
    predictionReview: {
      targetObservedAt: placeholderSnapshot.observedAt,
      reviewedAt: placeholderSnapshot.observedAt,
      deviations: [],
      strongestDrivers: [],
    },
    topDrivers: [],
    explanation: {
      headline: locale === 'en' ? 'Synchronized data is not ready' : '同步数据尚未就绪',
      summary: reason,
      benignContext: [],
    },
  }
}

export async function buildDashboardStatus(
  scenarioId: FixtureScenarioId = 'normal-day',
  locale: Locale = defaultLocale,
): Promise<DashboardStatus> {
  const ingestionResult = await defaultIngestionSource.getSnapshots({ scenarioId })
  const snapshots = ingestionResult.snapshots.sort(sortByObservedAt)

  if (snapshots.length < 3 || ingestionResult.ingestion.dataState === 'insufficient') {
    return buildUnavailableStatus(
      scenarioId,
      locale,
      ingestionResult.ingestion.syncFailureReason ??
        (locale === 'en'
          ? 'Background sync has not produced enough persisted history yet.'
          : '后台同步尚未生成足够的本地历史快照。'),
      ingestionResult.ingestion,
    )
  }

  const latestSnapshot = snapshots[snapshots.length - 1]
  const previousSnapshot = snapshots[snapshots.length - 2]
  const historyBeforeLatest = snapshots.slice(0, -1)
  const historyBeforePrevious = snapshots.slice(0, -2)

  const baseline = calculateBaseline(historyBeforeLatest, latestSnapshot)
  const prediction = buildPrediction(baseline, historyBeforeLatest.slice(-2), previousSnapshot, locale)
  const predictionReview = reviewPrediction(prediction, latestSnapshot.observedAt, latestSnapshot)

  const previousBaseline = calculateBaseline(historyBeforePrevious, previousSnapshot)
  const previousPrediction = buildPrediction(
    previousBaseline,
    historyBeforePrevious.slice(-2),
    historyBeforePrevious[historyBeforePrevious.length - 1],
    locale,
  )
  const previousReview = reviewPrediction(previousPrediction, previousSnapshot.observedAt, previousSnapshot)

  const score = scoreAnomaly({
    currentDrivers: predictionReview.strongestDrivers,
    previousDrivers: previousReview.strongestDrivers,
    contextMarkers: latestSnapshot.contextMarkers,
  })

  const statusBase = {
    scenarioId,
    locale,
    ingestion: ingestionResult.ingestion,
    currentLevel: score.level,
    previousLevel: score.previousLevel,
    trend: score.trend,
    window: getLocaleCopy(locale).window,
    latestSnapshot,
    baseline,
    prediction,
    predictionReview,
    topDrivers: predictionReview.strongestDrivers,
  }

  return {
    ...statusBase,
    explanation: buildExplanation(statusBase, locale),
  }
}