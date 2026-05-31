import type { FixtureScenarioId, HourlyAircraftSnapshot } from './types'

const keyCities = {
  london: 18,
  singapore: 16,
  dubai: 14,
  newYork: 15,
}

function makeSnapshot(
  scenarioId: FixtureScenarioId,
  id: string,
  observedAt: string,
  metrics: Partial<HourlyAircraftSnapshot>,
): HourlyAircraftSnapshot {
  return {
    id,
    observedAt,
    scenarioId,
    takeoffs: 120,
    landings: 118,
    activeAircraft: 460,
    keyCityDepartures: {
      london: keyCities.london,
      singapore: keyCities.singapore,
      dubai: keyCities.dubai,
      newYork: keyCities.newYork,
    },
    destinationConcentration: 0.33,
    crossBorderRatio: 0.36,
    missingIdentificationRatio: 0.04,
    contextMarkers: [],
    ...metrics,
  }
}

const fixtures: Record<FixtureScenarioId, HourlyAircraftSnapshot[]> = {
  'normal-day': [
    makeSnapshot('normal-day', 'n-1', '2026-05-23T10:00:00.000Z', {
      takeoffs: 119,
      landings: 118,
      activeAircraft: 456,
      destinationConcentration: 0.31,
      crossBorderRatio: 0.35,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 18, singapore: 16, dubai: 13, newYork: 14 },
    }),
    makeSnapshot('normal-day', 'n-2', '2026-05-16T10:00:00.000Z', {
      takeoffs: 121,
      landings: 120,
      activeAircraft: 462,
      destinationConcentration: 0.32,
      crossBorderRatio: 0.36,
      missingIdentificationRatio: 0.05,
      keyCityDepartures: { london: 19, singapore: 15, dubai: 14, newYork: 15 },
    }),
    makeSnapshot('normal-day', 'n-3', '2026-05-09T10:00:00.000Z', {
      takeoffs: 117,
      landings: 116,
      activeAircraft: 452,
      destinationConcentration: 0.3,
      crossBorderRatio: 0.34,
      missingIdentificationRatio: 0.03,
      keyCityDepartures: { london: 17, singapore: 15, dubai: 14, newYork: 13 },
    }),
    makeSnapshot('normal-day', 'n-4', '2026-05-29T08:00:00.000Z', {
      takeoffs: 122,
      landings: 120,
      activeAircraft: 465,
      destinationConcentration: 0.32,
      crossBorderRatio: 0.35,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 18, singapore: 16, dubai: 14, newYork: 15 },
    }),
    makeSnapshot('normal-day', 'n-5', '2026-05-29T09:00:00.000Z', {
      takeoffs: 124,
      landings: 123,
      activeAircraft: 468,
      destinationConcentration: 0.34,
      crossBorderRatio: 0.37,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 19, singapore: 16, dubai: 15, newYork: 16 },
    }),
    makeSnapshot('normal-day', 'n-6', '2026-05-29T10:00:00.000Z', {
      takeoffs: 126,
      landings: 125,
      activeAircraft: 472,
      destinationConcentration: 0.35,
      crossBorderRatio: 0.38,
      missingIdentificationRatio: 0.05,
      keyCityDepartures: { london: 20, singapore: 17, dubai: 15, newYork: 16 },
    }),
  ],
  'holiday-spike': [
    makeSnapshot('holiday-spike', 'h-1', '2026-05-23T10:00:00.000Z', {
      takeoffs: 119,
      landings: 117,
      activeAircraft: 454,
      destinationConcentration: 0.32,
      crossBorderRatio: 0.36,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 17, singapore: 15, dubai: 14, newYork: 14 },
    }),
    makeSnapshot('holiday-spike', 'h-2', '2026-05-16T10:00:00.000Z', {
      takeoffs: 122,
      landings: 121,
      activeAircraft: 459,
      destinationConcentration: 0.33,
      crossBorderRatio: 0.37,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 18, singapore: 16, dubai: 14, newYork: 15 },
    }),
    makeSnapshot('holiday-spike', 'h-3', '2026-05-29T08:00:00.000Z', {
      takeoffs: 128,
      landings: 124,
      activeAircraft: 478,
      destinationConcentration: 0.39,
      crossBorderRatio: 0.41,
      missingIdentificationRatio: 0.05,
      keyCityDepartures: { london: 20, singapore: 18, dubai: 16, newYork: 17 },
    }),
    makeSnapshot('holiday-spike', 'h-4', '2026-05-29T09:00:00.000Z', {
      takeoffs: 134,
      landings: 131,
      activeAircraft: 489,
      destinationConcentration: 0.43,
      crossBorderRatio: 0.46,
      missingIdentificationRatio: 0.05,
      contextMarkers: ['holiday', 'weather'],
      keyCityDepartures: { london: 23, singapore: 20, dubai: 18, newYork: 19 },
    }),
    makeSnapshot('holiday-spike', 'h-5', '2026-05-29T10:00:00.000Z', {
      takeoffs: 154,
      landings: 149,
      activeAircraft: 534,
      destinationConcentration: 0.54,
      crossBorderRatio: 0.57,
      missingIdentificationRatio: 0.06,
      contextMarkers: ['holiday', 'weather'],
      keyCityDepartures: { london: 31, singapore: 26, dubai: 23, newYork: 25 },
    }),
  ],
  'extreme-anomaly': [
    makeSnapshot('extreme-anomaly', 'x-1', '2026-05-23T10:00:00.000Z', {
      takeoffs: 120,
      landings: 118,
      activeAircraft: 458,
      destinationConcentration: 0.32,
      crossBorderRatio: 0.36,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 18, singapore: 16, dubai: 14, newYork: 14 },
    }),
    makeSnapshot('extreme-anomaly', 'x-2', '2026-05-16T10:00:00.000Z', {
      takeoffs: 121,
      landings: 120,
      activeAircraft: 462,
      destinationConcentration: 0.33,
      crossBorderRatio: 0.35,
      missingIdentificationRatio: 0.04,
      keyCityDepartures: { london: 19, singapore: 16, dubai: 14, newYork: 15 },
    }),
    makeSnapshot('extreme-anomaly', 'x-3', '2026-05-29T08:00:00.000Z', {
      takeoffs: 127,
      landings: 125,
      activeAircraft: 472,
      destinationConcentration: 0.36,
      crossBorderRatio: 0.38,
      missingIdentificationRatio: 0.05,
      keyCityDepartures: { london: 20, singapore: 17, dubai: 15, newYork: 16 },
    }),
    makeSnapshot('extreme-anomaly', 'x-4', '2026-05-29T09:00:00.000Z', {
      takeoffs: 138,
      landings: 136,
      activeAircraft: 503,
      destinationConcentration: 0.49,
      crossBorderRatio: 0.52,
      missingIdentificationRatio: 0.08,
      contextMarkers: ['conference'],
      keyCityDepartures: { london: 29, singapore: 25, dubai: 22, newYork: 24 },
    }),
    makeSnapshot('extreme-anomaly', 'x-5', '2026-05-29T10:00:00.000Z', {
      takeoffs: 189,
      landings: 184,
      activeAircraft: 642,
      destinationConcentration: 0.76,
      crossBorderRatio: 0.72,
      missingIdentificationRatio: 0.19,
      contextMarkers: ['maintenance'],
      keyCityDepartures: { london: 42, singapore: 35, dubai: 31, newYork: 33 },
    }),
  ],
}

export function listFixtureScenarioIds(): FixtureScenarioId[] {
  return Object.keys(fixtures) as FixtureScenarioId[]
}

export function getScenarioSnapshots(scenarioId: FixtureScenarioId): HourlyAircraftSnapshot[] {
  return fixtures[scenarioId].map((snapshot) => ({
    ...snapshot,
    keyCityDepartures: { ...snapshot.keyCityDepartures },
    contextMarkers: [...snapshot.contextMarkers],
  }))
}