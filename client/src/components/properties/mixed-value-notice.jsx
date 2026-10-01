export default function MixedValueNotice({ id, isMixed, onApply, label }) {
  if (!isMixed) return null
  return (
    <div className="text-[11px] text-text-muted">
      <span id={id}>Multiple values</span>
      <button
        type="button"
        aria-label={`Apply primary ${label} to all selected elements`}
        className="ml-2 text-accent underline"
        onClick={onApply}
      >
        Apply primary to all
      </button>
    </div>
  )
}
