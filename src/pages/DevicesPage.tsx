import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings, EmailSettingsInput, SettingsUpdateInput, Target, TargetInput } from '@shared/types'
import { DEFAULT_SETTINGS } from '@shared/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DeviceFormModal } from '../components/DeviceFormModal'
import { DeviceRow } from '../components/DeviceRow'
import { FilterChip } from '../components/FilterChip'
import { GroupsModal } from '../components/GroupsModal'
import { HistoryModal } from '../components/HistoryModal'
import { LogsModal } from '../components/LogsModal'
import { SettingsModal } from '../components/SettingsModal'
import { SummaryCards } from '../components/SummaryCards'
import { useGroups } from '../hooks/useGroups'
import { useTargets } from '../hooks/useTargets'
import { currentDateLocale } from '../lib/labels'
import {
  compareDashboardTargets,
  countDeviceStatuses,
  getDeviceUiStatus,
  type DeviceStatusFilter
} from '../lib/deviceStatus'
import { tError } from '../lib/translate'

const ALL_GROUPS = 'all'
const UNGROUPED = 'ungrouped'

export function DevicesPage() {
  const { t } = useTranslation()
  const { targets, loading, error, createTarget, updateTarget, deleteTarget, refresh } = useTargets()
  const { groups, error: groupsError, refresh: refreshGroups } = useGroups()
  const [settings, setSettings] = useState<AppSettings>({
    ...DEFAULT_SETTINGS,
    last_opened_at: null
  })
  const [groupFilter, setGroupFilter] = useState(ALL_GROUPS)
  const [statusFilter, setStatusFilter] = useState<DeviceStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [logsOpen, setLogsOpen] = useState(false)
  const [editing, setEditing] = useState<Target | null>(null)
  const [saving, setSaving] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [emailSaving, setEmailSaving] = useState(false)
  const [emailTesting, setEmailTesting] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [emailNotice, setEmailNotice] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Target | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Target | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadSettings(): Promise<void> {
      try {
        const nextSettings = await window.pingAlert.getSettings()
        if (!cancelled) {
          setSettings(nextSettings)
        }
      } catch {
        if (!cancelled) {
          setSettings({ ...DEFAULT_SETTINGS, last_opened_at: null })
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (groupFilter === ALL_GROUPS || groupFilter === UNGROUPED) {
      return
    }

    if (!groups.some((group) => group.id === groupFilter)) {
      setGroupFilter(ALL_GROUPS)
    }
  }, [groupFilter, groups])

  function openCreate(): void {
    setEditing(null)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(target: Target): void {
    setEditing(target)
    setFormError(null)
    setFormOpen(true)
  }

  function closeForm(): void {
    if (saving) {
      return
    }

    setFormOpen(false)
    setEditing(null)
    setFormError(null)
  }

  async function handleSubmit(input: TargetInput): Promise<void> {
    setSaving(true)
    setFormError(null)

    try {
      if (editing) {
        await updateTarget(editing.id, input)
      } else {
        await createTarget(input)
      }

      await refreshGroups()
      setFormOpen(false)
      setEditing(null)
    } catch (submitError) {
      setFormError(tError(submitError, 'devices.saveError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleGroupsChanged(): Promise<void> {
    await Promise.all([refreshGroups(), refresh()])
  }

  async function handleSettingsSubmit(input: SettingsUpdateInput): Promise<void> {
    setSettingsSaving(true)
    setSettingsError(null)

    try {
      const nextSettings = await window.pingAlert.updateSettings(input)
      setSettings(nextSettings)
      setSettingsOpen(false)
      if (input.applyToExistingTargets) {
        await refresh()
      }
    } catch (saveError) {
      setSettingsError(tError(saveError, 'settings.saveError'))
    } finally {
      setSettingsSaving(false)
    }
  }

  async function handleEmailSubmit(input: EmailSettingsInput): Promise<void> {
    setEmailSaving(true)
    setEmailError(null)
    setEmailNotice(null)

    try {
      const nextSettings = await window.pingAlert.updateEmailSettings(input)
      setSettings(nextSettings)
      setEmailNotice(t('settings.email.saved'))
    } catch (saveError) {
      setEmailError(tError(saveError, 'settings.saveError'))
    } finally {
      setEmailSaving(false)
    }
  }

  async function handleEmailTest(): Promise<void> {
    setEmailTesting(true)
    setEmailError(null)
    setEmailNotice(null)

    try {
      await window.pingAlert.testEmail()
      setEmailNotice(t('settings.email.testSuccess'))
    } catch (testError) {
      setEmailError(tError(testError, 'errors.email.sendFailed'))
    } finally {
      setEmailTesting(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!pendingDelete) {
      return
    }

    setDeleting(true)
    setDeleteError(null)

    try {
      await deleteTarget(pendingDelete.id)
      setPendingDelete(null)
      await refreshGroups()
    } catch (removeError) {
      setDeleteError(tError(removeError, 'devices.deleteError'))
    } finally {
      setDeleting(false)
    }
  }

  function groupName(groupId: string | null): string {
    if (!groupId) {
      return t('devices.ungroupedLabel')
    }

    return groups.find((group) => group.id === groupId)?.name ?? t('devices.ungroupedLabel')
  }

  const statusCounts = useMemo(() => countDeviceStatuses(targets), [targets])
  const locale = currentDateLocale()
  const query = search.trim().toLocaleLowerCase(locale)

  const visibleTargets = useMemo(() => {
    return targets
      .filter((target) => {
        if (groupFilter === UNGROUPED) {
          return !target.groupId
        }

        if (groupFilter !== ALL_GROUPS) {
          return target.groupId === groupFilter
        }

        return true
      })
      .filter((target) => {
        if (statusFilter === 'all') {
          return true
        }

        return getDeviceUiStatus(target) === statusFilter
      })
      .filter((target) => {
        if (!query) {
          return true
        }

        return (
          target.name.toLocaleLowerCase(locale).includes(query) ||
          target.host.toLocaleLowerCase(locale).includes(query)
        )
      })
      .sort((left, right) => compareDashboardTargets(left, right, locale))
  }, [groupFilter, locale, query, statusFilter, targets])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-teal-400">{t('app.name')}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">{t('devices.title')}</h1>
            <p className="mt-0.5 text-sm text-slate-400">{t('devices.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLogsOpen(true)}
              className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {t('nav.logs')}
            </button>
            <button
              type="button"
              onClick={() => setGroupsOpen(true)}
              className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {t('nav.groups')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSettingsError(null)
                setEmailError(null)
                setEmailNotice(null)
                setSettingsOpen(true)
              }}
              className="rounded-lg border border-slate-700/80 bg-slate-900/50 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              {t('nav.settings')}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400"
            >
              {t('nav.addDevice')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-6">
        {error ? <p className="mb-4 text-sm text-red-400">{error}</p> : null}
        {groupsError ? <p className="mb-4 text-sm text-red-400">{groupsError}</p> : null}

        <SummaryCards counts={statusCounts} active={statusFilter} onSelect={setStatusFilter} />

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('devices.searchPlaceholder')}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-2.5 pl-10 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-teal-500"
            />
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <FilterChip
            active={groupFilter === ALL_GROUPS}
            label={t('devices.all', { count: targets.length })}
            onClick={() => setGroupFilter(ALL_GROUPS)}
          />
          {groups.map((group) => (
            <FilterChip
              key={group.id}
              active={groupFilter === group.id}
              label={`${group.name} (${group.deviceCount})`}
              onClick={() => setGroupFilter(group.id)}
            />
          ))}
          <FilterChip
            active={groupFilter === UNGROUPED}
            label={t('devices.ungrouped', {
              count: targets.filter((target) => !target.groupId).length
            })}
            onClick={() => setGroupFilter(UNGROUPED)}
          />
        </div>

        <section className="mt-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-16 text-center text-sm text-slate-500">
              {t('devices.loading')}
            </div>
          ) : targets.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400">
                <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.2 6.2l1.4 1.4M16.4 16.4l1.4 1.4M6.2 17.8l1.4-1.4M16.4 7.6l1.4-1.4" />
                </svg>
              </div>
              <p className="text-base font-medium text-slate-100">{t('devices.emptyTitle')}</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">{t('devices.empty')}</p>
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400"
              >
                {t('nav.addDevice')}
              </button>
            </div>
          ) : visibleTargets.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-16 text-center text-sm text-slate-500">
              {groupFilter !== ALL_GROUPS && !query && statusFilter === 'all'
                ? t('devices.emptyGroup')
                : t('devices.noMatch')}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {visibleTargets.map((target) => (
                <DeviceRow
                  key={target.id}
                  target={target}
                  groupName={groupName(target.groupId)}
                  onHistory={() => setHistoryTarget(target)}
                  onEdit={() => openEdit(target)}
                  onDelete={() => {
                    setDeleteError(null)
                    setPendingDelete(target)
                  }}
                />
              ))}
            </ul>
          )}
        </section>
      </main>

      {formOpen ? (
        <DeviceFormModal
          target={editing}
          groups={groups}
          defaultIntervalSeconds={settings.monitoring_interval_seconds}
          defaultFailureThreshold={settings.failure_threshold}
          saving={saving}
          error={formError}
          onClose={closeForm}
          onSubmit={handleSubmit}
        />
      ) : null}

      {groupsOpen ? (
        <GroupsModal
          groups={groups}
          onClose={() => setGroupsOpen(false)}
          onChanged={handleGroupsChanged}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsModal
          settings={settings}
          saving={settingsSaving}
          error={settingsError}
          emailSaving={emailSaving}
          emailTesting={emailTesting}
          emailError={emailError}
          emailNotice={emailNotice}
          onClose={() => {
            if (!settingsSaving && !emailSaving && !emailTesting) {
              setSettingsOpen(false)
              setSettingsError(null)
              setEmailError(null)
              setEmailNotice(null)
            }
          }}
          onSubmit={handleSettingsSubmit}
          onSettingsChange={setSettings}
          onEmailSubmit={handleEmailSubmit}
          onEmailTest={handleEmailTest}
        />
      ) : null}

      {logsOpen ? <LogsModal onClose={() => setLogsOpen(false)} /> : null}

      {historyTarget ? (
        <HistoryModal target={historyTarget} onClose={() => setHistoryTarget(null)} />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title={t('devices.deleteTitle')}
          message={
            deleteError ? deleteError : t('devices.deleteMessage', { name: pendingDelete.name })
          }
          confirmLabel={t('common.delete')}
          busy={deleting}
          onCancel={() => {
            if (!deleting) {
              setPendingDelete(null)
              setDeleteError(null)
            }
          }}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </div>
  )
}
