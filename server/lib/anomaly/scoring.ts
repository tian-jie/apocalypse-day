import { getDriverWeights } from './review'
import type { AnomalyDriver, AnomalyScore, ContextMarker } from './types'

const benignAdjustments: Partial<Record<ContextMarker, number>> = {
  holiday: 0.18,
  weather: 0.05,
  conference: 0.05,
}

function toLevel(score: number) {
  if (score < 0.55) {
    return 1
  }
  if (score < 1.0) {
    return 2
  }
  if (score < 2.2) {
    return 3
  }
  if (score < 3.2) {
    return 4
  }
  return 5
}

export function scoreAnomaly(input: {
  currentDrivers: AnomalyDriver[]
  previousDrivers: AnomalyDriver[]
  contextMarkers: ContextMarker[]
}): AnomalyScore {
  const weights = getDriverWeights()
  const contributionScale = 1.8
  const allContribution = input.currentDrivers.reduce((sum, driver) => sum + driver.contribution, 0)
  const markerAdjustment = input.contextMarkers.reduce(
    (sum, marker) => sum + (benignAdjustments[marker] ?? 0),
    0,
  )
  const normalizedScore = Math.max(allContribution * contributionScale - markerAdjustment, 0)

  const previousScore = input.previousDrivers.reduce((sum, driver) => {
    return sum + driver.deltaRatio * weights[driver.metric] * contributionScale
  }, 0)

  const currentLevel = toLevel(normalizedScore)
  const previousLevel = toLevel(previousScore)
  const trend =
    currentLevel > previousLevel ? 'rising' : currentLevel < previousLevel ? 'cooling' : 'stable'

  return {
    level: currentLevel,
    numericScore: Number(normalizedScore.toFixed(2)),
    previousLevel,
    trend,
  }
}