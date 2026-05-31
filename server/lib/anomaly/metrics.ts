import type { HourlyAircraftSnapshot, MetricKey } from './types'

export const metricLabels: Record<MetricKey, string> = {
  takeoffs: '起飞数量',
  landings: '降落数量',
  activeAircraft: '活跃航空器数量',
  keyCityDeparturesTotal: '重点城市起飞总量',
  destinationConcentration: '目的地集中度',
  crossBorderRatio: '跨境比例',
  missingIdentificationRatio: '身份缺失比例',
}

export function getMetricValue(snapshot: HourlyAircraftSnapshot, metric: MetricKey): number {
  switch (metric) {
    case 'takeoffs':
      return snapshot.takeoffs
    case 'landings':
      return snapshot.landings
    case 'activeAircraft':
      return snapshot.activeAircraft
    case 'keyCityDeparturesTotal':
      return Object.values(snapshot.keyCityDepartures).reduce((total, value) => total + value, 0)
    case 'destinationConcentration':
      return snapshot.destinationConcentration
    case 'crossBorderRatio':
      return snapshot.crossBorderRatio
    case 'missingIdentificationRatio':
      return snapshot.missingIdentificationRatio
  }
}

export const trackedMetrics: MetricKey[] = [
  'takeoffs',
  'landings',
  'activeAircraft',
  'keyCityDeparturesTotal',
  'destinationConcentration',
  'crossBorderRatio',
  'missingIdentificationRatio',
]