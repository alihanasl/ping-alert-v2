const I18N_PREFIX = 'i18n:'

export type I18nParams = Record<string, string | number>

export function encodeI18nMessage(key: string, params?: I18nParams): string {
  if (!params || Object.keys(params).length === 0) {
    return `${I18N_PREFIX}${key}`
  }

  return `${I18N_PREFIX}${key}|${JSON.stringify(params)}`
}

export function i18nError(key: string, params?: I18nParams): Error {
  return new Error(encodeI18nMessage(key, params))
}

export function translateStored(
  raw: string,
  translate: (key: string, params?: I18nParams) => string
): string {
  if (!raw.startsWith(I18N_PREFIX)) {
    return raw
  }

  const payload = raw.slice(I18N_PREFIX.length)
  const separator = payload.indexOf('|')
  const key = separator === -1 ? payload : payload.slice(0, separator)
  let params: I18nParams | undefined

  if (separator !== -1) {
    try {
      params = JSON.parse(payload.slice(separator + 1)) as I18nParams
    } catch {
      params = undefined
    }
  }

  if (params) {
    const resolved: I18nParams = {}
    for (const [name, value] of Object.entries(params)) {
      resolved[name] = typeof value === 'string' ? translateStored(value, translate) : value
    }
    return translate(key, resolved)
  }

  return translate(key)
}
