import { useTranslation } from 'react-i18next'
import type { Target } from '@shared/types'
import { checkTypeLabelKey, formatUptime, isMonitoredCheckType } from '../lib/labels'
import { getDeviceUiStatus } from '../lib/deviceStatus'
import { targetAddress } from '../lib/targetAddress'
import { StatusBadge } from './StatusBadge'

interface DeviceRowProps {
  target: Target
  groupName: string
  onHistory: () => void
  onEdit: () => void
  onDelete: () => void
}

const ROW_TONE: Record<string, string> = {
  online: 'border-slate-800/80 bg-slate-900/55 hover:border-teal-500/30',
  offline: 'border-red-500/25 bg-red-950/25 hover:border-red-400/40',
  unknown: 'border-amber-500/15 bg-amber-950/10 hover:border-amber-400/30',
  disabled: 'border-slate-800/80 bg-slate-900/30 opacity-80 hover:border-slate-700'
}

const ACCENT: Record<string, string> = {
  online: 'bg-teal-400',
  offline: 'bg-red-500',
  unknown: 'bg-amber-400',
  disabled: 'bg-slate-600'
}

export function DeviceRow({ target, groupName, onHistory, onEdit, onDelete }: DeviceRowProps) {
  const { t } = useTranslation()
  const uiStatus = getDeviceUiStatus(target)

  return (
    <li className={`relative flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4 pl-6 transition ${ROW_TONE[uiStatus]}`}>
      <span className={`absolute inset-y-3 left-0 w-1 rounded-full ${ACCENT[uiStatus]}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-medium text-slate-100">{target.name}</p>
          <span className="rounded-full border border-slate-700/80 bg-slate-950/40 px-2 py-0.5 text-[11px] text-slate-300">
            {t(checkTypeLabelKey(target.checkType))}
          </span>
        </div>
        <p className="mt-0.5 truncate font-mono text-sm text-slate-400">{targetAddress(target)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {t('devices.meta', {
            group: groupName,
            interval: target.intervalSeconds,
            threshold: target.failureThreshold
          })}
          {isMonitoredCheckType(target.checkType)
            ? ` · ${t('devices.uptime', { value: formatUptime(target.uptimePercent) })}`
            : ''}
        </p>
      </div>
      <StatusBadge target={target} />
      <div className="flex gap-1">
        {isMonitoredCheckType(target.checkType) ? (
          <button
            type="button"
            onClick={onHistory}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('nav.history')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
        >
          {t('common.edit')}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg px-3 py-1.5 text-sm text-red-400 hover:bg-red-950/50"
        >
          {t('common.delete')}
        </button>
      </div>
    </li>
  )
}
