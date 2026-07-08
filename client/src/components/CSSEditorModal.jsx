import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { Button, useModalFocusTrap } from '../components/ui'
import { isBackdropClick } from '../lib/utils'

export default function CSSEditorModal({ customCSS, onUpdate, onClose }) {
  const [isOpen, setIsOpen] = useState(true)
  const { dialogRef, handleFocusTrapKeyDown } = useModalFocusTrap()

  const handleClose = () => {
    setIsOpen(false)
    onClose()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60"
      onClick={(event) => {
        if (isBackdropClick(event)) handleClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="css-editor-modal-title"
      ref={dialogRef}
      onKeyDown={handleFocusTrapKeyDown}
    >
      <div
        className="bg-[#1e1e2e] rounded-xl w-[560px] max-h-[80vh] flex flex-col border border-white/10 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
          <h2 id="css-editor-modal-title" className="font-semibold text-sm text-[#e0e0e0]">Custom CSS</h2>
          <Button variant="ghost" onClick={handleClose} className="p-1" aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="p-4 flex-1 overflow-auto">
          <div className="text-[11px] text-[#a0a0b0] mb-2">
            Add CSS rules to customize your presentation. These styles are injected into the
            generated HTML and applied during presentation mode.
          </div>
          <textarea
            value={customCSS || ''}
            onChange={(e) => onUpdate(e.target.value)}
            placeholder={`.reveal .slides section {\n  /* your styles here */\n}\n\n.reveal .slides section h1 {\n  color: #6366f1;\n  text-shadow: 0 2px 8px rgba(0,0,0,0.3);\n}`}
            className="w-full min-h-[240px] bg-[#0d0d14] text-[#e0e0e0] border border-white/10 rounded-lg px-3 py-2.5 font-mono text-[13px] leading-relaxed resize-y focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="px-4 py-3 border-t border-white/10 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onUpdate('')}>
            Clear
          </Button>
          <Button variant="primary" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
