import type { ContextMarker, MetricKey } from './types'

export type Locale = 'zh-CN' | 'en'

export const defaultLocale: Locale = 'zh-CN'

export function isSupportedLocale(value: string): value is Locale {
  return value === 'zh-CN' || value === 'en'
}

const metricLabelsByLocale: Record<Locale, Record<MetricKey, string>> = {
  'zh-CN': {
    takeoffs: '起飞数量',
    landings: '降落数量',
    activeAircraft: '活跃航空器数量',
    keyCityDeparturesTotal: '重点城市起飞总量',
    destinationConcentration: '目的地集中度',
    crossBorderRatio: '跨境比例',
    missingIdentificationRatio: '身份缺失比例',
  },
  en: {
    takeoffs: 'takeoff count',
    landings: 'landing count',
    activeAircraft: 'active aircraft count',
    keyCityDeparturesTotal: 'key-city departure total',
    destinationConcentration: 'destination concentration',
    crossBorderRatio: 'cross-border ratio',
    missingIdentificationRatio: 'missing-identification ratio',
  },
}

const benignContextByLocale: Record<Locale, Record<ContextMarker, string>> = {
  'zh-CN': {
    holiday: '检测到节假日标记，部分异常可能来自集中出行。',
    weather: '天气因素可能放大部分航班重新调度信号。',
    conference: '大型会议可能推高重点城市的集中起降。',
    'sports-event': '体育赛事可能造成短时客流集中。',
    maintenance: '维护或调度事件可能导致身份缺失比例上升。',
  },
  en: {
    holiday: 'A holiday marker was detected, so some deviations may come from concentrated travel.',
    weather: 'Weather conditions may be amplifying flight rescheduling signals.',
    conference: 'A major conference may be increasing concentrated departures from key cities.',
    'sports-event': 'A sports event may be driving a short-term concentration of travel demand.',
    maintenance: 'Maintenance or dispatch activity may be increasing the missing-identification ratio.',
  },
}

const localeCopy = {
  'zh-CN': {
    window: '最近完成的一个小时',
    headlineLevel: {
      high: '出现高强度同步偏差',
      medium: '出现需要人工关注的显著偏差',
      low: '整体仍接近常态波动',
    },
    explanationSummary: (label: string, deltaRatio: number, rationale: string) =>
      `${label}是当前最强驱动因素，预测与实际偏差比为 ${deltaRatio.toFixed(2)}。${rationale}。`,
    predictionRationale: (labels: Record<MetricKey, string>) => [
      `${labels.takeoffs}延续最近两小时的温和变化`,
      `${labels.destinationConcentration}参考历史同时间窗口基线`,
      `${labels.crossBorderRatio}使用滚动历史做小幅修正`,
    ].join('，'),
    driverLine: (label: string, weight: number, contribution: number) =>
      `${label} 偏差权重 ${weight.toFixed(2)}，贡献 ${contribution.toFixed(2)}`,
    llmFallback: (sampleSize: number, targetObservedAt: string) =>
      `未启用 LLM 适配器，当前仍使用确定性预测说明。样本数 ${sampleSize}，目标时间 ${targetObservedAt}。`,
  },
  en: {
    window: 'Last completed hour',
    headlineLevel: {
      high: 'High-intensity synchronized deviation detected',
      medium: 'A notable deviation requires analyst attention',
      low: 'Activity remains close to routine variation',
    },
    explanationSummary: (label: string, deltaRatio: number, rationale: string) =>
      `${label} is the strongest active driver, with a forecast-vs-actual deviation ratio of ${deltaRatio.toFixed(2)}. ${rationale}.`,
    predictionRationale: (labels: Record<MetricKey, string>) => [
      `${labels.takeoffs} follows the recent two-hour movement`,
      `${labels.destinationConcentration} stays anchored to the historical time-window baseline`,
      `${labels.crossBorderRatio} is slightly adjusted with rolling history`,
    ].join(', '),
    driverLine: (label: string, weight: number, contribution: number) =>
      `${label} weight ${weight.toFixed(2)}, contribution ${contribution.toFixed(2)}`,
    llmFallback: (sampleSize: number, targetObservedAt: string) =>
      `LLM adapter is not enabled; deterministic prediction copy is being used. Sample size ${sampleSize}, target time ${targetObservedAt}.`,
  },
} as const

export function getMetricLabels(locale: Locale) {
  return metricLabelsByLocale[locale]
}

export function getBenignContextCopy(locale: Locale) {
  return benignContextByLocale[locale]
}

export function getLocaleCopy(locale: Locale) {
  return localeCopy[locale]
}