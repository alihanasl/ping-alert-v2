import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Group, ScanProgress } from '@shared/types'
import { IP_RANGE_MAX, compareIpv4, expandIpv4Range } from '@shared/ipRange'
import { tError } from '../lib/translate'

interface IpScanModalProps {
  groups: Group[]
  knownHosts: string[]
  onClose: () => void
  onAdded: () => Promise<void>
}

interface ScanRow {
  host: string
  status: 'pending' | 'up' | 'down'
  responseTimeMs: number | null
  selected: boolean
  added: boolean
}

export function IpScanModal({ groups, knownHosts, onClose, onAdded }: IpScanModalProps) {
  const { t } = useTranslation()
  const [start, setStart] = useState('10.10.10.1')
  const [end, setEnd] = useState('10.10.10.254')
  const [groupId, setGroupId] = useState('')
  const [rows, setRows] = useState<ScanRow[]>([])
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [completed, setCompleted] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const activeScanId = useRef<string | null>(null)

  const known = useMemo(() => new Set(knownHosts), [knownHosts])

  useEffect(() => {
    return window.pingAlert.onScanProgress((update: ScanProgress) => {
      if (activeScanId.current && update.scanId !== activeScanId.current) {
        return
      }

      if (!update.host || !update.status) {
        if (update.finished) {
          activeScanId.current = null
          setScanning(false)
          setScanId(null)
        }
        return
      }

      setCompleted(update.completed)
      setRows((current) =>
        current.map((row) =>
          row.host === update.host
            ? {
                ...row,
                status: update.status ?? row.status,
                responseTimeMs: update.responseTimeMs
              }
            : row
        )
      )

      if (update.finished) {
        setScanning(false)
        setScanId(null)
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (scanId) {
        void window.pingAlert.cancelIpScan(scanId)
      }
    }
  }, [scanId])

  const online = rows.filter((row) => row.status === 'up').sort((a, b) => compareIpv4(a.host, b.host))
  const offline = rows.filter((row) => row.status === 'down').sort((a, b) => compareIpv4(a.host, b.host))
  const pending = rows.filter((row) => row.status === 'pending').length
  const selectedCount = rows.filter((row) => row.selected && !row.added && row.status !== 'pending').length

  async function handleStart(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const range = expandIpv4Range(start, end)
    if (!range.ok) {
      setError(
        t(
          range.error === 'tooLarge'
            ? 'errors.scan.tooLarge'
            : range.error === 'empty'
              ? 'errors.scan.empty'
              : 'errors.scan.invalidRange',
          { max: IP_RANGE_MAX }
        )
      )
      return
    }

    if (scanId) {
      await window.pingAlert.cancelIpScan(scanId)
      activeScanId.current = null
    }

    setRows(
      range.hosts.map((host) => ({
        host,
        status: 'pending',
        responseTimeMs: null,
        selected: false,
        added: known.has(host)
      }))
    )
    setCompleted(0)
    setScanning(true)

    try {
      const started = await window.pingAlert.startIpScan({ start, end })
      activeScanId.current = started.scanId
      setScanId(started.scanId)
    } catch (startError) {
      activeScanId.current = null
      setScanning(false)
      setError(tError(startError, 'errors.scan.invalidRange'))
    }
  }

  async function handleStop(): Promise<void> {
    if (!scanId) {
      return
    }

    await window.pingAlert.cancelIpScan(scanId)
    activeScanId.current = null
    setScanning(false)
    setScanId(null)
  }

  function removeHost(host: string): void {
    setRows((current) => current.filter((row) => row.host !== host))
  }

  function selectOnline(): void {
    setRows((current) =>
      current.map((row) =>
        row.status === 'up' && !row.added ? { ...row, selected: true } : row
      )
    )
  }

  async function handleAdd(): Promise<void> {
    const hosts = rows.filter((row) => row.selected && !row.added && row.status !== 'pending').map((row) => row.host)
    if (hosts.length === 0) {
      setError(t('errors.scan.empty'))
      return
    }

    setAdding(true)
    setError(null)
    setNotice(null)

    try {
      const result = await window.pingAlert.createTargetsFromHosts({
        hosts,
        groupId: groupId || null
      })
      setRows((current) =>
        current.map((row) => (hosts.includes(row.host) ? { ...row, added: true, selected: false } : row))
      )
      setNotice(t('scan.addResult', { created: result.created, skipped: result.skipped }))
      await onAdded()
    } catch (addError) {
      setError(tError(addError, 'devices.saveError'))
    } finally {
      setAdding(false)
    }
  }

  async function handleClose(): Promise<void> {
    if (scanId) {
      await window.pingAlert.cancelIpScan(scanId)
      activeScanId.current = null
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={() => void handleClose()}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <form onSubmit={(event) => void handleStart(event)} className="border-b border-slate-800 p-6">
          <h2 className="text-lg font-medium text-slate-100">{t('scan.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('scan.subtitle')}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block text-sm">
              <span className="text-slate-300">{t('scan.start')}</span>
              <input
                required
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                placeholder="10.10.10.1"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">{t('scan.end')}</span>
              <input
                required
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                placeholder="10.10.10.254"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={scanning}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
              >
                {scanning ? t('scan.scanning') : t('scan.startScan')}
              </button>
              {scanning ? (
                <button
                  type="button"
                  onClick={() => void handleStop()}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  {t('scan.stop')}
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('scan.hint', { max: IP_RANGE_MAX })}</p>
          {rows.length > 0 ? (
            <p className="mt-2 text-xs text-slate-400">
              {t('scan.progress', { completed, total: rows.length })}
              {pending > 0 ? ` · ${t('scan.pending', { count: pending })}` : ''}
            </p>
          ) : null}
        </form>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          <ResultColumn
            title={t('scan.online')}
            count={online.length}
            empty={t('scan.emptyOnline')}
            tone="online"
            rows={online}
            onToggle={(host) =>
              setRows((current) =>
                current.map((row) =>
                  row.host === host && !row.added ? { ...row, selected: !row.selected } : row
                )
              )
            }
            onRemove={removeHost}
          />
          <ResultColumn
            title={t('scan.offline')}
            count={offline.length}
            empty={t('scan.emptyOffline')}
            tone="offline"
            rows={offline}
            onToggle={(host) =>
              setRows((current) =>
                current.map((row) =>
                  row.host === host && !row.added ? { ...row, selected: !row.selected } : row
                )
              )
            }
            onRemove={removeHost}
          />
        </div>

        <div className="border-t border-slate-800 p-4">
          {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
          {notice ? <p className="mb-3 text-sm text-teal-400">{notice}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-sm text-slate-300">
              <span className="mr-2">{t('scan.group')}</span>
              <select
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              >
                <option value="">{t('devices.ungroupedLabel')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectOnline}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                {t('scan.selectOnline')}
              </button>
              <button
                type="button"
                onClick={() => void handleClose()}
                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                {t('common.close')}
              </button>
              <button
                type="button"
                disabled={adding || selectedCount === 0}
                onClick={() => void handleAdd()}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
              >
                {adding ? t('scan.adding') : `${t('scan.addSelected')} (${selectedCount})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultColumn({
  title,
  count,
  empty,
  tone,
  rows,
  onToggle,
  onRemove
}: {
  title: string
  count: number
  empty: string
  tone: 'online' | 'offline'
  rows: ScanRow[]
  onToggle: (host: string) => void
  onRemove: (host: string) => void
}) {
  const { t } = useTranslation()

  return (
    <section className="flex min-h-64 flex-col border-slate-800 md:border-r">
      <header className="flex items-center justify-between px-4 py-3">
        <h3 className={tone === 'online' ? 'text-sm font-medium text-teal-400' : 'text-sm font-medium text-red-400'}>
          {title}
        </h3>
        <span className="text-xs text-slate-500">{count}</span>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {rows.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-slate-500">{empty}</li>
        ) : (
          rows.map((row) => (
            <li key={row.host} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800/70">
              <input
                type="checkbox"
                checked={row.selected}
                disabled={row.added}
                onChange={() => onToggle(row.host)}
                className="size-4 accent-teal-500"
              />
              <span className="min-w-0 flex-1 truncate font-mono text-sm text-slate-100">{row.host}</span>
              {row.status === 'up' && row.responseTimeMs !== null ? (
                <span className="text-xs text-slate-500">{t('unit.ms', { value: row.responseTimeMs })}</span>
              ) : null}
              {row.added ? (
                <span className="text-xs text-teal-500">{t('scan.added')}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRemove(row.host)}
                  className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-300"
                >
                  {t('scan.remove')}
                </button>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
