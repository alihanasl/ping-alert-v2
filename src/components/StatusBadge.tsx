import { useTranslation } from 'react-i18next'
import type { MonitorStatus, Target } from '@shared/types'
import { currentDateLocale, isMonitoredCheckType, statusLabelKey } from '../lib/labels'
import { tStored } from '../lib/translate'

interface StatusBadgeProps {
  target: Target
}

const DOT_CLASS: Record<MonitorStatus, string> = {
  up: 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.85)]',
  down: 'bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.55)]',
  unknown: 'bg-amber-400'
}

const TEXT_CLASS: Record<MonitorStatus, string> = {
  up: 'text-teal-400',
  down: 'text-red-400',
  unknown: 'text-amber-300'
}

export function StatusBadge({ target }: StatusBadgeProps) {
  const { t } = useTranslation()
  const live = target.enabled && isMonitoredCheckType(target.checkType)
  const displayStatus: MonitorStatus = live ? target.status : 'unknown'
  const checkedAt = formatTime(target.lastCheckedAt)

  function statusLabel(): string {
    if (!target.enabled) {
      return t('device.status.disabled')
    }

    if (!isMonitoredCheckType(target.checkType)) {
      return t('device.status.comingSoon')
    }

    return t(statusLabelKey(target.status))
  }

  return (
    <div className="min-w-28 text-right">
      <p className={`flex items-center justify-end gap-2 text-sm font-medium ${TEXT_CLASS[displayStatus]}`}>
        <span
          className={`size-2.5 rounded-full ${DOT_CLASS[displayStatus]} ${
            live && target.status === 'up' ? 'animate-pulse' : ''
          }`}
        />
        {statusLabel()}
      </p>
      {live && target.status === 'up' && target.responseTimeMs !== null ? (
        <p className="text-xs tabular-nums text-slate-500">
          {t('unit.ms', { value: target.responseTimeMs })}
        </p>
      ) : null}
      {live && target.message && target.status !== 'up' ? (
        <p className="mt-0.5 max-w-40 truncate text-xs text-slate-500" title={tStored(target.message)}>
          {tStored(target.message)}
        </p>
      ) : null}
      {live && checkedAt ? <p className="text-xs text-slate-600">{checkedAt}</p> : null}
    </div>
  )
}

function formatTime(value: string | null): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.toLocaleTimeString(currentDateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
