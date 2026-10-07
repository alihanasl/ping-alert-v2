import type { DatabaseSync } from 'node:sqlite'
import { encodeI18nMessage } from '@shared/i18nMessage'
import type { Target } from '@shared/types'
import { httpCheck } from './http'
import type { ProbeResult } from './result'
import { resolveSnmpForTarget } from './snmpConfig'
import { snmpCheck } from './snmp'
import { tcpCheck } from './tcp'

function isSnmpReachabilityCheck(target: Target): boolean {
  return target.checkType === 'snmp' || target.checkType === 'icmp'
}

export function isScheduledCheck(target: Target): boolean {
  return (
    target.enabled &&
    (isSnmpReachabilityCheck(target) ||
      target.checkType === 'tcp' ||
      target.checkType === 'http')
  )
}

export async function probeTarget(
  database: DatabaseSync,
  target: Target
): Promise<ProbeResult> {
  if (isSnmpReachabilityCheck(target)) {
    const config = resolveSnmpForTarget(database, target)
    if (!config) {
      return {
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.snmpNoCommunity')
      }
    }

    return snmpCheck(target.host, config)
  }

  const timeoutMs = 2000

  if (target.checkType === 'tcp') {
    const port = target.config.port
    if (port === undefined) {
      return {
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.tcpNoPort')
      }
    }

    return tcpCheck(target.host, port, timeoutMs)
  }

  if (target.checkType === 'http') {
    return httpCheck(target.host, target.config.path, Math.max(timeoutMs, 5000))
  }

  return {
    ok: false,
    responseTimeMs: null,
    message: encodeI18nMessage('probe.unsupportedType')
  }
}
