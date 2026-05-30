import { cn } from '../../lib/utils'

// PowerPoint-style big command button: icon stacked over an 11px label, ~52px
// tall so it fits inside the 80px command row. Used for a tab's primary action
// (Paste, Text Box, Picture) while secondary actions stay as small buttons.
export default function RibbonBigButton({
  icon: Icon,
  label,
  onClick,
  title,
  active,
  disabled,
  'aria-label': ariaLabel,
  ...rest
}) {
  return (
    <button
      type="button"
      data-ribbon-big-button=""
      title={title}
      aria-label={ariaLabel || title || label}
      aria-pressed={active || undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-1 px-2.5 h-[52px] min-w-[56px] rounded-md',
        'text-text-secondary hover:bg-hover hover:text-text-primary transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        active && 'bg-primary-light text-accent',
        disabled && 'opacity-50 pointer-events-none'
      )}
      {...rest}
    >
      <Icon size={22} />
      <span className="text-[11px] leading-none">{label}</span>
    </button>
  )
}
