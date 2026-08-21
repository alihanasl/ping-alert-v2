import { encodeI18nMessage } from '@shared/i18nMessage'
import type { Target } from '@shared/types'
import { SNMP_DEFAULTS } from '@shared/types'
import { httpCheck } from './http'
import { icmpPing } from './icmp'
import type { ProbeResult } from './result'
import { snmpCheck } from './snmp'
import { tcpCheck } from './tcp'

export function isScheduledCheck(target: Target): boolean {
  return (
    target.enabled &&
    (target.checkType === 'icmp' ||
      target.checkType === 'tcp' ||
      target.checkType === 'http' ||
      target.checkType === 'snmp')
  )
}

export async function probeTarget(target: Target, timeoutMs: number): Promise<ProbeResult> {
  if (target.checkType === 'icmp') {
    return icmpPing(target.host, timeoutMs)
  }

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

  if (target.checkType === 'snmp') {
    const community = target.config.community?.trim()
    const oid = target.config.oid?.trim()
    if (!community || !oid) {
      return {
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.snmpNoConfig')
      }
    }

    return snmpCheck(
      target.host,
      {
        port: target.config.port ?? SNMP_DEFAULTS.port,
        community,
        oid,
        snmpVersion: target.config.snmpVersion ?? SNMP_DEFAULTS.snmpVersion
      },
      Math.max(timeoutMs, 3000)
    )
  }

  return {
    ok: false,
    responseTimeMs: null,
    message: encodeI18nMessage('probe.unsupportedType')
  }
}
