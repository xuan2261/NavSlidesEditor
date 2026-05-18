import { Clipboard, Scissors, Copy, ClipboardCopy } from 'lucide-react'
import { Button } from '../../ui'

export default function ClipboardButtons({ onPaste, onCut, onCopy, onDuplicate }) {
  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ribbon"
        className="h-7"
        onMouseDown={(e) => { e.preventDefault(); onPaste?.() }}
        title="Paste (Ctrl+V)"
        aria-label="Paste"
      >
        <Clipboard size={14} />
        <span className="hidden lg:inline">Paste</span>
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); onCut?.() }}
        title="Cut (Ctrl+X)"
        aria-label="Cut"
      >
        <Scissors size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); onCopy?.() }}
        title="Copy (Ctrl+C)"
        aria-label="Copy"
      >
        <Copy size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); onDuplicate?.() }}
        title="Duplicate (Ctrl+D)"
        aria-label="Duplicate"
      >
        <ClipboardCopy size={14} />
      </Button>
    </div>
  )
}
