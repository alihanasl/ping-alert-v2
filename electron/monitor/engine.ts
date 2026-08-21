import type { Target, TargetStatusUpdate } from '@shared/types'
import { encodeI18nMessage } from '@shared/i18nMessage'
import { writeAppLog } from '../appLog'
import { getDatabase, getDatabaseInfo, listTargets } from '../db'
import { attachMonitorState, insertCheckResult } from '../db/checks'
import { notifyDeviceStatus } from '../notify/email'
import { broadcastTargetStatus } from './broadcast'
import { isScheduledCheck, probeTarget } from './probe'

const CHECK_TIMEOUT_MS = 2000
const FIRST_CHECK_DELAY_MS = 300

const timers = new Map<string, NodeJS.Timeout>()
const lastAnnouncedStatus = new Map<string, Target['status']>()
let runId = 0
let started = false

function clearTimers(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
}

function schedule(targetId: string, delayMs: number, task: () => void): void {
  const existing = timers.get(targetId)
  if (existing) {
    clearTimeout(existing)
  }

  timers.set(
    targetId,
    setTimeout(() => {
      timers.delete(targetId)
      task()
    }, delayMs)
  )
}

function toStatusUpdate(target: Target): TargetStatusUpdate {
  return {
    id: target.id,
    status: target.status,
    responseTimeMs: target.responseTimeMs,
    lastCheckedAt: target.lastCheckedAt,
    message: target.message,
    uptimePercent: target.uptimePercent
  }
}

async function checkTarget(target: Target, currentRun: number): Promise<void> {
  let result
  try {
    result = await probeTarget(target, CHECK_TIMEOUT_MS)
  } catch (error) {
    writeAppLog('error', 'monitor', 'log.monitor.checkError', {
      name: target.name,
      reason: error instanceof Error ? error.message : encodeI18nMessage('probe.checkError')
    })
    result = {
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.checkError')
    }
  }

  if (currentRun !== runId || !started) {
    return
  }

  const database = getDatabase()
  insertCheckResult(database, {
    targetId: target.id,
    probeOk: result.ok,
    responseTimeMs: result.responseTimeMs,
    message: result.message
  })

  const [updated] = attachMonitorState(database, [
    {
      ...target,
      status: 'unknown',
      responseTimeMs: null,
      lastCheckedAt: null,
      message: null
    }
  ])

  broadcastTargetStatus(toStatusUpdate(updated))
  logStatusChange(target, updated)

  const intervalMs = Math.max(5, target.intervalSeconds) * 1000
  schedule(target.id, intervalMs, () => {
    void checkTarget(target, currentRun)
  })
}

export function reloadMonitoring(): void {
  if (!started || !getDatabaseInfo().ready) {
    return
  }

  runId += 1
  const currentRun = runId
  clearTimers()

  const targets = listTargets().filter(isScheduledCheck)
  const activeIds = new Set(targets.map((target) => target.id))
  for (const targetId of lastAnnouncedStatus.keys()) {
    if (!activeIds.has(targetId)) {
      lastAnnouncedStatus.delete(targetId)
    }
  }

  for (const [index, target] of targets.entries()) {
    schedule(target.id, FIRST_CHECK_DELAY_MS + index * 150, () => {
      void checkTarget(target, currentRun)
    })
  }
}

export function startMonitoring(): void {
  if (started) {
    reloadMonitoring()
    return
  }

  started = true
  reloadMonitoring()
  const count = listTargets().filter(isScheduledCheck).length
  writeAppLog('info', 'app', 'log.app.started', { count })
}

export function stopMonitoring(): void {
  started = false
  runId += 1
  clearTimers()
}

function logStatusChange(previous: Target, next: Target): void {
  const from = lastAnnouncedStatus.get(previous.id) ?? previous.status
  lastAnnouncedStatus.set(previous.id, next.status)

  if (from === next.status) {
    return
  }

  if (next.status === 'down') {
    writeAppLog(
      'warn',
      'monitor',
      next.message ? 'log.monitor.downWithReason' : 'log.monitor.down',
      next.message ? { name: next.name, reason: next.message } : { name: next.name }
    )
    void notifyDeviceStatus(next, 'down')
    return
  }

  if (next.status === 'up' && from === 'down') {
    writeAppLog('info', 'monitor', 'log.monitor.up', { name: next.name })
    void notifyDeviceStatus(next, 'up')
  }
}
