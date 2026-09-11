export const IP_RANGE_MAX = 256

export type IpRangeError = 'invalid' | 'tooLarge' | 'empty'

export type IpRangeResult =
  | { ok: true; hosts: string[] }
  | { ok: false; error: IpRangeError }

export function ipv4ToInt(value: string): number | null {
  const parts = value.trim().split('.')
  if (parts.length !== 4) {
    return null
  }

  let result = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null
    }

    const octet = Number(part)
    if (octet > 255) {
      return null
    }

    result = result * 256 + octet
  }

  return result
}

export function intToIpv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join('.')
}

export function expandIpv4Range(start: string, end: string): IpRangeResult {
  const startInt = ipv4ToInt(start)
  const endInt = ipv4ToInt(end)

  if (startInt === null || endInt === null) {
    return { ok: false, error: 'invalid' }
  }

  const from = Math.min(startInt, endInt)
  const to = Math.max(startInt, endInt)
  const count = to - from + 1

  if (count < 1) {
    return { ok: false, error: 'empty' }
  }

  if (count > IP_RANGE_MAX) {
    return { ok: false, error: 'tooLarge' }
  }

  const hosts: string[] = []
  for (let value = from; value <= to; value += 1) {
    hosts.push(intToIpv4(value))
  }

  return { ok: true, hosts }
}

export function compareIpv4(left: string, right: string): number {
  const leftInt = ipv4ToInt(left)
  const rightInt = ipv4ToInt(right)
  if (leftInt === null || rightInt === null) {
    return left.localeCompare(right)
  }

  return leftInt - rightInt
}
