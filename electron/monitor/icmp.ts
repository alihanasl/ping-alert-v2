import { execFile } from 'node:child_process'
import { encodeI18nMessage } from '@shared/i18nMessage'
import type { ProbeResult } from './result'

function parsePingOutput(output: string): ProbeResult {
  const hasTtl = /TTL=/i.test(output)
  const timeMatch = output.match(/[=<]\s*(\d+)\s*ms/i)
  const responseTimeMs = timeMatch ? Number(timeMatch[1]) : null

  if (hasTtl || responseTimeMs !== null) {
    return {
      ok: true,
      responseTimeMs,
      message: encodeI18nMessage('probe.replyReceived')
    }
  }

  if (/could not find host|bilgisayar.*bulunamad[ıi]/i.test(output)) {
    return { ok: false, responseTimeMs: null, message: encodeI18nMessage('probe.hostNotFound') }
  }

  if (/timed out|zaman.?a[sş][ıi]m/i.test(output)) {
    return { ok: false, responseTimeMs: null, message: encodeI18nMessage('probe.timeout') }
  }

  if (/unreachable|eri[sş]ilemez/i.test(output)) {
    return { ok: false, responseTimeMs: null, message: encodeI18nMessage('probe.unreachable') }
  }

  return { ok: false, responseTimeMs: null, message: encodeI18nMessage('probe.pingFailed') }
}

export function icmpPing(host: string, timeoutMs = 2000): Promise<ProbeResult> {
  const safeHost = host.trim()

  if (!safeHost || safeHost.startsWith('-') || /\s/.test(safeHost)) {
    return Promise.resolve({
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.invalidHost')
    })
  }

  const args =
    process.platform === 'win32'
      ? ['-n', '1', '-w', String(Math.max(200, timeoutMs)), safeHost]
      : ['-c', '1', '-W', String(Math.max(1, Math.ceil(timeoutMs / 1000))), safeHost]

  return new Promise((resolve) => {
    execFile(
      'ping',
      args,
      {
        windowsHide: true,
        timeout: timeoutMs + 2000,
        encoding: 'utf8',
        maxBuffer: 64 * 1024
      },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ''}\n${stderr ?? ''}`
        const parsed = parsePingOutput(output)

        if (parsed.ok) {
          resolve(parsed)
          return
        }

        if (error && /ENOENT/i.test(error.message)) {
          resolve({ ok: false, responseTimeMs: null, message: encodeI18nMessage('probe.pingMissing') })
          return
        }

        resolve(parsed)
      }
    )
  })
}
