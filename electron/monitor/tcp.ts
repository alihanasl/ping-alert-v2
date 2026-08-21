import { encodeI18nMessage } from '@shared/i18nMessage'
import net from 'node:net'
import type { ProbeResult } from './result'

export function tcpCheck(host: string, port: number, timeoutMs = 2000): Promise<ProbeResult> {
  const safeHost = host.trim()

  if (!safeHost || /\s/.test(safeHost) || !Number.isInteger(port) || port < 1 || port > 65535) {
    return Promise.resolve({
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.invalidHostOrPort')
    })
  }

  return new Promise((resolve) => {
    const startedAt = Date.now()
    const socket = new net.Socket()
    let settled = false

    const finish = (result: ProbeResult): void => {
      if (settled) {
        return
      }

      settled = true
      socket.destroy()
      resolve(result)
    }

    socket.setTimeout(Math.max(200, timeoutMs))

    socket.once('connect', () => {
      finish({
        ok: true,
        responseTimeMs: Date.now() - startedAt,
        message: encodeI18nMessage('probe.portOpen', { port })
      })
    })

    socket.once('timeout', () => {
      finish({
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.connectTimeout')
      })
    })

    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') {
        finish({
          ok: false,
          responseTimeMs: null,
          message: encodeI18nMessage('probe.portClosed', { port })
        })
        return
      }

      if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
        finish({
          ok: false,
          responseTimeMs: null,
          message: encodeI18nMessage('probe.hostNotFound')
        })
        return
      }

      finish({
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.tcpFailed')
      })
    })

    socket.connect(port, safeHost)
  })
}
