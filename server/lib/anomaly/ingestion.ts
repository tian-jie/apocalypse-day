import { getScenarioSnapshots, listFixtureScenarioIds } from './mock-data'
import type { AircraftSnapshotIngestionSource, FixtureScenarioId } from './types'

export class MockAircraftSnapshotSource implements AircraftSnapshotIngestionSource {
  async listSnapshots(scenarioId: FixtureScenarioId) {
    return getScenarioSnapshots(scenarioId)
  }

  listScenarioIds() {
    return listFixtureScenarioIds()
  }
}

export const defaultIngestionSource = new MockAircraftSnapshotSource()