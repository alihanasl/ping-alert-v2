import { randomUUID } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { snmpCheck } from '../monitor/snmp'
import { resolveSnmpForHost } from '../monitor/snmpConfig'

const SCAN_CONCURRENCY = 30
const SCAN_TIMEOUT_FLOOR_MS = 1000

export interface RangeScanUpdate {
  scanId: string
  host: string | null
  status: 'up' | 'down' | null
  responseTimeMs: number | null
  completed: number
  total: number
  finished: boolean
  cancelled: boolean
}

interface ActiveScan {
  cancelled: boolean
}

const scans = new Map<string, ActiveScan>()

export function cancelRangeScan(scanId: string): void {
  const scan = scans.get(scanId)
  if (scan) {
    scan.cancelled = true
  }
}

export function startRangeScan(
  database: DatabaseSync,
  hosts: string[],
  onUpdate: (update: RangeScanUpdate) => void
): string {
  const scanId = randomUUID()
  const state: ActiveScan = { cancelled: false }
  scans.set(scanId, state)

  void runRangeScan(database, scanId, hosts, state, onUpdate)
  return scanId
}

async function runRangeScan(
  database: DatabaseSync,
  scanId: string,
  hosts: string[],
  state: ActiveScan,
  onUpdate: (update: RangeScanUpdate) => void
): Promise<void> {
  let nextIndex = 0
  let completed = 0

  async function worker(): Promise<void> {
    while (!state.cancelled) {
      const current = nextIndex
      nextIndex += 1
      if (current >= hosts.length) {
        return
      }

      const host = hosts[current]
      const config = resolveSnmpForHost(database, host)
      let ok = false
      let responseTimeMs: number | null = null

      if (config) {
        const probe = await snmpCheck(host, {
          ...config,
          timeoutMs: Math.max(config.timeoutMs, SCAN_TIMEOUT_FLOOR_MS)
        })
        ok = probe.ok
        responseTimeMs = probe.responseTimeMs
      }

      if (state.cancelled) {
        return
      }

      completed += 1
      onUpdate({
        scanId,
        host,
        status: ok ? 'up' : 'down',
        responseTimeMs,
        completed,
        total: hosts.length,
        finished: false,
        cancelled: false
      })
    }
  }

  const workers = Array.from({ length: Math.min(SCAN_CONCURRENCY, hosts.length) }, () => worker())
  await Promise.all(workers)

  onUpdate({
    scanId,
    host: null,
    status: null,
    responseTimeMs: null,
    completed,
    total: hosts.length,
    finished: true,
    cancelled: state.cancelled
  })
  scans.delete(scanId)
}
