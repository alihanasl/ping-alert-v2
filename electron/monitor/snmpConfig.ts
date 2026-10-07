import type { DatabaseSync } from 'node:sqlite'
import type { SnmpRuntimeConfig, Target } from './snmpTypes'
import { getSnmpRuntimeSettings } from '../db/settings'
import { SNMP_DEFAULTS } from '@shared/types'

export type { SnmpRuntimeConfig } from './snmpTypes'

export function resolveSnmpForTarget(
  database: DatabaseSync,
  target: Target
): SnmpRuntimeConfig | null {
  const global = getSnmpRuntimeSettings(database)
  const deviceCommunity = target.config.community?.trim()
  const community = deviceCommunity || global.community

  if (!community) {
    return null
  }

  const oid = (target.config.oid?.trim() || SNMP_DEFAULTS.oid).replace(/^\./, '')
  const port = target.config.port ?? global.port ?? SNMP_DEFAULTS.port
  const snmpVersion = target.config.snmpVersion ?? global.snmpVersion ?? SNMP_DEFAULTS.snmpVersion

  return {
    port,
    community,
    oid,
    snmpVersion,
    timeoutMs: global.timeoutMs,
    retries: global.retryCount
  }
}

export function resolveSnmpForHost(
  database: DatabaseSync,
  _host: string,
  overrides?: {
    port?: number
    community?: string
    snmpVersion?: SnmpRuntimeConfig['snmpVersion']
  }
): SnmpRuntimeConfig | null {
  const global = getSnmpRuntimeSettings(database)
  const community = overrides?.community?.trim() || global.community

  if (!community) {
    return null
  }

  return {
    port: overrides?.port ?? global.port ?? SNMP_DEFAULTS.port,
    community,
    oid: SNMP_DEFAULTS.oid,
    snmpVersion: overrides?.snmpVersion ?? global.snmpVersion ?? SNMP_DEFAULTS.snmpVersion,
    timeoutMs: global.timeoutMs,
    retries: global.retryCount
  }
}
