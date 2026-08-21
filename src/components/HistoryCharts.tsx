import { useTranslation } from 'react-i18next'
import type { CheckHistoryPoint } from '@shared/types'

interface ResponseTimeChartProps {
  points: CheckHistoryPoint[]
}

const WIDTH = 640
const HEIGHT = 168
const PAD = { top: 16, right: 12, bottom: 28, left: 40 }

export function ResponseTimeChart({ points }: ResponseTimeChartProps) {
  const { t } = useTranslation()
  const samples = points.filter(
    (point): point is CheckHistoryPoint & { responseTimeMs: number } => point.responseTimeMs !== null
  )

  if (samples.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
        {t('history.noLatency')}
      </p>
    )
  }

  const maxMs = Math.max(...samples.map((point) => point.responseTimeMs), 1)
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const step = samples.length === 1 ? 0 : innerWidth / (samples.length - 1)

  const coords = samples.map((point, index) => {
    const x = PAD.left + index * step
    const y = PAD.top + innerHeight - (point.responseTimeMs / maxMs) * innerHeight
    return { x, y }
  })

  const polyline = coords.map((point) => `${point.x},${point.y}`).join(' ')
  const ticks = [0, 0.5, 1].map((ratio) => Math.round(maxMs * ratio))

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-40 w-full"
      role="img"
      aria-label={t('history.chartLabel')}
    >
      {ticks.map((tick) => {
        const y = PAD.top + innerHeight - (tick / maxMs) * innerHeight
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              y1={y}
              x2={WIDTH - PAD.right}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="11">
              {tick}
            </text>
          </g>
        )
      })}
      <polyline fill="none" stroke="#2dd4bf" strokeWidth="2.5" strokeLinejoin="round" points={polyline} />
      {coords.map((point, index) => (
        <circle key={`${samples[index].checkedAt}-${index}`} cx={point.x} cy={point.y} r="2.5" fill="#2dd4bf" />
      ))}
      <text x={PAD.left} y={HEIGHT - 6} fill="#64748b" fontSize="11">
        {t('history.older')}
      </text>
      <text x={WIDTH - PAD.right} y={HEIGHT - 6} textAnchor="end" fill="#64748b" fontSize="11">
        {t('history.newer')}
      </text>
    </svg>
  )
}

export function StatusStrip({ points }: { points: CheckHistoryPoint[] }) {
  const { t } = useTranslation()

  if (points.length === 0) {
    return <div className="h-3 rounded-full bg-slate-800" />
  }

  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-slate-800" title={t('history.statusStrip')}>
      {points.map((point, index) => (
        <div
          key={`${point.checkedAt}-${index}`}
          className={point.status === 'up' ? 'min-w-px flex-1 bg-teal-400' : 'min-w-px flex-1 bg-red-500'}
        />
      ))}
    </div>
  )
}
