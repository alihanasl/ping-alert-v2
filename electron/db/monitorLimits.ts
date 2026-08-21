import { i18nError } from '@shared/i18nMessage'
import { MONITOR_LIMITS } from '@shared/types'

export function normalizeIntervalSeconds(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < MONITOR_LIMITS.intervalSeconds.min ||
    value > MONITOR_LIMITS.intervalSeconds.max
  ) {
    throw i18nError('errors.settings.interval', {
      min: MONITOR_LIMITS.intervalSeconds.min,
      max: MONITOR_LIMITS.intervalSeconds.max
    })
  }

  return value
}

export function normalizeFailureThreshold(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < MONITOR_LIMITS.failureThreshold.min ||
    value > MONITOR_LIMITS.failureThreshold.max
  ) {
    throw i18nError('errors.settings.threshold', {
      min: MONITOR_LIMITS.failureThreshold.min,
      max: MONITOR_LIMITS.failureThreshold.max
    })
  }

  return value
}
