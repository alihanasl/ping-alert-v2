import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import i18n from './i18n'
import App from './App'
import './styles.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

async function boot(): Promise<void> {
  try {
    const settings = await window.pingAlert.getSettings()
    await i18n.changeLanguage(settings.ui_locale)
    document.documentElement.lang = settings.ui_locale
    document.title = i18n.t('app.name')
  } catch {
    document.documentElement.lang = i18n.language
  }

  createRoot(rootElement as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void boot()
