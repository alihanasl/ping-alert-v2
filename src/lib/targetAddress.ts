import type { Target } from '@shared/types'

export function targetAddress(target: Target): string {
  if (target.checkType === 'tcp' && target.config.port) {
    return `${target.host}:${target.config.port}`
  }

  if (target.checkType === 'http') {
    if (/^https?:\/\//i.test(target.host)) {
      return target.host
    }

    return `${target.host}${target.config.path ?? ''}`
  }

  if (target.checkType === 'snmp') {
    const port = target.config.port ?? 161
    const oid = target.config.oid ? ` · ${target.config.oid}` : ''
    return `${target.host}:${port}${oid}`
  }

  return target.host
}
