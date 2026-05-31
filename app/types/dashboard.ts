export type Locale = 'zh-CN' | 'en'

export type ScenarioId = 'normal-day' | 'holiday-spike' | 'extreme-anomaly'

export interface SummaryResponse {
  locale: Locale
  scenarioId: ScenarioId
  currentLevel: number
  previousLevel: number
  trend: 'rising' | 'stable' | 'cooling'
  headline: string
  summary: string
  benignContext: string[]
  window: string
  forecastTakeoffs: number
  actualTakeoffs: number
  deviationPercent: number
  drivers: string[]
  latestSnapshot: {
    observedAt: string
    takeoffs: number
    landings: number
    activeAircraft: number
    keyCityDepartures: Record<string, number>
    destinationConcentration: number
    crossBorderRatio: number
    missingIdentificationRatio: number
    contextMarkers: string[]
  }
  baseline: {
    sampleSize: number
    ranges: Record<
      string,
      {
        min: number
        max: number
        average: number
      }
    >
  }
  prediction: {
    targetObservedAt: string
    rationale: string
  }
  predictionReview: {
    strongestDrivers: Array<{
      label: string
      deltaRatio: number
      contribution: number
    }>
  }
}

export interface ScenarioOption {
  id: ScenarioId
  label: string
  note: string
}