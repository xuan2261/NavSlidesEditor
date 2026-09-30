import { Clipboard, Scissors, Copy, ClipboardCopy } from 'lucide-react'
import { Button } from '../../ui'
import RibbonBigButton from '../ribbon-big-button'

function keyboardActivate(handler, disabledReason) {
  return (event) => {
    if (disabledReason || event.repeat) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    handler?.()
  }
}

export default function ClipboardButtons({ onPaste, onCut, onCopy, onDuplicate, availability }) {
  return (
    <div className="flex items-center gap-0.5">
      <RibbonBigButton
        icon={Clipboard}
        label="Paste"
        title={availability?.paste || 'Paste (Ctrl+V)'}
        disabled={Boolean(availability?.paste)}
        aria-label="Paste"
        onMouseDown={(e) => { e.preventDefault(); if (!availability?.paste) onPaste?.() }}
        onKeyDown={keyboardActivate(onPaste, availability?.paste)}
      />
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); if (!availability?.cut) onCut?.() }}
        onKeyDown={keyboardActivate(onCut, availability?.cut)}
        title={availability?.cut || 'Cut (Ctrl+X)'}
        disabled={Boolean(availability?.cut)}
        aria-label="Cut"
      >
        <Scissors size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); if (!availability?.copy) onCopy?.() }}
        onKeyDown={keyboardActivate(onCopy, availability?.copy)}
        title={availability?.copy || 'Copy (Ctrl+C)'}
        disabled={Boolean(availability?.copy)}
        aria-label="Copy"
      >
        <Copy size={14} />
      </Button>
      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => { e.preventDefault(); if (!availability?.duplicate) onDuplicate?.() }}
        onKeyDown={keyboardActivate(onDuplicate, availability?.duplicate)}
        title={availability?.duplicate || 'Duplicate (Ctrl+D)'}
        disabled={Boolean(availability?.duplicate)}
        aria-label="Duplicate"
      >
        <ClipboardCopy size={14} />
      </Button>
    </div>
  )
}
