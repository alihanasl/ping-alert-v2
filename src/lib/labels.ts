import type { CheckType, HistoryRange, MonitorStatus } from '@shared/types'
import { CHECK_TYPES } from '@shared/types'
import { toBcp47 } from '@shared/locales'
import i18n from '../i18n'

export function isMonitoredCheckType(checkType: CheckType): boolean {
  return (
    checkType === 'icmp' ||
    checkType === 'tcp' ||
    checkType === 'http' ||
    checkType === 'snmp'
  )
}

export function checkTypeLabelKey(checkType: CheckType): string {
  if (checkType === 'http') {
    return 'monitoring.httpHttps'
  }

  return `monitoring.${checkType}`
}

export const CHECK_TYPE_OPTIONS = CHECK_TYPES.map((value) => ({
  value,
  labelKey: checkTypeLabelKey(value)
}))

export function statusLabelKey(status: MonitorStatus): string {
  if (status === 'up') {
    return 'device.status.online'
  }

  if (status === 'down') {
    return 'device.status.offline'
  }

  return 'device.status.unknown'
}

export function historyRangeLabelKey(range: HistoryRange): string {
  return `history.range.${range}`
}

export function currentDateLocale(): string {
  return toBcp47(i18n.language)
}

export function formatUptime(percent: number | null): string {
  if (percent === null) {
    return i18n.t('common.emDash')
  }

  return `${percent.toLocaleString(currentDateLocale(), {
    minimumFractionDigits: percent % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1
  })}%`
}

export function formatMs(value: number | null): string {
  if (value === null) {
    return i18n.t('common.emDash')
  }

  return i18n.t('unit.ms', { value: value.toLocaleString(currentDateLocale()) })
}
