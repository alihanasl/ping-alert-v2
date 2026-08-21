import type { UiLocale } from './locales'

export type { UiLocale } from './locales'

export const CHECK_TYPES = ['icmp', 'tcp', 'http', 'snmp'] as const

export type CheckType = (typeof CHECK_TYPES)[number]

export type MonitorStatus = 'up' | 'down' | 'unknown'

export interface PingAlertApi {
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }
  getDatabaseInfo: () => Promise<DatabaseInfo>
  getSettings: () => Promise<AppSettings>
  updateSettings: (input: SettingsUpdateInput) => Promise<AppSettings>
  setLocale: (locale: UiLocale) => Promise<AppSettings>
  updateEmailSettings: (input: EmailSettingsInput) => Promise<AppSettings>
  testEmail: () => Promise<void>
  listTargets: () => Promise<Target[]>
  createTarget: (input: TargetInput) => Promise<Target>
  updateTarget: (id: string, input: TargetInput) => Promise<Target>
  deleteTarget: (id: string) => Promise<void>
  listGroups: () => Promise<Group[]>
  createGroup: (input: GroupInput) => Promise<Group>
  updateGroup: (id: string, input: GroupInput) => Promise<Group>
  deleteGroup: (id: string) => Promise<void>
  getTargetHistory: (targetId: string, range: HistoryRange) => Promise<TargetHistory>
  listLogs: (query?: LogQuery) => Promise<AppLog[]>
  clearLogs: () => Promise<void>
  onTargetStatus: (callback: (update: TargetStatusUpdate) => void) => () => void
  onAppLog: (callback: (log: AppLog) => void) => () => void
}

export interface DatabaseInfo {
  path: string
  ready: boolean
  schemaVersion: number
  error: string | null
}

export interface AppSettings {
  monitoring_interval_seconds: number
  failure_threshold: number
  ui_locale: UiLocale
  last_opened_at: string | null
  email: EmailSettings
}

export interface EmailSettings {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  username: string
  from: string
  to: string
  notifyDown: boolean
  notifyUp: boolean
  passwordSet: boolean
}

export interface EmailSettingsInput {
  enabled: boolean
  host: string
  port: number
  secure: boolean
  username: string
  password: string
  from: string
  to: string
  notifyDown: boolean
  notifyUp: boolean
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  from: '',
  to: '',
  notifyDown: true,
  notifyUp: true,
  passwordSet: false
}

export const DEFAULT_SETTINGS: Pick<
  AppSettings,
  'monitoring_interval_seconds' | 'failure_threshold' | 'ui_locale' | 'email'
> = {
  monitoring_interval_seconds: 60,
  failure_threshold: 3,
  ui_locale: 'en',
  email: DEFAULT_EMAIL_SETTINGS
}

export const MONITOR_LIMITS = {
  intervalSeconds: { min: 5, max: 3600 },
  failureThreshold: { min: 1, max: 20 }
} as const

export interface TargetConfig {
  port?: number
  path?: string
  community?: string
  oid?: string
  snmpVersion?: SnmpVersion
}

export const SNMP_VERSIONS = ['1', '2c'] as const

export type SnmpVersion = (typeof SNMP_VERSIONS)[number]

export const SNMP_DEFAULTS = {
  port: 161,
  community: 'public',
  oid: '1.3.6.1.2.1.1.3.0',
  snmpVersion: '2c' as SnmpVersion
}

export function isSnmpVersion(value: string): value is SnmpVersion {
  return (SNMP_VERSIONS as readonly string[]).includes(value)
}

export interface TargetInput {
  name: string
  host: string
  checkType: CheckType
  enabled: boolean
  config: TargetConfig
  intervalSeconds: number
  failureThreshold: number
  groupId: string | null
}

export interface Target extends TargetInput {
  id: string
  createdAt: string
  updatedAt: string
  status: MonitorStatus
  responseTimeMs: number | null
  lastCheckedAt: string | null
  message: string | null
  uptimePercent: number | null
}

export interface GroupInput {
  name: string
  description: string
}

export interface Group {
  id: string
  name: string
  description: string
  deviceCount: number
  createdAt: string
  updatedAt: string
}

export interface SettingsUpdateInput {
  monitoring_interval_seconds: number
  failure_threshold: number
  applyToExistingTargets: boolean
}

export const HISTORY_RANGES = ['1h', '24h', '7d'] as const

export type HistoryRange = (typeof HISTORY_RANGES)[number]

export interface CheckHistoryPoint {
  status: MonitorStatus
  responseTimeMs: number | null
  message: string | null
  checkedAt: string
}

export interface TargetHistory {
  range: HistoryRange
  since: string
  totalChecks: number
  upChecks: number
  uptimePercent: number | null
  avgResponseTimeMs: number | null
  minResponseTimeMs: number | null
  maxResponseTimeMs: number | null
  points: CheckHistoryPoint[]
}

export interface TargetStatusUpdate {
  id: string
  status: MonitorStatus
  responseTimeMs: number | null
  lastCheckedAt: string | null
  message: string | null
  uptimePercent: number | null
}

export function isHistoryRange(value: string): value is HistoryRange {
  return (HISTORY_RANGES as readonly string[]).includes(value)
}

export function isCheckType(value: string): value is CheckType {
  return (CHECK_TYPES as readonly string[]).includes(value)
}

export function isMonitorStatus(value: string): value is MonitorStatus {
  return value === 'up' || value === 'down' || value === 'unknown'
}

export const LOG_LEVELS = ['info', 'warn', 'error'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

export const LOG_SOURCES = ['app', 'monitor', 'targets', 'groups', 'settings', 'email'] as const

export type LogSource = (typeof LOG_SOURCES)[number]

export interface AppLog {
  id: number
  level: LogLevel
  source: string
  message: string
  createdAt: string
}

export interface LogQuery {
  level?: LogLevel | 'all'
  limit?: number
}

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value)
}
