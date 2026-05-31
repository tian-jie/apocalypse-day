import { calculateBaseline } from './baseline'
import { buildExplanation } from './explanation'
import { defaultIngestionSource } from './ingestion'
import { defaultLocale, getLocaleCopy, type Locale } from './i18n'
import { buildPrediction } from './prediction'
import { reviewPrediction } from './review'
import { scoreAnomaly } from './scoring'
import type { DashboardStatus, FixtureScenarioId } from './types'

function sortByObservedAt(left: { observedAt: string }, right: { observedAt: string }) {
  return new Date(left.observedAt).getTime() - new Date(right.observedAt).getTime()
}

export async function buildDashboardStatus(
  scenarioId: FixtureScenarioId = 'normal-day',
  locale: Locale = defaultLocale,
): Promise<DashboardStatus> {
  const ingestionResult = await defaultIngestionSource.getSnapshots({ scenarioId })
  const snapshots = ingestionResult.snapshots.sort(sortByObservedAt)
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