import { encodeI18nMessage } from '@shared/i18nMessage'
import http from 'node:http'
import https from 'node:https'
import { URL } from 'node:url'
import type { ProbeResult } from './result'

const MAX_REDIRECTS = 5
const USER_AGENT = 'PingAlertV2/0.1'

export function buildHttpUrl(host: string, path?: string): URL {
  const trimmedHost = host.trim()

  if (/^https?:\/\//i.test(trimmedHost)) {
    return new URL(trimmedHost)
  }

  const normalizedPath = !path || path === '/' ? '/' : path.startsWith('/') ? path : `/${path}`
  return new URL(`https://${trimmedHost}${normalizedPath}`)
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

function requestOnce(url: URL, timeoutMs: number): Promise<{ statusCode: number; location: string | null }> {
  return new Promise((resolve, reject) => {
    const options = {
      method: 'GET',
      timeout: timeoutMs,
      headers: {
        Accept: '*/*',
        'User-Agent': USER_AGENT
      }
    }

    const request =
      url.protocol === 'https:'
        ? https.request(url, { ...options, rejectUnauthorized: false }, handleResponse)
        : http.request(url, options, handleResponse)

    function handleResponse(response: http.IncomingMessage): void {
      response.resume()
      resolve({
        statusCode: response.statusCode ?? 0,
        location: typeof response.headers.location === 'string' ? response.headers.location : null
      })
    }

    request.setTimeout(timeoutMs, () => {
      request.destroy()
      reject(new Error('timeout'))
    })

    request.on('error', (error) => {
      reject(error)
    })

    request.end()
  })
}

export async function httpCheck(
  host: string,
  path: string | undefined,
  timeoutMs = 5000
): Promise<ProbeResult> {
  const safeHost = host.trim()

  if (!safeHost || /\s/.test(safeHost)) {
    return {
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.invalidHttpUrl')
    }
  }

  let currentUrl: URL
  try {
    currentUrl = buildHttpUrl(safeHost, path)
  } catch {
    return {
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.invalidHttpUrl')
    }
  }

  if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
    return {
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.httpProtocol')
    }
  }

  const startedAt = Date.now()

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const remainingMs = timeoutMs - (Date.now() - startedAt)
      if (remainingMs < 200) {
        return {
          ok: false,
          responseTimeMs: null,
          message: encodeI18nMessage('probe.httpTimeout')
        }
      }

      const { statusCode, location } = await requestOnce(currentUrl, remainingMs)

      if (isRedirectStatus(statusCode)) {
        if (!location) {
          return {
            ok: false,
            responseTimeMs: Date.now() - startedAt,
            message: encodeI18nMessage('probe.httpStatus', { status: statusCode })
          }
        }

        currentUrl = new URL(location, currentUrl)
        if (currentUrl.protocol !== 'http:' && currentUrl.protocol !== 'https:') {
          return {
            ok: false,
            responseTimeMs: Date.now() - startedAt,
            message: encodeI18nMessage('probe.invalidRedirect')
          }
        }
        continue
      }

      const responseTimeMs = Date.now() - startedAt
      if (statusCode >= 200 && statusCode < 400) {
        return {
          ok: true,
          responseTimeMs,
          message: encodeI18nMessage('probe.httpStatus', { status: statusCode })
        }
      }

      return {
        ok: false,
        responseTimeMs,
        message: encodeI18nMessage('probe.httpStatus', { status: statusCode })
      }
    }

    return {
      ok: false,
      responseTimeMs: Date.now() - startedAt,
      message: encodeI18nMessage('probe.tooManyRedirects')
    }
  } catch (error) {
    if (error instanceof Error && /timeout/i.test(error.message)) {
      return {
        ok: false,
        responseTimeMs: null,
        message: encodeI18nMessage('probe.httpTimeout')
      }
    }

    return {
      ok: false,
      responseTimeMs: null,
      message: encodeI18nMessage('probe.httpFailed')
    }
  }
}
