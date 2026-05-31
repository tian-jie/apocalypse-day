<script setup lang="ts">
import AnomalyDashboard from '../components/AnomalyDashboard.vue'
import { getScenarioOptions, localeOptions } from '../i18n/dashboard'
import type { Locale, ScenarioId, SummaryResponse } from '../types/dashboard'

const selectedScenario = ref<ScenarioId>('normal-day')
const selectedLocale = ref<Locale>('zh-CN')
const scenarioOptions = computed(() => getScenarioOptions(selectedLocale.value))

const { data: summary, status } = await useAsyncData(
  () =>
    $fetch<SummaryResponse>('/api/signals/summary', {
      query: {
        scenario: selectedScenario.value,
        locale: selectedLocale.value,
      },
    }),
  {
    watch: [selectedScenario, selectedLocale],
  },
)
</script>

<template>
  <AnomalyDashboard
    :summary="summary ?? null"
    :scenarios="scenarioOptions"
    :locale-options="localeOptions"
    :selected-locale="selectedLocale"
    :selected-scenario="selectedScenario"
    :pending="status === 'pending'"
    @update:selected-locale="selectedLocale = $event as Locale"
    @update:selected-scenario="selectedScenario = $event as ScenarioId"
  />
</template>