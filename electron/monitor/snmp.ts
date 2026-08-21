import * as snmp from 'net-snmp'
import { encodeI18nMessage } from '@shared/i18nMessage'
import type { SnmpVersion } from '@shared/types'
import type { ProbeResult } from './result'

const MAX_VALUE_LENGTH = 80

export interface SnmpProbeOptions {
  port: number
  community: string
  oid: string
  snmpVersion: SnmpVersion
}

function formatSnmpValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (Buffer.isBuffer(value)) {
    const text = value.toString('utf8')
    if (text.length > 0 && /^[\x20-\x7E]*$/.test(text)) {
      return text
    }

    return value.toString('hex')
  }

  return String(value)
}

function truncate(value: string): string {
  if (value.length <= MAX_VALUE_LENGTH) {
    return value
  }

  return `${value.slice(0, MAX_VALUE_LENGTH)}…`
}

export function snmpCheck(
  host: string,
  options: SnmpProbeOptions,
  timeoutMs = 3000
): Promise<ProbeResult> {
  const safeHost = host.trim()
  const port = options.port
  const community = options.community.trim()
  const oid = options.oid.trim()

  if (
    !safeHost ||
    /\s/.test(safeHost) ||
    !community ||
    !oid ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return Promise.resolve({
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.snmpNoConfig')
    })
  }

  return new Promise((resolve) => {
    const startedAt = Date.now()
    let settled = false
    let session: snmp.Session | null = null

    const finish = (result: ProbeResult): void => {
      if (settled) {
        return
      }

      settled = true
      try {
        session?.close()
      } catch {
        // ignore close errors
      }
      resolve(result)
    }

    try {
      session = snmp.createSession(safeHost, community, {
        port,
        retries: 0,
        timeout: Math.max(200, timeoutMs),
        version: options.snmpVersion === '1' ? snmp.Version1 : snmp.Version2c,
        transport: safeHost.includes(':') ? 'udp6' : 'udp4'
      })
    } catch {
      finish({
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.snmpFailed')
      })
      return
    }

    session.on('error', () => {
      finish({
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.snmpFailed')
      })
    })

    session.get([oid], (error, varbinds) => {
      if (error) {
        if (/timed out/i.test(error.message)) {
          finish({
            ok: false,
            responseTimeMs: null,
            message: encodeI18nMessage('probe.snmpTimeout')
          })
          return
        }

        finish({
          ok: false,
          responseTimeMs: null,
          message: encodeI18nMessage('probe.snmpFailed')
        })
        return
      }

      const varbind = varbinds?.[0]
      if (!varbind || snmp.isVarbindError(varbind)) {
        finish({
          ok: false,
          responseTimeMs: null,
          message: encodeI18nMessage('probe.snmpOidError', { oid })
        })
        return
      }

      const value = truncate(formatSnmpValue(varbind.value))
      finish({
        ok: true,
        responseTimeMs: Date.now() - startedAt,
        message: encodeI18nMessage('probe.snmpOk', { oid, value: value || '—' })
      })
    })
  })
}
