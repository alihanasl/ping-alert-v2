import i18next from 'i18next'
import { translateStored } from '@shared/i18nMessage'
import { DEFAULT_LOCALE, type UiLocale } from '@shared/locales'
import en from '@shared/locales/en.json'
import tr from '@shared/locales/tr.json'

const i18n = i18next.createInstance()

export async function initMainI18n(locale: UiLocale): Promise<void> {
  if (i18n.isInitialized) {
    await i18n.changeLanguage(locale)
    return
  }

  await i18n.init({
    resources: {
      en: { translation: en },
      tr: { translation: tr }
    },
    lng: locale || DEFAULT_LOCALE,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    returnNull: false
  })
}

export function setMainLocale(locale: UiLocale): void {
  if (i18n.isInitialized) {
    void i18n.changeLanguage(locale)
  }
}

export function tMain(key: string, params?: Record<string, string | number>): string {
  return i18n.t(key, params)
}

export function tStoredMain(raw: string | null | undefined): string {
  if (!raw) {
    return tMain('common.emDash')
  }

  return translateStored(raw, (key, params) => tMain(key, params))
}
