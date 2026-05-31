import { describe, expect, it } from 'vitest'

import { toSignalSummaryResponse } from '../server/lib/anomaly/api'
import { buildDashboardStatus } from '../server/lib/anomaly/dashboard'

describe('anomaly engine scenarios', () => {
  it('keeps normal-day within low anomaly levels', async () => {
    const status = await buildDashboardStatus('normal-day')

    expect(status.currentLevel).toBeLessThanOrEqual(2)
    expect(status.topDrivers.length).toBeGreaterThan(0)
  })

  it('marks holiday-spike as a notable but moderated anomaly', async () => {
    const status = await buildDashboardStatus('holiday-spike')

    expect(status.currentLevel).toBe(3)
    expect(status.explanation.benignContext.length).toBeGreaterThan(0)
  })

  it('marks extreme-anomaly as a high-severity case', async () => {
    const status = await buildDashboardStatus('extreme-anomaly')

    expect(status.currentLevel).toBeGreaterThanOrEqual(4)
    expect(status.topDrivers[0]?.deltaRatio).toBeGreaterThan(1)
  })

  it('localizes summary output for english locale', async () => {
    const status = await buildDashboardStatus('normal-day', 'en')
    const summary = toSignalSummaryResponse(status, 'en')

    expect(summary.locale).toBe('en')
    expect(summary.window).toBe('Last completed hour')
    expect(summary.drivers[0]).toContain('weight')
  })
})