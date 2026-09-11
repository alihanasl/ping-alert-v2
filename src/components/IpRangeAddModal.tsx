import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Group } from '@shared/types'
import { IP_RANGE_MAX, compareIpv4, expandIpv4Range } from '@shared/ipRange'
import { tError } from '../lib/translate'

interface IpRangeAddModalProps {
  groups: Group[]
  onClose: () => void
  onCreated: () => Promise<void>
}

export function IpRangeAddModal({ groups, onClose, onCreated }: IpRangeAddModalProps) {
  const { t } = useTranslation()
  const [start, setStart] = useState('10.10.10.1')
  const [end, setEnd] = useState('10.10.10.254')
  const [groupId, setGroupId] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => expandIpv4Range(start, end), [start, end])

  useEffect(() => {
    if (preview.ok) {
      setSelected(preview.hosts)
      setPreviewError(null)
      return
    }

    setSelected([])
    setPreviewError(
      t(
        preview.error === 'tooLarge'
          ? 'errors.scan.tooLarge'
          : preview.error === 'empty'
            ? 'errors.scan.empty'
            : 'errors.scan.invalidRange',
        { max: IP_RANGE_MAX }
      )
    )
  }, [preview, t])

  const listed = preview.ok ? [...preview.hosts].sort(compareIpv4) : []
  const selectedSet = useMemo(() => new Set(selected), [selected])

  function toggle(host: string): void {
    setSelected((current) =>
      current.includes(host) ? current.filter((item) => item !== host) : [...current, host]
    )
  }

  async function handleCreate(): Promise<void> {
    if (selected.length === 0) {
      setError(t('errors.scan.empty'))
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const result = await window.pingAlert.createTargetsFromHosts({
        hosts: selected,
        groupId: groupId || null
      })
      setNotice(t('scan.addResult', { created: result.created, skipped: result.skipped }))
      await onCreated()
      if (result.created > 0) {
        onClose()
      }
    } catch (createError) {
      setError(tError(createError, 'devices.saveError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 p-6">
          <h2 className="text-lg font-medium text-slate-100">{t('scan.rangeTitle')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('scan.rangeSubtitle')}</p>

          <div className="mt-4 grid grid-cols-2 gap-3">
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
                placeholder="10.10.10.255"
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">{t('scan.hint', { max: IP_RANGE_MAX })}</p>
          {preview.ok ? (
            <p className="mt-3 text-sm text-slate-300">
              {t('scan.rangeCount', { count: selected.length })}
            </p>
          ) : null}
          {previewError ? <p className="mt-3 text-sm text-red-400">{previewError}</p> : null}
        </div>

        {listed.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="mb-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(listed)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {t('scan.selectAll')}
              </button>
              <button
                type="button"
                onClick={() => setSelected([])}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                {t('scan.deselectAll')}
              </button>
            </div>
            <ul className="space-y-1">
              {listed.map((host) => (
                <li key={host} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800/70">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(host)}
                    onChange={() => toggle(host)}
                    className="size-4 accent-teal-500"
                  />
                  <span className="font-mono text-sm text-slate-100">{host}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={saving || selected.length === 0}
                onClick={() => void handleCreate()}
                className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
              >
                {saving ? t('scan.creating') : t('scan.create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
