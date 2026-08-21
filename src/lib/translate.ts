import type { TFunction } from 'i18next'
import { translateStored } from '@shared/i18nMessage'
import i18n from '../i18n'

export function tStored(raw: string, translate?: TFunction): string {
  const t = translate ?? i18n.t.bind(i18n)
  return translateStored(raw, (key, params) => t(key, params))
}

export function tError(error: unknown, fallbackKey: string, translate?: TFunction): string {
  const t = translate ?? i18n.t.bind(i18n)

  if (error instanceof Error && error.message) {
    return tStored(error.message, t)
  }

  return t(fallbackKey)
}
