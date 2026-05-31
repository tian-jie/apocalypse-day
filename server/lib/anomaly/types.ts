export type ContextMarker =
  | 'holiday'
  | 'weather'
  | 'conference'
  | 'sports-event'
  | 'maintenance'

export type FixtureScenarioId = 'normal-day' | 'holiday-spike' | 'extreme-anomaly'

export type IngestionMode = 'mock' | 'real' | 'real-with-fallback'

export type IngestionSourceKind = 'mock' | 'real' | 'fallback'

export type IngestionFreshness = 'fresh' | 'stale'

export type IngestionSourceStatus = 'healthy' | 'degraded' | 'failed'

export type MetricKey =
  | 'takeoffs'
  | 'landings'
  | 'activeAircraft'
  | 'keyCityDeparturesTotal'
  | 'destinationConcentration'
  | 'crossBorderRatio'
  | 'missingIdentificationRatio'

export interface HourlyAircraftSnapshot {
  id: string
  observedAt: string
  scenarioId: FixtureScenarioId
  takeoffs: number
  landings: number
  activeAircraft: number
  keyCityDepartures: Record<string, number>
  destinationConcentration: number
  crossBorderRatio: number
  missingIdentificationRatio: number
  contextMarkers: ContextMarker[]
}

export interface IngestionMetadata {
  requestedMode: IngestionMode
  sourceKind: IngestionSourceKind
  providerName: string
  sourceStatus: IngestionSourceStatus
  freshness: IngestionFreshness
  degraded: boolean
  providerObservedAt?: string
  lastSuccessfulObservedAt?: string
  persistedAt?: string
  fallbackReason?: string
  notes: string[]
}

export interface SnapshotIngestionQuery {
  scenarioId: FixtureScenarioId
}

export interface SnapshotIngestionResult {
  scenarioId: FixtureScenarioId
  snapshots: HourlyAircraftSnapshot[]
  ingestion: IngestionMetadata
}

export interface MetricRange {
  min: number
  max: number
  average: number
}

export type MetricRangeMap = Record<MetricKey, MetricRange>

export interface Baseline {
  sampleSize: number
  hourOfDay: number
  dayOfWeek: number
  ranges: MetricRangeMap
}

export interface Prediction {
  targetObservedAt: string
  generatedAt: string
  ranges: MetricRangeMap
  rationale: string
}

export interface MetricDeviation {
  metric: MetricKey
  expectedMidpoint: number
  expectedMin: number
  expectedMax: number
  actual: number
  delta: number
  deltaRatio: number
}

export interface AnomalyDriver {
  metric: MetricKey
  label: string
  deltaRatio: number
  weight: number
  contribution: number
}

export interface PredictionReview {
  targetObservedAt: string
  reviewedAt: string
  deviations: MetricDeviation[]
  strongestDrivers: AnomalyDriver[]
}

export interface AnomalyScore {
  level: number
  numericScore: number
  previousLevel: number
  trend: 'rising' | 'stable' | 'cooling'
}

export interface AnomalyExplanation {
  headline: string
  summary: string
  benignContext: string[]
}

export interface DashboardStatus {
  scenarioId: FixtureScenarioId
  locale: 'zh-CN' | 'en'
  ingestion: IngestionMetadata
  currentLevel: number
  previousLevel: number
  trend: 'rising' | 'stable' | 'cooling'
  window: string
  latestSnapshot: HourlyAircraftSnapshot
  baseline: Baseline
  prediction: Prediction
  predictionReview: PredictionReview
  topDrivers: AnomalyDriver[]
  explanation: AnomalyExplanation
}

export interface AircraftSnapshotIngestionSource {
  getSnapshots: (query: SnapshotIngestionQuery) => Promise<SnapshotIngestionResult>
  listScenarioIds: () => FixtureScenarioId[]
}