import * as snmp from 'net-snmp'
import { encodeI18nMessage } from '@shared/i18nMessage'
import { SNMP_DEFAULTS } from '@shared/types'
import type { SnmpTestResult } from '@shared/types'
import type { DatabaseSync } from 'node:sqlite'
import type { ProbeResult } from './result'
import type { SnmpRuntimeConfig } from './snmpConfig'
import { resolveSnmpForHost } from './snmpConfig'

const MAX_VALUE_LENGTH = 80

export interface SnmpProbeOptions {
  port: number
  community: string
  oid: string
  snmpVersion: SnmpRuntimeConfig['snmpVersion']
  retries?: number
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

export function formatSysUpTimeTicks(ticks: number): string {
  if (!Number.isFinite(ticks) || ticks < 0) {
    return '—'
  }

  const totalSeconds = Math.floor(ticks / 100)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (days > 0) {
    parts.push(`${days}d`)
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`)
  }
  parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)

  return parts.join(' ')
}

function probeMessageFromError(error: Error | undefined): string {
  const text = error?.message ?? ''

  if (/timed out/i.test(text)) {
    return encodeI18nMessage('probe.snmpTimeout')
  }

  if (
    /authentication|authorization|community|not authorized|no access|noAccess|wrong digest/i.test(
      text
    )
  ) {
    return encodeI18nMessage('probe.snmpAuthError')
  }

  if (/unsupported|version|sec.?level|unknown PDU/i.test(text)) {
    return encodeI18nMessage('probe.snmpUnsupported')
  }

  if (/ENOTFOUND|EHOSTUNREACH|ENETUNREACH|ECONNREFUSED|EAI_AGAIN|network/i.test(text)) {
    return encodeI18nMessage('probe.snmpNetworkError')
  }

  return encodeI18nMessage('probe.snmpFailed')
}

function createSession(host: string, options: SnmpProbeOptions, timeoutMs: number): snmp.Session {
  const safeHost = host.trim()
  return snmp.createSession(safeHost, options.community.trim(), {
    port: options.port,
    retries: Math.max(0, options.retries ?? 0),
    timeout: Math.max(200, timeoutMs),
    version: options.snmpVersion === '1' ? snmp.Version1 : snmp.Version2c,
    transport: safeHost.includes(':') ? 'udp6' : 'udp4'
  })
}

function snmpGet(
  host: string,
  options: SnmpProbeOptions,
  oids: string[],
  timeoutMs: number
): Promise<{ values: Map<string, unknown>; responseTimeMs: number } | { error: Error }> {
  const safeHost = host.trim()
  const community = options.community.trim()

  if (!safeHost || /\s/.test(safeHost) || !community || oids.length === 0) {
    return Promise.resolve({ error: new Error('invalid') })
  }

  return new Promise((resolve) => {
    const startedAt = Date.now()
    let settled = false
    let session: snmp.Session | null = null

    const finish = (result: { values: Map<string, unknown>; responseTimeMs: number } | { error: Error }): void => {
      if (settled) {
        return
      }

      settled = true
      try {
        session?.close()
      } catch {
        // ignore
      }
      resolve(result)
    }

    try {
      session = createSession(safeHost, options, timeoutMs)
    } catch (error) {
      finish({ error: error instanceof Error ? error : new Error(String(error)) })
      return
    }

    session.on('error', (error) => {
      finish({ error: error instanceof Error ? error : new Error(String(error)) })
    })

    session.get(oids, (error, varbinds) => {
      if (error) {
        finish({ error })
        return
      }

      const values = new Map<string, unknown>()
      for (let index = 0; index < oids.length; index += 1) {
        const oid = oids[index]
        const varbind = varbinds?.[index]
        if (varbind && !snmp.isVarbindError(varbind)) {
          values.set(oid, varbind.value)
        }
      }

      if (values.size === 0) {
        finish({ error: new Error('oid error') })
        return
      }

      finish({
        values,
        responseTimeMs: Date.now() - startedAt
      })
    })
  })
}

export function snmpCheck(
  host: string,
  config: SnmpRuntimeConfig
): Promise<ProbeResult> {
  const options: SnmpProbeOptions = {
    port: config.port,
    community: config.community,
    oid: config.oid,
    snmpVersion: config.snmpVersion,
    retries: config.retries
  }

  return snmpGet(host, options, [config.oid], config.timeoutMs).then((result) => {
    if ('error' in result) {
      return {
        ok: false,
        responseTimeMs: null,
        message: probeMessageFromError(result.error)
      }
    }

    const raw = result.values.get(config.oid)
    const value = truncate(formatSnmpValue(raw))
    return {
      ok: true,
      responseTimeMs: result.responseTimeMs,
      message: encodeI18nMessage('probe.snmpOk', { oid: config.oid, value: value || '—' })
    }
  })
}

export async function runSnmpTest(
  database: DatabaseSync,
  input: {
    host: string
    port?: number
    community?: string
    snmpVersion?: SnmpRuntimeConfig['snmpVersion']
  }
): Promise<SnmpTestResult> {
  const host = input.host.trim()
  if (!host || /\s/.test(host)) {
    return { ok: false, messageKey: 'device.form.snmpTestInvalidHost' }
  }

  const resolved = resolveSnmpForHost(database, host, {
    port: input.port,
    community: input.community,
    snmpVersion: input.snmpVersion
  })

  if (!resolved) {
    return { ok: false, messageKey: 'device.form.snmpTestNoCommunity' }
  }

  const oids = [SNMP_DEFAULTS.oid, SNMP_DEFAULTS.sysNameOid]
  const options: SnmpProbeOptions = {
    port: resolved.port,
    community: resolved.community,
    oid: resolved.oid,
    snmpVersion: resolved.snmpVersion,
    retries: resolved.retries
  }

  const result = await snmpGet(host, options, oids, Math.max(resolved.timeoutMs, 2000))

  if ('error' in result) {
    const text = result.error.message ?? ''
    if (/timed out/i.test(text)) {
      return { ok: false, messageKey: 'device.form.snmpTestFailed' }
    }
    return { ok: false, messageKey: 'device.form.snmpTestFailed' }
  }

  const uptimeRaw = result.values.get(SNMP_DEFAULTS.oid)
  let sysUpTime = '—'
  if (typeof uptimeRaw === 'number') {
    sysUpTime = formatSysUpTimeTicks(uptimeRaw)
  } else {
    const parsed = Number(formatSnmpValue(uptimeRaw))
    sysUpTime = Number.isFinite(parsed) ? formatSysUpTimeTicks(parsed) : formatSnmpValue(uptimeRaw)
  }

  const nameRaw = result.values.get(SNMP_DEFAULTS.sysNameOid)
  const sysName = nameRaw !== undefined ? truncate(formatSnmpValue(nameRaw)) || null : null

  return {
    ok: true,
    sysUpTime,
    sysName
  }
}
