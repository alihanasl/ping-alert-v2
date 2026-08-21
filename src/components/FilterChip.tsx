export function FilterChip({
  active,
  label,
  onClick
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'shrink-0 rounded-full bg-teal-500 px-3 py-1.5 text-xs font-medium text-slate-950'
          : 'shrink-0 rounded-full border border-slate-700/80 bg-slate-900/40 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-800'
      }
    >
      {label}
    </button>
  )
}
