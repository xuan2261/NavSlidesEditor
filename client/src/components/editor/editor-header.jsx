import { ChevronLeft } from 'lucide-react'
import { Button, Input } from '../ui'

export default function EditorHeader({
  isTemplate,
  title,
  onTitleChange,
  onGoHome,
  quickAccessToolbar,
  ribbonHeader,
}) {
  return (
    <div className="relative z-[200] flex min-w-0 items-center gap-x-2 overflow-hidden px-2 py-1.5 min-h-[44px] bg-secondary border-b border-border shrink-0 lg:gap-x-3 lg:px-4">
      <Button
        variant="ghost"
        className="flex items-center gap-1.5 text-text-secondary text-[13px] px-2.5 py-1.5 rounded-sm transition-colors hover:bg-hover hover:text-text-primary"
        onClick={onGoHome}
      >
        <ChevronLeft size={16} />
        Back
      </Button>
      {isTemplate && (
        <span className="mr-1 shrink-0 rounded bg-amber-500 px-2 py-0.5 text-[11px] font-semibold text-black">
          TEMPLATE
        </span>
      )}
      <Input
        className="w-[120px] shrink-0 lg:w-[200px]"
        value={title}
        onChange={onTitleChange}
        placeholder={isTemplate ? 'Untitled Template' : 'Untitled Presentation'}
      />
      {quickAccessToolbar}
      {ribbonHeader}
    </div>
  )
}
