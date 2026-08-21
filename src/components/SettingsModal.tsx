import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppSettings, EmailSettingsInput, SettingsUpdateInput, UiLocale } from '@shared/types'
import { MONITOR_LIMITS } from '@shared/types'
import { LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES, isUiLocale } from '@shared/locales'
import i18n from '../i18n'

interface SettingsModalProps {
  settings: AppSettings
  saving: boolean
  error: string | null
  emailSaving: boolean
  emailTesting: boolean
  emailError: string | null
  emailNotice: string | null
  onClose: () => void
  onSubmit: (input: SettingsUpdateInput) => Promise<void>
  onSettingsChange: (settings: AppSettings) => void
  onEmailSubmit: (input: EmailSettingsInput) => Promise<void>
  onEmailTest: () => Promise<void>
}

interface FormState {
  intervalSeconds: string
  failureThreshold: string
  applyToExistingTargets: boolean
}

interface EmailFormState {
  enabled: boolean
  host: string
  port: string
  secure: boolean
  username: string
  password: string
  from: string
  to: string
  notifyDown: boolean
  notifyUp: boolean
}

function toEmailForm(settings: AppSettings): EmailFormState {
  return {
    enabled: settings.email.enabled,
    host: settings.email.host,
    port: String(settings.email.port),
    secure: settings.email.secure,
    username: settings.email.username,
    password: '',
    from: settings.email.from,
    to: settings.email.to,
    notifyDown: settings.email.notifyDown,
    notifyUp: settings.email.notifyUp
  }
}

export function SettingsModal({
  settings,
  saving,
  error,
  emailSaving,
  emailTesting,
  emailError,
  emailNotice,
  onClose,
  onSubmit,
  onSettingsChange,
  onEmailSubmit,
  onEmailTest
}: SettingsModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>({
    intervalSeconds: String(settings.monitoring_interval_seconds),
    failureThreshold: String(settings.failure_threshold),
    applyToExistingTargets: false
  })
  const [emailForm, setEmailForm] = useState<EmailFormState>(() => toEmailForm(settings))
  const [localeSaving, setLocaleSaving] = useState(false)

  useEffect(() => {
    setForm({
      intervalSeconds: String(settings.monitoring_interval_seconds),
      failureThreshold: String(settings.failure_threshold),
      applyToExistingTargets: false
    })
    setEmailForm((current) => ({
      ...toEmailForm(settings),
      password: current.password
    }))
  }, [settings])

  async function handleLocaleChange(nextLocale: string): Promise<void> {
    if (!isUiLocale(nextLocale) || nextLocale === settings.ui_locale || localeSaving) {
      return
    }

    setLocaleSaving(true)
    try {
      const nextSettings = await window.pingAlert.setLocale(nextLocale)
      await i18n.changeLanguage(nextLocale)
      document.documentElement.lang = nextLocale
      document.title = i18n.t('app.name')
      onSettingsChange(nextSettings)
    } finally {
      setLocaleSaving(false)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await onSubmit({
      monitoring_interval_seconds: Number(form.intervalSeconds),
      failure_threshold: Number(form.failureThreshold),
      applyToExistingTargets: form.applyToExistingTargets
    })
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await onEmailSubmit({
      enabled: emailForm.enabled,
      host: emailForm.host,
      port: Number(emailForm.port),
      secure: emailForm.secure,
      username: emailForm.username,
      password: emailForm.password,
      from: emailForm.from,
      to: emailForm.to,
      notifyDown: emailForm.notifyDown,
      notifyUp: emailForm.notifyUp
    })
    setEmailForm((current) => ({ ...current, password: '' }))
  }

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <form onSubmit={(event) => void handleSubmit(event)}>
          <h2 className="text-lg font-medium text-slate-100">{t('settings.title')}</h2>
          <p className="mt-1 text-sm text-slate-500">{t('settings.subtitle')}</p>

          <div className="mt-5 space-y-4">
            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.language')}</span>
              <select
                value={settings.ui_locale}
                disabled={localeSaving}
                onChange={(event) => void handleLocaleChange(event.target.value as UiLocale)}
                className={inputClass}
              >
                {SUPPORTED_LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {LOCALE_NATIVE_NAMES[locale]}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">{t('settings.languageHint')}</span>
            </label>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.interval')}</span>
              <input
                required
                type="number"
                min={MONITOR_LIMITS.intervalSeconds.min}
                max={MONITOR_LIMITS.intervalSeconds.max}
                value={form.intervalSeconds}
                onChange={(event) =>
                  setForm((current) => ({ ...current, intervalSeconds: event.target.value }))
                }
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-slate-500">
                {t('settings.intervalHint', {
                  min: MONITOR_LIMITS.intervalSeconds.min,
                  max: MONITOR_LIMITS.intervalSeconds.max
                })}
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.threshold')}</span>
              <input
                required
                type="number"
                min={MONITOR_LIMITS.failureThreshold.min}
                max={MONITOR_LIMITS.failureThreshold.max}
                value={form.failureThreshold}
                onChange={(event) =>
                  setForm((current) => ({ ...current, failureThreshold: event.target.value }))
                }
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-slate-500">{t('settings.thresholdHint')}</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.applyToExistingTargets}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    applyToExistingTargets: event.target.checked
                  }))
                }
                className="mt-0.5 size-4 accent-teal-500"
              />
              {t('settings.applyToExisting')}
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

        <form
          onSubmit={(event) => void handleEmailSubmit(event)}
          className="mt-8 border-t border-slate-800 pt-6"
        >
          <h3 className="text-lg font-medium text-slate-100">{t('settings.email.title')}</h3>
          <p className="mt-1 text-sm text-slate-500">{t('settings.email.subtitle')}</p>

          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={emailForm.enabled}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, enabled: event.target.checked }))
                }
                className="mt-0.5 size-4 accent-teal-500"
              />
              {t('settings.email.enabled')}
            </label>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.email.host')}</span>
              <input
                value={emailForm.host}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, host: event.target.value }))
                }
                className={inputClass}
                placeholder={t('settings.email.hostPlaceholder')}
                autoComplete="off"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-slate-300">{t('settings.email.port')}</span>
                <input
                  required
                  type="number"
                  min={1}
                  max={65535}
                  value={emailForm.port}
                  onChange={(event) =>
                    setEmailForm((current) => ({ ...current, port: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="flex items-end gap-3 pb-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={emailForm.secure}
                  onChange={(event) =>
                    setEmailForm((current) => ({ ...current, secure: event.target.checked }))
                  }
                  className="size-4 accent-teal-500"
                />
                {t('settings.email.secure')}
              </label>
            </div>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.email.username')}</span>
              <input
                value={emailForm.username}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, username: event.target.value }))
                }
                className={inputClass}
                autoComplete="off"
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.email.password')}</span>
              <input
                type="password"
                value={emailForm.password}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, password: event.target.value }))
                }
                className={inputClass}
                autoComplete="new-password"
              />
              {settings.email.passwordSet ? (
                <span className="mt-1 block text-xs text-slate-500">
                  {t('settings.email.passwordHint')}
                </span>
              ) : null}
            </label>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.email.from')}</span>
              <input
                type="email"
                value={emailForm.from}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, from: event.target.value }))
                }
                className={inputClass}
                autoComplete="off"
              />
            </label>

            <label className="block text-sm">
              <span className="text-slate-300">{t('settings.email.to')}</span>
              <input
                type="email"
                value={emailForm.to}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, to: event.target.value }))
                }
                className={inputClass}
                autoComplete="off"
              />
            </label>

            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={emailForm.notifyDown}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, notifyDown: event.target.checked }))
                }
                className="mt-0.5 size-4 accent-teal-500"
              />
              {t('settings.email.notifyDown')}
            </label>

            <label className="flex items-start gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={emailForm.notifyUp}
                onChange={(event) =>
                  setEmailForm((current) => ({ ...current, notifyUp: event.target.checked }))
                }
                className="mt-0.5 size-4 accent-teal-500"
              />
              {t('settings.email.notifyUp')}
            </label>
          </div>

          {emailError ? <p className="mt-4 text-sm text-red-400">{emailError}</p> : null}
          {emailNotice ? <p className="mt-4 text-sm text-teal-400">{emailNotice}</p> : null}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              disabled={emailTesting || emailSaving}
              onClick={() => void onEmailTest()}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {emailTesting ? t('settings.email.testing') : t('settings.email.test')}
            </button>
            <button
              type="submit"
              disabled={emailSaving || emailTesting}
              className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-teal-400 disabled:opacity-60"
            >
              {emailSaving ? t('common.saving') : t('settings.email.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
