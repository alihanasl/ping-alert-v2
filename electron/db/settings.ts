import type { DatabaseSync } from 'node:sqlite'
import type {
  AppSettings,
  EmailSettings,
  EmailSettingsInput,
  SettingsUpdateInput,
  SnmpSettingsInput
} from '@shared/types'
import {
  DEFAULT_EMAIL_SETTINGS,
  DEFAULT_SETTINGS,
  DEFAULT_SNMP_SETTINGS,
  SNMP_LIMITS,
  isSnmpVersion
} from '@shared/types'
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

  if (getSettingValue(database, 'snmp_version') === undefined) {
    setSettingValue(database, 'snmp_version', DEFAULT_SNMP_SETTINGS.snmpVersion)
  }

  if (getSettingValue(database, 'snmp_port') === undefined) {
    setSettingValue(database, 'snmp_port', DEFAULT_SNMP_SETTINGS.port)
  }

  if (getSettingValue(database, 'snmp_timeout_ms') === undefined) {
    setSettingValue(database, 'snmp_timeout_ms', DEFAULT_SNMP_SETTINGS.timeoutMs)
  }

  if (getSettingValue(database, 'snmp_retry_count') === undefined) {
    setSettingValue(database, 'snmp_retry_count', DEFAULT_SNMP_SETTINGS.retryCount)
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
    email: readEmailSettings(database),
    snmp: readSnmpSettings(database)
  }
}

export interface SnmpRuntimeSettings {
  snmpVersion: AppSettings['snmp']['snmpVersion']
  port: number
  timeoutMs: number
  retryCount: number
  community: string
}

function readSnmpSettings(database: DatabaseSync): AppSettings['snmp'] {
  const community = parseSetting(getSettingValue(database, 'snmp_community'), '')
  return {
    snmpVersion: parseSnmpVersion(getSettingValue(database, 'snmp_version')),
    port: parseSnmpPort(getSettingValue(database, 'snmp_port')),
    timeoutMs: parseSnmpTimeout(getSettingValue(database, 'snmp_timeout_ms')),
    retryCount: parseSnmpRetry(getSettingValue(database, 'snmp_retry_count')),
    communitySet: community.length > 0
  }
}

export function getSnmpRuntimeSettings(database: DatabaseSync): SnmpRuntimeSettings {
  const snmp = readSnmpSettings(database)
  return {
    snmpVersion: snmp.snmpVersion,
    port: snmp.port,
    timeoutMs: snmp.timeoutMs,
    retryCount: snmp.retryCount,
    community: parseSetting(getSettingValue(database, 'snmp_community'), '')
  }
}

function parseSnmpVersion(raw: string | undefined): AppSettings['snmp']['snmpVersion'] {
  const parsed = parseSetting<string>(raw, DEFAULT_SNMP_SETTINGS.snmpVersion)
  return isSnmpVersion(parsed) ? parsed : DEFAULT_SNMP_SETTINGS.snmpVersion
}

function parseSnmpPort(raw: string | undefined): number {
  const parsed = parseSetting<number>(raw, DEFAULT_SNMP_SETTINGS.port)
  if (!Number.isInteger(parsed) || parsed < SNMP_LIMITS.port.min || parsed > SNMP_LIMITS.port.max) {
    return DEFAULT_SNMP_SETTINGS.port
  }

  return parsed
}

function parseSnmpTimeout(raw: string | undefined): number {
  const parsed = parseSetting<number>(raw, DEFAULT_SNMP_SETTINGS.timeoutMs)
  if (
    !Number.isInteger(parsed) ||
    parsed < SNMP_LIMITS.timeoutMs.min ||
    parsed > SNMP_LIMITS.timeoutMs.max
  ) {
    return DEFAULT_SNMP_SETTINGS.timeoutMs
  }

  return parsed
}

function parseSnmpRetry(raw: string | undefined): number {
  const parsed = parseSetting<number>(raw, DEFAULT_SNMP_SETTINGS.retryCount)
  if (
    !Number.isInteger(parsed) ||
    parsed < SNMP_LIMITS.retryCount.min ||
    parsed > SNMP_LIMITS.retryCount.max
  ) {
    return DEFAULT_SNMP_SETTINGS.retryCount
  }

  return parsed
}

function normalizeSnmpInput(database: DatabaseSync, input: SnmpSettingsInput): SnmpRuntimeSettings {
  const port = input.port
  const timeoutMs = input.timeoutMs
  const retryCount = input.retryCount
  const snmpVersion = input.snmpVersion

  if (!Number.isInteger(port) || port < SNMP_LIMITS.port.min || port > SNMP_LIMITS.port.max) {
    throw i18nError('errors.snmp.invalidPort')
  }

  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < SNMP_LIMITS.timeoutMs.min ||
    timeoutMs > SNMP_LIMITS.timeoutMs.max
  ) {
    throw i18nError('errors.snmp.invalidTimeout')
  }

  if (
    !Number.isInteger(retryCount) ||
    retryCount < SNMP_LIMITS.retryCount.min ||
    retryCount > SNMP_LIMITS.retryCount.max
  ) {
    throw i18nError('errors.snmp.invalidRetry')
  }

  if (!isSnmpVersion(snmpVersion)) {
    throw i18nError('errors.snmp.invalidVersion')
  }

  const storedCommunity = parseSetting(getSettingValue(database, 'snmp_community'), '')
  const community = input.community.length > 0 ? input.community.trim() : storedCommunity

  if (community.length > 64) {
    throw i18nError('errors.device.snmpCommunityTooLong')
  }

  return {
    snmpVersion,
    port,
    timeoutMs,
    retryCount,
    community
  }
}

export function updateSnmpSettings(database: DatabaseSync, input: SnmpSettingsInput): AppSettings {
  const normalized = normalizeSnmpInput(database, input)

  setSettingValue(database, 'snmp_version', normalized.snmpVersion)
  setSettingValue(database, 'snmp_port', normalized.port)
  setSettingValue(database, 'snmp_timeout_ms', normalized.timeoutMs)
  setSettingValue(database, 'snmp_retry_count', normalized.retryCount)

  if (input.community.length > 0) {
    setSettingValue(database, 'snmp_community', normalized.community)
  }

  return getAppSettings(database)
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
