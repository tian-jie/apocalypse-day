<script setup lang="ts">
import { computed } from 'vue'

import { getDashboardCopy } from '../i18n/dashboard'
import type { Locale, ScenarioOption, SummaryResponse } from '../types/dashboard'

const props = defineProps<{
  summary: SummaryResponse | null
  scenarios: ScenarioOption[]
  localeOptions: Array<{ id: Locale; label: string }>
  selectedLocale: Locale
  selectedScenario: string
  pending?: boolean
}>()

const emit = defineEmits<{
  'update:selectedLocale': [locale: Locale]
  'update:selectedScenario': [scenarioId: string]
}>()

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

const keyCityDepartures = computed(() => {
  return Object.entries(props.summary?.latestSnapshot.keyCityDepartures ?? {})
})

const strongestDrivers = computed(() => {
  return props.summary?.predictionReview.strongestDrivers ?? []
})

const copy = computed(() => getDashboardCopy(props.selectedLocale))

const scoreCopy = computed(() => {
  if (!props.summary) {
    return copy.value.loading
  }
  if (props.summary.currentLevel >= 4) {
    return copy.value.statusHigh
  }
  if (props.summary.currentLevel === 3) {
    return copy.value.statusMedium
  }
  return copy.value.statusLow
})
</script>

<template>
  <main class="page-shell">
    <section class="hero-card hero-grid">
      <div>
        <p class="eyebrow">Aether Watch</p>
        <h1>{{ copy.heroTitle }}</h1>
        <p class="lede">{{ copy.heroLead }}</p>
      </div>

      <div class="hero-aside">
        <p class="panel-label">{{ copy.currentSignal }}</p>
        <h2 v-if="summary">{{ copy.levelLabel }} {{ summary.currentLevel }}</h2>
        <p>{{ scoreCopy }}</p>
        <small v-if="summary">{{ summary.window }}</small>
      </div>
    </section>

    <section class="locale-strip">
      <span class="locale-label">{{ copy.localeLabel }}</span>
      <button
        v-for="locale in localeOptions"
        :key="locale.id"
        class="locale-chip"
        :class="{ active: locale.id === selectedLocale }"
        type="button"
        @click="emit('update:selectedLocale', locale.id)"
      >
        {{ locale.label }}
      </button>
    </section>

    <section class="scenario-strip">
      <button
        v-for="scenario in scenarios"
        :key="scenario.id"
        class="scenario-chip"
        :class="{ active: scenario.id === selectedScenario }"
        type="button"
        @click="emit('update:selectedScenario', scenario.id)"
      >
        <strong>{{ scenario.label }}</strong>
        <span>{{ scenario.note }}</span>
      </button>
    </section>

    <p v-if="pending" class="loading-note">{{ copy.loading }}</p>

    <template v-if="summary">
      <section class="status-grid">
        <article class="panel accent">
          <p class="panel-label">{{ copy.anomalyNarrative }}</p>
          <h2>{{ summary.headline }}</h2>
          <p>{{ summary.summary }}</p>
          <small>
            {{ copy.trend }}：{{ copy.trendLabels[summary.trend] }} |
            {{ copy.previousLevel }}：{{ summary.previousLevel }}
          </small>
        </article>

        <article class="panel">
          <p class="panel-label">{{ copy.forecastVsActual }}</p>
          <div class="metric-strip">
            <div>
              <span>{{ copy.forecastTakeoffs }}</span>
              <strong>{{ summary.forecastTakeoffs }}</strong>
            </div>
            <div>
              <span>{{ copy.actualTakeoffs }}</span>
              <strong>{{ summary.actualTakeoffs }}</strong>
            </div>
            <div>
              <span>{{ copy.deviation }}</span>
              <strong>{{ summary.deviationPercent }}%</strong>
            </div>
          </div>
          <small>{{ copy.predictionTarget }}：{{ summary.prediction.targetObservedAt }}</small>
        </article>

        <article class="panel">
          <p class="panel-label">{{ copy.ingestionStatus }}</p>
          <ul class="detail-list">
            <li>{{ copy.sourceKind }}: {{ copy.sourceKindLabels[summary.ingestion.sourceKind] }}</li>
            <li>{{ copy.sourceStatus }}: {{ copy.sourceStatusLabels[summary.ingestion.sourceStatus] }}</li>
            <li>{{ copy.freshness }}: {{ copy.freshnessLabels[summary.ingestion.freshness] }}</li>
            <li v-if="summary.ingestion.providerObservedAt">
              {{ copy.providerTime }}: {{ summary.ingestion.providerObservedAt }}
            </li>
            <li v-if="summary.ingestion.fallbackReason">
              {{ copy.fallbackReason }}: {{ summary.ingestion.fallbackReason }}
            </li>
          </ul>
        </article>
      </section>

      <section class="detail-grid">
        <article class="panel">
          <p class="panel-label">{{ copy.latestSnapshot }}</p>
          <ul class="detail-list">
            <li>{{ copy.takeoffs }}: {{ summary.latestSnapshot.takeoffs }}</li>
            <li>{{ copy.landings }}: {{ summary.latestSnapshot.landings }}</li>
            <li>{{ copy.activeAircraft }}: {{ summary.latestSnapshot.activeAircraft }}</li>
            <li>{{ copy.destinationConcentration }}: {{ formatPercent(summary.latestSnapshot.destinationConcentration) }}</li>
            <li>{{ copy.crossBorderRatio }}: {{ formatPercent(summary.latestSnapshot.crossBorderRatio) }}</li>
            <li>{{ copy.missingIdentificationRatio }}: {{ formatPercent(summary.latestSnapshot.missingIdentificationRatio) }}</li>
          </ul>
        </article>

        <article class="panel">
          <p class="panel-label">{{ copy.topDrivers }}</p>
          <ul class="detail-list">
            <li v-for="driver in strongestDrivers" :key="driver.label">
              {{ copy.driverDetail(driver.label, driver.deltaRatio, driver.contribution) }}
            </li>
          </ul>
        </article>

        <article class="panel">
          <p class="panel-label">{{ copy.keyCityDepartures }}</p>
          <ul class="detail-list">
            <li v-for="[city, count] in keyCityDepartures" :key="city">
              {{ copy.cityCount(city, count) }}
            </li>
          </ul>
        </article>

        <article class="panel">
          <p class="panel-label">{{ copy.benignContext }}</p>
          <ul class="detail-list" v-if="summary.benignContext.length > 0">
            <li v-for="item in summary.benignContext" :key="item">{{ item }}</li>
          </ul>
          <p v-else>{{ copy.noBenignContext }}</p>
        </article>
      </section>

      <section class="detail-grid secondary-grid">
        <article class="panel">
          <p class="panel-label">{{ copy.baselineWindow }}</p>
          <p>{{ copy.sampleSize }}：{{ summary.baseline.sampleSize }}</p>
          <small>
            {{ copy.takeoffRange }} {{ summary.baseline.ranges.takeoffs.min.toFixed(1) }} -
            {{ summary.baseline.ranges.takeoffs.max.toFixed(1) }}
          </small>
        </article>

        <article class="panel">
          <p class="panel-label">{{ copy.predictionRationale }}</p>
          <p>{{ summary.prediction.rationale }}</p>
        </article>

        <article class="panel caution-panel">
          <p class="panel-label">{{ copy.guardrail }}</p>
          <p>{{ copy.guardrailCopy }}</p>
        </article>
      </section>
    </template>
  </main>
</template>