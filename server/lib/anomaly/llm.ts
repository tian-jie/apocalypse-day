import { defaultLocale, getLocaleCopy, type Locale } from './i18n'
import type { Baseline, Prediction } from './types'

export interface AnomalyLlmAdapter {
  summarizePrediction: (input: {
    baseline: Baseline
    prediction: Prediction
    locale?: Locale
  }) => Promise<string>
}

export class NoopAnomalyLlmAdapter implements AnomalyLlmAdapter {
  async summarizePrediction(input: { baseline: Baseline; prediction: Prediction; locale?: Locale }) {
    const locale = input.locale ?? defaultLocale
    return getLocaleCopy(locale).llmFallback(
      input.baseline.sampleSize,
      input.prediction.targetObservedAt,
    )
  }
}

export const defaultAnomalyLlmAdapter = new NoopAnomalyLlmAdapter()