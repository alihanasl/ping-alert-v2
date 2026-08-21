import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CheckType, Group, SnmpVersion, Target, TargetInput } from '@shared/types'
import { MONITOR_LIMITS, SNMP_DEFAULTS, SNMP_VERSIONS } from '@shared/types'
import { CHECK_TYPE_OPTIONS } from '../lib/labels'

interface DeviceFormModalProps {
  target: Target | null
  groups: Group[]
  defaultIntervalSeconds: number
  defaultFailureThreshold: number
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: TargetInput) => Promise<void>
}

interface FormState {
  name: string
  host: string
  checkType: CheckType
  port: string
  enabled: boolean
  intervalSeconds: string
  failureThreshold: string
  groupId: string
  path: string
  community: string
  oid: string
  snmpVersion: SnmpVersion
}

function toFormState(
  target: Target | null,
  defaultIntervalSeconds: number,
  defaultFailureThreshold: number
): FormState {
  if (!target) {
    return {
      name: '',
      host: '',
      checkType: 'icmp',
      port: '80',
      enabled: true,
      intervalSeconds: String(defaultIntervalSeconds),
      failureThreshold: String(defaultFailureThreshold),
      groupId: '',
      path: '/',
      community: SNMP_DEFAULTS.community,
      oid: SNMP_DEFAULTS.oid,
      snmpVersion: SNMP_DEFAULTS.snmpVersion
    }
  }

  return {
    name: target.name,
    host: target.host,
    checkType: target.checkType,
    port: String(
      target.config.port ?? (target.checkType === 'snmp' ? SNMP_DEFAULTS.port : 80)
    ),
    enabled: target.enabled,
    intervalSeconds: String(target.intervalSeconds),
    failureThreshold: String(target.failureThreshold),
    groupId: target.groupId ?? '',
    path: target.config.path ?? '/',
    community: target.config.community ?? SNMP_DEFAULTS.community,
    oid: target.config.oid ?? SNMP_DEFAULTS.oid,
    snmpVersion: target.config.snmpVersion ?? SNMP_DEFAULTS.snmpVersion
  }
}

export function DeviceFormModal({
  target,
  groups,
  defaultIntervalSeconds,
  defaultFailureThreshold,
  saving,
  error,
  onClose,
  onSubmit
}: DeviceFormModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>(() =>
    toFormState(target, defaultIntervalSeconds, defaultFailureThreshold)
  )
  const isEdit = target !== null

  useEffect(() => {
    setForm(toFormState(target, defaultIntervalSeconds, defaultFailureThreshold))
  }, [target, defaultIntervalSeconds, defaultFailureThreshold])

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const port = Number(form.port)
    const config =
      form.checkType === 'tcp'
        ? { port }
        : form.checkType === 'http'
          ? { path: form.path.trim() || '/' }
          : form.checkType === 'snmp'
            ? {
                port,
                community: form.community,
                oid: form.oid,
                snmpVersion: form.snmpVersion
              }
            : {}
    const input: TargetInput = {
      name: form.name,
      host: form.host,
      checkType: form.checkType,
      enabled: form.enabled,
      config,
      intervalSeconds: Number(form.intervalSeconds),
      failureThreshold: Number(form.failureThreshold),
      groupId: form.groupId || null
    }

    await onSubmit(input)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
      >
        <h2 className="text-lg font-medium text-slate-100">
          {isEdit ? t('device.edit') : t('device.add')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">{t('device.form.subtitle')}</p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm">
            <span className="text-slate-300">{t('device.form.name')}</span>
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              placeholder={t('device.form.namePlaceholder')}
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-300">{t('device.form.host')}</span>
            <input
              required
              maxLength={255}
              value={form.host}
              onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              placeholder={
                form.checkType === 'http'
                  ? t('device.form.hostPlaceholderHttp')
                  : t('device.form.hostPlaceholder')
              }
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-300">{t('device.form.group')}</span>
            <select
              value={form.groupId}
              onChange={(event) =>
                setForm((current) => ({ ...current, groupId: event.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
            >
              <option value="">{t('devices.ungroupedLabel')}</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="text-slate-300">{t('device.form.checkType')}</span>
            <select
              value={form.checkType}
              onChange={(event) => {
                const checkType = event.target.value as CheckType
                setForm((current) => {
                  let port = current.port
                  if (checkType === 'snmp' && current.checkType !== 'snmp' && current.port === '80') {
                    port = String(SNMP_DEFAULTS.port)
                  }
                  if (checkType === 'tcp' && current.checkType === 'snmp' && current.port === String(SNMP_DEFAULTS.port)) {
                    port = '80'
                  }

                  return { ...current, checkType, port }
                })
              }}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
            >
              {CHECK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </label>

          {form.checkType === 'tcp' || form.checkType === 'snmp' ? (
            <label className="block text-sm">
              <span className="text-slate-300">{t('device.form.port')}</span>
              <input
                required
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(event) =>
                  setForm((current) => ({ ...current, port: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                placeholder={form.checkType === 'snmp' ? String(SNMP_DEFAULTS.port) : '80'}
              />
            </label>
          ) : null}

          {form.checkType === 'snmp' ? (
            <>
              <label className="block text-sm">
                <span className="text-slate-300">{t('device.form.snmpVersion')}</span>
                <select
                  value={form.snmpVersion}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      snmpVersion: event.target.value as SnmpVersion
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                >
                  {SNMP_VERSIONS.map((version) => (
                    <option key={version} value={version}>
                      {t(`device.form.snmpVersionOption.v${version}`)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">{t('device.form.community')}</span>
                <input
                  required
                  type="password"
                  maxLength={64}
                  value={form.community}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, community: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                  autoComplete="off"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  {t('device.form.communityHint')}
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-300">{t('device.form.oid')}</span>
                <input
                  required
                  maxLength={256}
                  value={form.oid}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, oid: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                  placeholder={SNMP_DEFAULTS.oid}
                />
                <span className="mt-1 block text-xs text-slate-500">{t('device.form.oidHint')}</span>
              </label>
            </>
          ) : null}

          {form.checkType === 'http' ? (
            <label className="block text-sm">
              <span className="text-slate-300">{t('device.form.path')}</span>
              <input
                maxLength={200}
                value={form.path}
                onChange={(event) =>
                  setForm((current) => ({ ...current, path: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
                placeholder="/"
              />
              <span className="mt-1 block text-xs text-slate-500">{t('device.form.pathHint')}</span>
            </label>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-slate-300">{t('device.form.interval')}</span>
              <input
                required
                type="number"
                min={MONITOR_LIMITS.intervalSeconds.min}
                max={MONITOR_LIMITS.intervalSeconds.max}
                value={form.intervalSeconds}
                onChange={(event) =>
                  setForm((current) => ({ ...current, intervalSeconds: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">{t('device.form.threshold')}</span>
              <input
                required
                type="number"
                min={MONITOR_LIMITS.failureThreshold.min}
                max={MONITOR_LIMITS.failureThreshold.max}
                value={form.failureThreshold}
                onChange={(event) =>
                  setForm((current) => ({ ...current, failureThreshold: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) =>
                setForm((current) => ({ ...current, enabled: event.target.checked }))
              }
              className="size-4 accent-teal-500"
            />
            {t('device.form.enabled')}
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
          >
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
