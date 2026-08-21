import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppLog, LogLevel } from '@shared/types'
import { currentDateLocale } from '../lib/labels'
import { tError, tStored } from '../lib/translate'
import { ConfirmDialog } from './ConfirmDialog'

type LevelFilter = LogLevel | 'all'

const LEVEL_FILTERS: LevelFilter[] = ['all', 'info', 'warn', 'error']

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: 'text-slate-300',
  warn: 'text-amber-400',
  error: 'text-red-400'
}

interface LogsModalProps {
  onClose: () => void
}

export function LogsModal({ onClose }: LogsModalProps) {
  const { t } = useTranslation()
  const [level, setLevel] = useState<LevelFilter>('all')
  const [logs, setLogs] = useState<AppLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      try {
        const nextLogs = await window.pingAlert.listLogs({ level, limit: 200 })
        if (!cancelled) {
          setLogs(nextLogs)
          setError(null)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(tError(loadError, 'logs.loadError'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [level])

  useEffect(() => {
    return window.pingAlert.onAppLog((log) => {
      if (level !== 'all' && log.level !== level) {
        return
      }

      setLogs((current) => [log, ...current.filter((item) => item.id !== log.id)].slice(0, 200))
    })
  }, [level])

  async function handleClear(): Promise<void> {
    setClearing(true)
    setError(null)

    try {
      await window.pingAlert.clearLogs()
      setConfirmClear(false)
    } catch (clearError) {
      setError(tError(clearError, 'logs.clearError'))
    } finally {
      setClearing(false)
    }
  }

  function levelLabel(value: LevelFilter): string {
    return value === 'all' ? t('logs.filter.all') : t(`logs.level.${value}`)
  }

  function sourceLabel(source: string): string {
    const key = `logs.source.${source}`
    const translated = t(key)
    return translated === key ? source : translated
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-slate-100">{t('logs.title')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('logs.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="rounded-lg px-3 py-1.5 text-sm text-red-400 hover:bg-slate-800"
            >
              {t('common.clear')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              {t('common.close')}
            </button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {LEVEL_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setLevel(filter)}
              className={
                level === filter
                  ? 'rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-slate-950'
                  : 'rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800'
              }
            >
              {levelLabel(filter)}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{t('logs.loading')}</p>
          ) : logs.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">{t('logs.empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-800 rounded-xl border border-slate-800">
              {logs.map((log) => (
                <li key={log.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`font-medium ${LEVEL_CLASS[log.level]}`}>
                      {t(`logs.level.${log.level}`)}
                    </span>
                    <span className="text-slate-500">{sourceLabel(log.source)}</span>
                    <span className="ml-auto text-slate-600">{formatLogTime(log.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{tStored(log.message, t)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmClear ? (
        <ConfirmDialog
          title={t('logs.clearTitle')}
          message={t('logs.clearMessage')}
          confirmLabel={t('common.clear')}
          busy={clearing}
          onCancel={() => {
            if (!clearing) {
              setConfirmClear(false)
            }
          }}
          onConfirm={() => void handleClear()}
        />
      ) : null}
    </div>
  )
}

function formatLogTime(value: string): string {
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
