interface ProgressBarProps {
  current: number
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100)

  return (
    <div className="mb-8">
      {/* Thin teal bar */}
      <div className="h-0.5 w-full rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-brand-teal transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      {/* Step counter */}
      <p className="mt-2 text-xs text-foreground-muted">
        {current} of {total}
      </p>
    </div>
  )
}
