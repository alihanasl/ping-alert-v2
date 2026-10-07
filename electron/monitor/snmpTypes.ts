import type { SnmpVersion, Target as SharedTarget } from '@shared/types'

export type Target = SharedTarget

export interface SnmpRuntimeConfig {
  port: number
  community: string
  oid: string
  snmpVersion: SnmpVersion
  timeoutMs: number
  retries: number
}
