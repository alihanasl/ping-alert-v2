import type { DatabaseSync } from 'node:sqlite'
import { i18nError } from '@shared/i18nMessage'
import type { HistoryRange, MonitorStatus, Target, TargetHistory } from '@shared/types'
import { isMonitorStatus } from '@shared/types'

const HISTORY_POINT_LIMIT = 400
const RESULT_RETENTION = 2000
const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000

const RANGE_MS: Record<HistoryRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000
}

interface CheckRow {
  target_id: string
  status: string
  response_time_ms: number | null
  message: string | null
  checked_at: string
}

interface UptimeRow {
  target_id: string
  total: number
  up_count: number
}

interface HistoryStatsRow {
  total: number
  up_count: number | null
  avg_ms: number | null
  min_ms: number | null
  max_ms: number | null
}

interface HistoryPointRow {
  status: string
  response_time_ms: number | null
  message: string | null
  checked_at: string
}

export function insertCheckResult(
  database: DatabaseSync,
  input: {
    targetId: string
    probeOk: boolean
    responseTimeMs: number | null
    message: string
  }
): void {
  database
    .prepare(
      `
      INSERT INTO check_results (target_id, status, response_time_ms, message, checked_at)
      VALUES (?, ?, ?, ?, ?)
    `
    )
    .run(
      input.targetId,
      input.probeOk ? 'up' : 'down',
      input.responseTimeMs,
      input.message,
      new Date().toISOString()
    )

  pruneCheckResults(database, input.targetId)
}

function pruneCheckResults(database: DatabaseSync, targetId: string): void {
  const cutoff = database
    .prepare(
      `
      SELECT id
      FROM check_results
      WHERE target_id = ?
      ORDER BY id DESC
      LIMIT 1 OFFSET ?
    `
    )
    .get(targetId, RESULT_RETENTION - 1) as unknown as { id: number } | undefined

  if (!cutoff) {
    return
  }

  database
    .prepare('DELETE FROM check_results WHERE target_id = ? AND id < ?')
    .run(targetId, cutoff.id)
}

export function getTargetHistory(
  database: DatabaseSync,
  targetId: string,
  range: HistoryRange
): TargetHistory {
  const exists = database.prepare('SELECT id FROM targets WHERE id = ?').get(targetId) as unknown as
    | { id: string }
    | undefined

  if (!exists) {
    throw i18nError('errors.device.notFound')
  }

  const since = new Date(Date.now() - RANGE_MS[range]).toISOString()
  const stats = database
    .prepare(
      `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up_count,
        AVG(response_time_ms) AS avg_ms,
        MIN(response_time_ms) AS min_ms,
        MAX(response_time_ms) AS max_ms
      FROM check_results
      WHERE target_id = ? AND checked_at >= ?
    `
    )
    .get(targetId, since) as unknown as HistoryStatsRow

  const totalChecks = Number(stats.total ?? 0)
  const upChecks = Number(stats.up_count ?? 0)
  const newestFirst = database
    .prepare(
      `
      SELECT status, response_time_ms, message, checked_at
      FROM check_results
      WHERE target_id = ? AND checked_at >= ?
      ORDER BY checked_at DESC, id DESC
      LIMIT ?
    `
    )
    .all(targetId, since, HISTORY_POINT_LIMIT) as unknown as HistoryPointRow[]

  return {
    range,
    since,
    totalChecks,
    upChecks,
    uptimePercent: toPercent(upChecks, totalChecks),
    avgResponseTimeMs: roundMs(stats.avg_ms),
    minResponseTimeMs: roundMs(stats.min_ms),
    maxResponseTimeMs: roundMs(stats.max_ms),
    points: newestFirst.reverse().map((row) => ({
      status: isMonitorStatus(row.status) ? row.status : 'unknown',
      responseTimeMs: row.response_time_ms,
      message: row.message,
      checkedAt: row.checked_at
    }))
  }
}

export function attachMonitorState(database: DatabaseSync, targets: Target[]): Target[] {
  if (targets.length === 0) {
    return targets
  }

  const rows = database
    .prepare(
      `
      SELECT target_id, status, response_time_ms, message, checked_at
      FROM check_results
      ORDER BY id DESC
    `
    )
    .all() as unknown as CheckRow[]

  const history = new Map<string, CheckRow[]>()
  for (const row of rows) {
    const current = history.get(row.target_id) ?? []
    if (current.length < 50) {
      current.push(row)
      history.set(row.target_id, current)
    }
  }

  const uptimeByTarget = loadUptimePercents(database)

  return targets.map((target) => {
    const results = history.get(target.id) ?? []
    return {
      ...target,
      ...deriveMonitorState(results, target.failureThreshold),
      uptimePercent: uptimeByTarget.get(target.id) ?? null
    }
  })
}

function loadUptimePercents(database: DatabaseSync): Map<string, number> {
  const since = new Date(Date.now() - UPTIME_WINDOW_MS).toISOString()
  const rows = database
    .prepare(
      `
      SELECT
        target_id,
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'up' THEN 1 ELSE 0 END) AS up_count
      FROM check_results
      WHERE checked_at >= ?
      GROUP BY target_id
    `
    )
    .all(since) as unknown as UptimeRow[]

  const result = new Map<string, number>()
  for (const row of rows) {
    const percent = toPercent(Number(row.up_count ?? 0), Number(row.total ?? 0))
    if (percent !== null) {
      result.set(row.target_id, percent)
    }
  }

  return result
}

function toPercent(upChecks: number, totalChecks: number): number | null {
  if (totalChecks <= 0) {
    return null
  }

  return Math.round((upChecks / totalChecks) * 1000) / 10
}

function roundMs(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) {
    return null
  }

  return Math.round(value)
}

export function deriveMonitorState(
  resultsNewestFirst: CheckRow[],
  failureThreshold: number
): Pick<Target, 'status' | 'responseTimeMs' | 'lastCheckedAt' | 'message'> {
  const empty = {
    status: 'unknown' as MonitorStatus,
    responseTimeMs: null,
    lastCheckedAt: null,
    message: null
  }

  if (resultsNewestFirst.length === 0) {
    return empty
  }

  const latest = resultsNewestFirst[0]
  const lastCheckedAt = latest.checked_at
  const responseTimeMs = latest.response_time_ms
  const message = latest.message
  const latestStatus = isMonitorStatus(latest.status) ? latest.status : 'unknown'

  if (latestStatus === 'up') {
    return {
      status: 'up',
      responseTimeMs,
      lastCheckedAt,
      message
    }
  }

  let consecutiveFailures = 0
  for (const row of resultsNewestFirst) {
    if (row.status === 'down') {
      consecutiveFailures += 1
    } else {
      break
    }
  }

  const hadSuccessfulProbe = resultsNewestFirst.some((row) => row.status === 'up')
  const status: MonitorStatus =
    consecutiveFailures >= failureThreshold ? 'down' : hadSuccessfulProbe ? 'up' : 'unknown'

  return {
    status,
    responseTimeMs: status === 'up' ? null : responseTimeMs,
    lastCheckedAt,
    message
  }
}
