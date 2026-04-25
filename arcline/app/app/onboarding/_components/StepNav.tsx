interface StepNavProps {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  isLoading?: boolean
  isFirst?: boolean
}

export function StepNav({
  onBack,
  onNext,
  nextLabel = 'Next',
  isLoading = false,
  isFirst = false,
}: StepNavProps) {
  return (
    <div className={`mt-10 flex gap-3 ${isFirst ? 'justify-end' : 'justify-between'}`}>
      {!isFirst && (
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className="rounded-xl border border-white/10 px-6 py-3 text-sm font-medium text-foreground-muted transition hover:border-white/20 hover:text-foreground disabled:opacity-40 cursor-pointer"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={isLoading}
        className="rounded-xl bg-brand-teal px-8 py-3 text-sm font-semibold text-background transition hover:bg-brand-teal-dim active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        {isLoading ? 'Saving…' : nextLabel}
      </button>
    </div>
  )
}
