import { useTranslation } from 'react-i18next'
import type { DeviceStatusFilter, DeviceUiStatus } from '../lib/deviceStatus'

interface SummaryCardsProps {
  counts: Record<DeviceUiStatus | 'total', number>
  active: DeviceStatusFilter
  onSelect: (filter: DeviceStatusFilter) => void
}

const CARDS: Array<{
  id: DeviceStatusFilter
  countKey: DeviceUiStatus | 'total'
  labelKey: string
  accent: string
  value: string
}> = [
  {
    id: 'all',
    countKey: 'total',
    labelKey: 'devices.summary.total',
    accent: 'border-slate-700/80 hover:border-slate-500',
    value: 'text-slate-100'
  },
  {
    id: 'online',
    countKey: 'online',
    labelKey: 'device.status.online',
    accent: 'border-teal-500/20 hover:border-teal-400/50',
    value: 'text-teal-400'
  },
  {
    id: 'offline',
    countKey: 'offline',
    labelKey: 'device.status.offline',
    accent: 'border-red-500/20 hover:border-red-400/50',
    value: 'text-red-400'
  },
  {
    id: 'unknown',
    countKey: 'unknown',
    labelKey: 'device.status.unknown',
    accent: 'border-amber-500/20 hover:border-amber-400/40',
    value: 'text-amber-300'
  },
  {
    id: 'disabled',
    countKey: 'disabled',
    labelKey: 'device.status.disabled',
    accent: 'border-slate-700/80 hover:border-slate-500',
    value: 'text-slate-400'
  }
]

export function SummaryCards({ counts, active, onSelect }: SummaryCardsProps) {
  const { t } = useTranslation()

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {CARDS.map((card) => {
        const selected = active === card.id
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => {
              if (card.id !== 'all' && selected) {
                onSelect('all')
                return
              }

              onSelect(card.id)
            }}
            className={`rounded-2xl border bg-slate-900/70 px-4 py-3 text-left transition ${card.accent} ${
              selected ? 'ring-2 ring-teal-400/70' : ''
            }`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t(card.labelKey)}
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${card.value}`}>
              {counts[card.countKey]}
            </p>
          </button>
        )
      })}
    </div>
  )
}
