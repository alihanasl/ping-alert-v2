import { randomUUID } from 'node:crypto'
import { icmpPing } from '../monitor/icmp'

const SCAN_CONCURRENCY = 24
const SCAN_TIMEOUT_MS = 1000

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
  hosts: string[],
  onUpdate: (update: RangeScanUpdate) => void
): string {
  const scanId = randomUUID()
  const state: ActiveScan = { cancelled: false }
  scans.set(scanId, state)

  void runRangeScan(scanId, hosts, state, onUpdate)
  return scanId
}

async function runRangeScan(
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
      const result = await icmpPing(host, SCAN_TIMEOUT_MS)
      if (state.cancelled) {
        return
      }

      completed += 1
      onUpdate({
        scanId,
        host,
        status: result.ok ? 'up' : 'down',
        responseTimeMs: result.responseTimeMs,
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
