/** Add a JSON file under shared/locales and append the id here to enable a new language. Planned: de, es, fr, pt, ja, zh-CN. */
export const SUPPORTED_LOCALES = ['tr', 'en'] as const

export type UiLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: UiLocale = 'en'

export const LOCALE_NATIVE_NAMES: Record<UiLocale, string> = {
  tr: 'Türkçe',
  en: 'English'
}

export const LOCALE_BCP47: Record<UiLocale, string> = {
  tr: 'tr-TR',
  en: 'en-US'
}

export function isUiLocale(value: string): value is UiLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function resolveUiLocale(osLocale: string | null | undefined): UiLocale {
  const normalized = (osLocale ?? '').trim().toLowerCase().replace('_', '-')

  if (normalized === 'tr' || normalized.startsWith('tr-')) {
    return 'tr'
  }

  if (normalized === 'en' || normalized.startsWith('en-')) {
    return 'en'
  }

  return DEFAULT_LOCALE
}

export function toBcp47(locale: string): string {
  if (isUiLocale(locale)) {
    return LOCALE_BCP47[locale]
  }

  return locale
}
