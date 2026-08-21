import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HistoryRange, Target, TargetHistory } from '@shared/types'
import { HISTORY_RANGES } from '@shared/types'
import {
  currentDateLocale,
  formatMs,
  formatUptime,
  historyRangeLabelKey,
  statusLabelKey
} from '../lib/labels'
import { tError } from '../lib/translate'
import { ResponseTimeChart, StatusStrip } from './HistoryCharts'

interface HistoryModalProps {
  target: Target
  onClose: () => void
}

export function HistoryModal({ target, onClose }: HistoryModalProps) {
  const { t } = useTranslation()
  const [range, setRange] = useState<HistoryRange>('24h')
  const [history, setHistory] = useState<TargetHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const nextHistory = await window.pingAlert.getTargetHistory(target.id, range)
      setHistory(nextHistory)
      setError(null)
    } catch (loadError) {
      setError(tError(loadError, 'history.loadError'))
    } finally {
      setLoading(false)
    }
  }, [range, target.id])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  useEffect(() => {
    return window.pingAlert.onTargetStatus((update) => {
      if (update.id === target.id) {
        void load()
      }
    })
  }, [load, target.id])

  const recentPoints = history?.points.slice(-8).reverse() ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-slate-100">{t('history.title')}</h2>
            <p className="mt-1 text-sm text-slate-400">{target.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('common.close')}
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          {HISTORY_RANGES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={
                range === value
                  ? 'rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-slate-950'
                  : 'rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800'
              }
            >
              {t(historyRangeLabelKey(value))}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        {loading && !history ? (
          <p className="mt-8 text-center text-sm text-slate-500">{t('history.loading')}</p>
        ) : history ? (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label={t('history.uptime')} value={formatUptime(history.uptimePercent)} />
              <StatCard
                label={t('history.avgResponse')}
                value={formatMs(history.avgResponseTimeMs)}
              />
              <StatCard
                label={t('history.minMax')}
                value={`${formatMs(history.minResponseTimeMs)} / ${formatMs(history.maxResponseTimeMs)}`}
              />
              <StatCard
                label={t('history.checks')}
                value={`${history.upChecks.toLocaleString(currentDateLocale())} / ${history.totalChecks.toLocaleString(currentDateLocale())}`}
              />
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                {t('history.statusStrip')}
              </p>
              <StatusStrip points={history.points} />
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                {t('history.responseTime')}
              </p>
              <ResponseTimeChart points={history.points} />
            </div>

            {recentPoints.length > 0 ? (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                  {t('history.recentChecks')}
                </p>
                <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
                  {recentPoints.map((point, index) => (
                    <li
                      key={`${point.checkedAt}-${index}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className={point.status === 'up' ? 'text-teal-400' : 'text-red-400'}>
                        {t(statusLabelKey(point.status))}
                      </span>
                      <span className="text-slate-400">{formatMs(point.responseTimeMs)}</span>
                      <span className="text-xs text-slate-500">{formatCheckedAt(point.checkedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('history.emptyRange')}</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function formatCheckedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(currentDateLocale(), {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-100">{value}</p>
    </div>
  )
}
