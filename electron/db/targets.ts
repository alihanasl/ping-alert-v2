import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { i18nError } from '@shared/i18nMessage'
import { IP_RANGE_MAX, ipv4ToInt } from '@shared/ipRange'
import type { BulkCreateResult, Target, TargetConfig, TargetInput } from '@shared/types'
import { isCheckType, isSnmpVersion, SNMP_DEFAULTS } from '@shared/types'
import { groupExists } from './groups'
import { normalizeFailureThreshold, normalizeIntervalSeconds } from './monitorLimits'

interface TargetRow {
  id: string
  group_id: string | null
  name: string
  host: string
  check_type: string
  config: string
  interval_seconds: number
  failure_threshold: number
  enabled: number
  created_at: string
  updated_at: string
}

const TARGET_COLUMNS = `
  id, group_id, name, host, check_type, config,
  interval_seconds, failure_threshold, enabled,
  created_at, updated_at
`

function nowIso(): string {
  return new Date().toISOString()
}

function parseConfig(raw: string): TargetConfig {
  try {
    const parsed = JSON.parse(raw) as TargetConfig
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch {
    return {}
  }

  return {}
}

function normalizeHttpPath(path: string | undefined): string | undefined {
  if (path === undefined) {
    return undefined
  }

  const trimmed = path.trim()
  if (!trimmed || trimmed === '/') {
    return undefined
  }

  const value = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  if (value.length > 200) {
    throw i18nError('errors.device.httpPathTooLong')
  }

  if (/\s/.test(value)) {
    throw i18nError('errors.device.httpPathSpaces')
  }

  return value
}

function normalizeOid(oid: string | undefined): string {
  const trimmed = (oid ?? '').trim()
  const value = trimmed.startsWith('.') ? trimmed.slice(1) : trimmed

  if (!value) {
    throw i18nError('errors.device.snmpOid')
  }

  if (value.length > 256) {
    throw i18nError('errors.device.snmpOidTooLong')
  }

  if (!/^\d+(?:\.\d+)+$/.test(value)) {
    throw i18nError('errors.device.snmpOid')
  }

  return value
}

function mapTarget(row: TargetRow): Target {
  if (!isCheckType(row.check_type)) {
    throw i18nError('errors.device.invalidCheckTypeRecord')
  }

  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    host: row.host,
    checkType: row.check_type,
    enabled: row.enabled === 1,
    config: parseConfig(row.config),
    intervalSeconds: row.interval_seconds,
    failureThreshold: row.failure_threshold,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: 'unknown',
    responseTimeMs: null,
    lastCheckedAt: null,
    message: null,
    uptimePercent: null
  }
}

function normalizeInput(input: TargetInput): TargetInput {
  const name = input.name.trim()
  const host = input.host.trim()
  const checkType = input.checkType

  if (!name) {
    throw i18nError('errors.device.nameRequired')
  }

  if (name.length > 100) {
    throw i18nError('errors.device.nameTooLong')
  }

  if (!host) {
    throw i18nError('errors.device.hostRequired')
  }

  if (host.length > 255) {
    throw i18nError('errors.device.hostTooLong')
  }

  if (/\s/.test(host)) {
    throw i18nError('errors.device.hostSpaces')
  }

  if (!isCheckType(checkType)) {
    throw i18nError('errors.device.invalidCheckType')
  }

  const config: TargetConfig = {}

  if (checkType === 'tcp') {
    const port = input.config.port
    if (port === undefined || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw i18nError('errors.device.tcpPort')
    }
    config.port = port
  }

  if (checkType === 'http') {
    const path = normalizeHttpPath(input.config.path)
    if (path) {
      config.path = path
    }

    if (/^https?:\/\//i.test(host)) {
      try {
        const url = new URL(host)
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw i18nError('errors.device.httpProtocol')
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('errors.device.httpProtocol')) {
          throw error
        }
        throw i18nError('errors.device.invalidHttpUrl')
      }
    }
  }

  if (checkType === 'snmp') {
    const port = input.config.port ?? SNMP_DEFAULTS.port
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw i18nError('errors.device.snmpPort')
    }
    config.port = port

    const community = (input.config.community ?? '').trim()
    if (!community) {
      throw i18nError('errors.device.snmpCommunity')
    }
    if (community.length > 64) {
      throw i18nError('errors.device.snmpCommunityTooLong')
    }
    config.community = community

    config.oid = normalizeOid(input.config.oid)

    const snmpVersion = input.config.snmpVersion ?? SNMP_DEFAULTS.snmpVersion
    if (!isSnmpVersion(snmpVersion)) {
      throw i18nError('errors.device.snmpVersion')
    }
    config.snmpVersion = snmpVersion
  }

  return {
    name,
    host,
    checkType,
    enabled: Boolean(input.enabled),
    config,
    intervalSeconds: normalizeIntervalSeconds(input.intervalSeconds),
    failureThreshold: normalizeFailureThreshold(input.failureThreshold),
    groupId: null
  }
}

function resolveGroupId(database: DatabaseSync, groupId: string | null): string | null {
  if (!groupId) {
    return null
  }

  const trimmed = groupId.trim()
  if (!trimmed) {
    return null
  }

  if (!groupExists(database, trimmed)) {
    throw i18nError('errors.device.groupNotFound')
  }

  return trimmed
}

function getById(database: DatabaseSync, id: string): Target {
  const row = database
    .prepare(`SELECT ${TARGET_COLUMNS} FROM targets WHERE id = ?`)
    .get(id) as TargetRow | undefined

  if (!row) {
    throw i18nError('errors.device.notFound')
  }

  return mapTarget(row)
}

export function listTargets(database: DatabaseSync): Target[] {
  const rows = database
    .prepare(`SELECT ${TARGET_COLUMNS} FROM targets ORDER BY name COLLATE NOCASE ASC`)
    .all() as unknown as TargetRow[]

  return rows.map(mapTarget)
}

export function createTarget(database: DatabaseSync, input: TargetInput): Target {
  const normalized = {
    ...normalizeInput(input),
    groupId: resolveGroupId(database, input.groupId)
  }
  const timestamp = nowIso()
  const id = randomUUID()

  database
    .prepare(
      `
      INSERT INTO targets (
        id, group_id, name, host, check_type, config,
        interval_seconds, failure_threshold, enabled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      id,
      normalized.groupId,
      normalized.name,
      normalized.host,
      normalized.checkType,
      JSON.stringify(normalized.config),
      normalized.intervalSeconds,
      normalized.failureThreshold,
      normalized.enabled ? 1 : 0,
      timestamp,
      timestamp
    )

  return getById(database, id)
}

export function updateTarget(database: DatabaseSync, id: string, input: TargetInput): Target {
  getById(database, id)
  const normalized = {
    ...normalizeInput(input),
    groupId: resolveGroupId(database, input.groupId)
  }

  database
    .prepare(
      `
      UPDATE targets
      SET name = ?, host = ?, check_type = ?, config = ?, enabled = ?,
          interval_seconds = ?, failure_threshold = ?, group_id = ?, updated_at = ?
      WHERE id = ?
    `
    )
    .run(
      normalized.name,
      normalized.host,
      normalized.checkType,
      JSON.stringify(normalized.config),
      normalized.enabled ? 1 : 0,
      normalized.intervalSeconds,
      normalized.failureThreshold,
      normalized.groupId,
      nowIso(),
      id
    )

  return getById(database, id)
}

export function deleteTarget(database: DatabaseSync, id: string): void {
  getById(database, id)
  database.prepare('DELETE FROM targets WHERE id = ?').run(id)
}

export function createIcmpHosts(
  database: DatabaseSync,
  hosts: string[],
  groupId: string | null,
  intervalSeconds: number,
  failureThreshold: number
): BulkCreateResult {
  const uniqueHosts: string[] = []
  const seen = new Set<string>()

  for (const host of hosts) {
    const trimmed = host.trim()
    if (ipv4ToInt(trimmed) === null) {
      throw i18nError('errors.scan.invalidRange')
    }

    if (!seen.has(trimmed)) {
      seen.add(trimmed)
      uniqueHosts.push(trimmed)
    }
  }

  if (uniqueHosts.length === 0) {
    throw i18nError('errors.scan.empty')
  }

  if (uniqueHosts.length > IP_RANGE_MAX) {
    throw i18nError('errors.scan.tooLarge', { max: IP_RANGE_MAX })
  }

  const resolvedGroupId = resolveGroupId(database, groupId)
  const existingHosts = new Set(
    listTargets(database)
      .filter((target) => target.checkType === 'icmp')
      .map((target) => target.host)
  )
  const interval = normalizeIntervalSeconds(intervalSeconds)
  const threshold = normalizeFailureThreshold(failureThreshold)
  const timestamp = nowIso()
  const insert = database.prepare(
    `
    INSERT INTO targets (
      id, group_id, name, host, check_type, config,
      interval_seconds, failure_threshold, enabled,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'icmp', '{}', ?, ?, 1, ?, ?)
  `
  )

  let created = 0
  let skipped = 0

  database.exec('BEGIN')
  try {
    for (const host of uniqueHosts) {
      if (existingHosts.has(host)) {
        skipped += 1
        continue
      }

      insert.run(randomUUID(), resolvedGroupId, host, host, interval, threshold, timestamp, timestamp)
      existingHosts.add(host)
      created += 1
    }

    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  return { created, skipped }
}
