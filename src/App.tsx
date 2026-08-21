import { I18nextProvider } from 'react-i18next'
import { DevicesPage } from './pages/DevicesPage'
import i18n from './i18n'

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(45,212,191,0.12),_transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(15,23,42,0.9),_transparent_50%)]" />
        <div className="relative">
          <DevicesPage />
        </div>
      </div>
    </I18nextProvider>
  )
}
