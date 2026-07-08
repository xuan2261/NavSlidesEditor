import { Clipboard, Scissors, Copy, ClipboardCopy } from 'lucide-react'
import { Button } from '../../ui'
import RibbonBigButton from '../ribbon-big-button'

function keyboardActivate(handler) {
  return (event) => {
    if (event.repeat) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handler?.()
  }
}

export default function ClipboardButtons({ onPaste, onCut, onCopy, onDuplicate }) {
  return (
    <div className="flex items-center gap-0.5">
      <RibbonBigButton
        icon={Clipboard}
        label="Paste"
        title="Paste (Ctrl+V)"
        aria-label="Paste"
        onMouseDown={(e) => { e.preventDefault(); onPaste?.() }}
        onKeyDown={keyboardActivate(onPaste)}
      />
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); onCut?.() }}
        onKeyDown={keyboardActivate(onCut)}
        title="Cut (Ctrl+X)"
        aria-label="Cut"
      >
        <Scissors size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); onCopy?.() }}
        onKeyDown={keyboardActivate(onCopy)}
        title="Copy (Ctrl+C)"
        aria-label="Copy"
      >
        <Copy size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); onDuplicate?.() }}
        onKeyDown={keyboardActivate(onDuplicate)}
        title="Duplicate (Ctrl+D)"
        aria-label="Duplicate"
      >
        <ClipboardCopy size={14} />
      </Button>
    </div>
  )
}
