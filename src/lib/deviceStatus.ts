import type { Target } from '@shared/types'
import { isMonitoredCheckType } from './labels'

export const DEVICE_UI_STATUSES = ['online', 'offline', 'unknown', 'disabled'] as const

export type DeviceUiStatus = (typeof DEVICE_UI_STATUSES)[number]

export type DeviceStatusFilter = 'all' | DeviceUiStatus

export function getDeviceUiStatus(target: Target): DeviceUiStatus {
  if (!target.enabled) {
    return 'disabled'
  }

  if (!isMonitoredCheckType(target.checkType)) {
    return 'unknown'
  }

  if (target.status === 'up') {
    return 'online'
  }

  if (target.status === 'down') {
    return 'offline'
  }

  return 'unknown'
}

const STATUS_RANK: Record<DeviceUiStatus, number> = {
  offline: 0,
  unknown: 1,
  online: 2,
  disabled: 3
}

export function compareDashboardTargets(left: Target, right: Target, locale: string): number {
  const rankDiff = STATUS_RANK[getDeviceUiStatus(left)] - STATUS_RANK[getDeviceUiStatus(right)]
  if (rankDiff !== 0) {
    return rankDiff
  }

  return left.name.localeCompare(right.name, locale, { numeric: true, sensitivity: 'base' })
}

export function countDeviceStatuses(targets: Target[]): Record<DeviceUiStatus | 'total', number> {
  const counts: Record<DeviceUiStatus | 'total', number> = {
    total: targets.length,
    online: 0,
    offline: 0,
    unknown: 0,
    disabled: 0
  }

  for (const target of targets) {
    counts[getDeviceUiStatus(target)] += 1
  }

  return counts
}
