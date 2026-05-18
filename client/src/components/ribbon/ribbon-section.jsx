import { cn } from '../../lib/utils'

export default function RibbonSection({ label, children, className }) {
  return (
    <div className={cn('flex flex-col justify-between px-3 py-1.5 shrink-0', className)}>
      <div className="flex items-center justify-center gap-1 flex-1">{children}</div>
      {label && (
        <span className="text-[10px] text-text-muted leading-none select-none text-center">{label}</span>
      )}
    </div>
  )
}
