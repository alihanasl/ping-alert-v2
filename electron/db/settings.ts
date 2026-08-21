import type { DatabaseSync } from 'node:sqlite'
import type { AppSettings, EmailSettings, EmailSettingsInput, SettingsUpdateInput } from '@shared/types'
import { DEFAULT_EMAIL_SETTINGS, DEFAULT_SETTINGS } from '@shared/types'
import { i18nError } from '@shared/i18nMessage'
import { DEFAULT_LOCALE, isUiLocale, resolveUiLocale, type UiLocale } from '@shared/locales'
import { normalizeFailureThreshold, normalizeIntervalSeconds } from './monitorLimits'

interface SettingRow {
  key: string
  value: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseSetting<T>(raw: string | undefined, fallback: T): T {
  if (raw === undefined) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function getSettingValue(database: DatabaseSync, key: string): string | undefined {
  const row = database.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | SettingRow
    | undefined

  return row?.value
}

export function setSettingValue(database: DatabaseSync, key: string, value: unknown): void {
  database
    .prepare(
      `
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `
    )
    .run(key, JSON.stringify(value), nowIso())
}

export function ensureDefaultSettings(database: DatabaseSync, osLocale?: string): void {
  if (getSettingValue(database, 'monitoring_interval_seconds') === undefined) {
    setSettingValue(
      database,
      'monitoring_interval_seconds',
      DEFAULT_SETTINGS.monitoring_interval_seconds
    )
  }

  if (getSettingValue(database, 'failure_threshold') === undefined) {
    setSettingValue(database, 'failure_threshold', DEFAULT_SETTINGS.failure_threshold)
  }

  if (getSettingValue(database, 'ui_locale') === undefined) {
    setSettingValue(database, 'ui_locale', resolveUiLocale(osLocale))
  }
}

export function markAppOpened(database: DatabaseSync): void {
  setSettingValue(database, 'last_opened_at', nowIso())
}

export function getAppSettings(database: DatabaseSync): AppSettings {
  return {
    monitoring_interval_seconds: parseSetting(
      getSettingValue(database, 'monitoring_interval_seconds'),
      DEFAULT_SETTINGS.monitoring_interval_seconds
    ),
    failure_threshold: parseSetting(
      getSettingValue(database, 'failure_threshold'),
      DEFAULT_SETTINGS.failure_threshold
    ),
    ui_locale: parseUiLocale(getSettingValue(database, 'ui_locale')),
    last_opened_at: parseSetting<string | null>(getSettingValue(database, 'last_opened_at'), null),
    email: readEmailSettings(database)
  }
}

export interface EmailRuntimeConfig extends Omit<EmailSettings, 'passwordSet'> {
  password: string
}

function readEmailSettings(database: DatabaseSync): EmailSettings {
  const password = parseSetting(getSettingValue(database, 'email_password'), '')
  return {
    enabled: parseSetting(getSettingValue(database, 'email_enabled'), DEFAULT_EMAIL_SETTINGS.enabled),
    host: parseSetting(getSettingValue(database, 'email_host'), DEFAULT_EMAIL_SETTINGS.host),
    port: parseSetting(getSettingValue(database, 'email_port'), DEFAULT_EMAIL_SETTINGS.port),
    secure: parseSetting(getSettingValue(database, 'email_secure'), DEFAULT_EMAIL_SETTINGS.secure),
    username: parseSetting(getSettingValue(database, 'email_username'), DEFAULT_EMAIL_SETTINGS.username),
    from: parseSetting(getSettingValue(database, 'email_from'), DEFAULT_EMAIL_SETTINGS.from),
    to: parseSetting(getSettingValue(database, 'email_to'), DEFAULT_EMAIL_SETTINGS.to),
    notifyDown: parseSetting(
      getSettingValue(database, 'email_notify_down'),
      DEFAULT_EMAIL_SETTINGS.notifyDown
    ),
    notifyUp: parseSetting(
      getSettingValue(database, 'email_notify_up'),
      DEFAULT_EMAIL_SETTINGS.notifyUp
    ),
    passwordSet: password.length > 0
  }
}

export function getEmailRuntimeConfig(database: DatabaseSync): EmailRuntimeConfig {
  const email = readEmailSettings(database)
  return {
    ...email,
    password: parseSetting(getSettingValue(database, 'email_password'), '')
  }
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function normalizeEmailInput(database: DatabaseSync, input: EmailSettingsInput): EmailRuntimeConfig {
  const host = input.host.trim()
  const username = input.username.trim()
  const from = input.from.trim()
  const to = input.to.trim()
  const port = input.port
  const storedPassword = parseSetting(getSettingValue(database, 'email_password'), '')
  const password = input.password.length > 0 ? input.password : storedPassword

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw i18nError('errors.email.invalidPort')
  }

  if (to && !isValidEmailAddress(to)) {
    throw i18nError('errors.email.invalidAddress')
  }

  if (from && !isValidEmailAddress(from)) {
    throw i18nError('errors.email.invalidAddress')
  }

  if (input.enabled && (!host || !to)) {
    throw i18nError('errors.email.incomplete')
  }

  if (input.enabled && username && !password) {
    throw i18nError('errors.email.incomplete')
  }

  return {
    enabled: Boolean(input.enabled),
    host,
    port,
    secure: Boolean(input.secure),
    username,
    from,
    to,
    notifyDown: Boolean(input.notifyDown),
    notifyUp: Boolean(input.notifyUp),
    password
  }
}

export function updateEmailSettings(database: DatabaseSync, input: EmailSettingsInput): AppSettings {
  const normalized = normalizeEmailInput(database, input)

  setSettingValue(database, 'email_enabled', normalized.enabled)
  setSettingValue(database, 'email_host', normalized.host)
  setSettingValue(database, 'email_port', normalized.port)
  setSettingValue(database, 'email_secure', normalized.secure)
  setSettingValue(database, 'email_username', normalized.username)
  setSettingValue(database, 'email_from', normalized.from)
  setSettingValue(database, 'email_to', normalized.to)
  setSettingValue(database, 'email_notify_down', normalized.notifyDown)
  setSettingValue(database, 'email_notify_up', normalized.notifyUp)
  if (input.password.length > 0) {
    setSettingValue(database, 'email_password', normalized.password)
  }

  return getAppSettings(database)
}

function parseUiLocale(raw: string | undefined): UiLocale {
  const parsed = parseSetting<string>(raw, DEFAULT_LOCALE)
  return isUiLocale(parsed) ? parsed : DEFAULT_LOCALE
}

export function updateUiLocale(database: DatabaseSync, locale: UiLocale): AppSettings {
  setSettingValue(database, 'ui_locale', locale)
  return getAppSettings(database)
}

export function updateAppSettings(database: DatabaseSync, input: SettingsUpdateInput): AppSettings {
  const intervalSeconds = normalizeIntervalSeconds(input.monitoring_interval_seconds)
  const failureThreshold = normalizeFailureThreshold(input.failure_threshold)

  setSettingValue(database, 'monitoring_interval_seconds', intervalSeconds)
  setSettingValue(database, 'failure_threshold', failureThreshold)

  if (input.applyToExistingTargets) {
    database
      .prepare(
        `
        UPDATE targets
        SET interval_seconds = ?, failure_threshold = ?, updated_at = ?
      `
      )
      .run(intervalSeconds, failureThreshold, nowIso())
  }

  return getAppSettings(database)
}
