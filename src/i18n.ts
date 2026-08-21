import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_LOCALE } from '@shared/locales'
import en from '@shared/locales/en.json'
import tr from '@shared/locales/tr.json'

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    tr: { translation: tr }
  },
  lng: DEFAULT_LOCALE,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  },
  returnNull: false
})

export default i18n
