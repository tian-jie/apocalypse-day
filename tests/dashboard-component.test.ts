import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AnomalyDashboard from '../app/components/AnomalyDashboard.vue'
import { getScenarioOptions, localeOptions } from '../app/i18n/dashboard'
import type { Locale, SummaryResponse } from '../app/types/dashboard'
import { toSignalSummaryResponse } from '../server/lib/anomaly/api'
import { buildDashboardStatus } from '../server/lib/anomaly/dashboard'

async function buildSummary(
  scenarioId: 'normal-day' | 'holiday-spike' | 'extreme-anomaly',
  locale: Locale,
): Promise<SummaryResponse> {
  const status = await buildDashboardStatus(scenarioId, locale)
  return toSignalSummaryResponse(status, locale)
}

describe('AnomalyDashboard', () => {
  it('renders all fixture scenarios without crashing', async () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      const scenarios = getScenarioOptions(locale)
      for (const scenario of scenarios) {
        const summary = await buildSummary(scenario.id, locale)
        const wrapper = mount(AnomalyDashboard, {
          props: {
            summary,
            scenarios,
            localeOptions,
            selectedLocale: locale,
            selectedScenario: scenario.id,
          },
        })

        expect(wrapper.text()).toContain(scenario.label)
        expect(wrapper.text()).toContain(summary.headline)
      }
    }
  })

  it('renders benign context when present', async () => {
    const locale = 'zh-CN'
    const scenarios = getScenarioOptions(locale)
    const summary = await buildSummary('holiday-spike', locale)
    const wrapper = mount(AnomalyDashboard, {
      props: {
        summary,
        scenarios,
        localeOptions,
        selectedLocale: locale,
        selectedScenario: 'holiday-spike',
      },
    })

    expect(wrapper.text()).toContain('节假日')
  })

  it('renders english guardrail copy', async () => {
    const locale = 'en'
    const scenarios = getScenarioOptions(locale)
    const summary = await buildSummary('normal-day', locale)
    const wrapper = mount(AnomalyDashboard, {
      props: {
        summary,
        scenarios,
        localeOptions,
        selectedLocale: locale,
        selectedScenario: 'normal-day',
      },
    })

    expect(wrapper.text()).toContain('Language')
    expect(wrapper.text()).toContain('This system measures anomaly signals')
  })
})