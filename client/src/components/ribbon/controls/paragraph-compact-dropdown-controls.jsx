import { useState, useRef, useEffect } from 'react'
import { AlignLeft, AlignCenter, AlignRight, List, ListOrdered, RemoveFormatting, ChevronDown, Pilcrow } from 'lucide-react'
import { Button } from '../../ui'

export default function ParagraphCompactControls({ editor, rememberSelection, runTextCommand }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  if (!editor) return null

  const handleKeyboardActivation = (event, action) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    action(event)
  }

  const handleMenuCommand = (commandFn) => (e) => {
    e.preventDefault()
    rememberSelection()
    runTextCommand(commandFn)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ribbon"
        aria-expanded={open}
        aria-haspopup="menu"
        onMouseDown={(e) => {
          e.preventDefault()
          rememberSelection()
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => handleKeyboardActivation(e, () => {
          rememberSelection()
          setOpen((v) => !v)
        })}
        title="Paragraph formatting"
        aria-label="Paragraph"
      >
        <Pilcrow size={14} />
        <span className="hidden lg:inline">Paragraph</span>
        <ChevronDown size={10} className="ml-0.5 opacity-60" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg p-2 shadow-xl z-[1000] min-w-[160px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-text-muted mb-1.5">Alignment</div>
          <div className="flex items-center gap-0.5 mb-2">
            <Button
              variant="icon"
              className={`h-7 w-7 ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={handleMenuCommand((chain) => chain.setTextAlign('left'))}
              onKeyDown={(e) => handleKeyboardActivation(e, handleMenuCommand((chain) => chain.setTextAlign('left')))}
              title="Align left"
              aria-label="Align left"
            >
              <AlignLeft size={14} />
            </Button>
            <Button
              variant="icon"
              className={`h-7 w-7 ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={handleMenuCommand((chain) => chain.setTextAlign('center'))}
              onKeyDown={(e) => handleKeyboardActivation(e, handleMenuCommand((chain) => chain.setTextAlign('center')))}
              title="Align center"
              aria-label="Align center"
            >
              <AlignCenter size={14} />
            </Button>
            <Button
              variant="icon"
              className={`h-7 w-7 ${editor.isActive({ textAlign: 'right' }) ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={handleMenuCommand((chain) => chain.setTextAlign('right'))}
              onKeyDown={(e) => handleKeyboardActivation(e, handleMenuCommand((chain) => chain.setTextAlign('right')))}
              title="Align right"
              aria-label="Align right"
            >
              <AlignRight size={14} />
            </Button>
          </div>

          <div className="text-[10px] text-text-muted mb-1.5">Lists</div>
          <div className="flex items-center gap-0.5 mb-2">
            <Button
              variant="icon"
              className={`h-7 w-7 ${editor.isActive('bulletList') ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={handleMenuCommand((chain) => chain.toggleBulletList())}
              onKeyDown={(e) => handleKeyboardActivation(e, handleMenuCommand((chain) => chain.toggleBulletList()))}
              title="Bullet list"
              aria-label="Bullet list"
            >
              <List size={14} />
            </Button>
            <Button
              variant="icon"
              className={`h-7 w-7 ${editor.isActive('orderedList') ? 'bg-primary-light text-accent' : ''}`}
              onMouseDown={handleMenuCommand((chain) => chain.toggleOrderedList())}
              onKeyDown={(e) => handleKeyboardActivation(e, handleMenuCommand((chain) => chain.toggleOrderedList()))}
              title="Ordered list"
              aria-label="Ordered list"
            >
              <ListOrdered size={14} />
            </Button>
          </div>

          <div className="text-[10px] text-text-muted mb-1.5">Line Height</div>
          <select
            className="h-7 w-full bg-card border border-border text-text-primary px-1.5 rounded text-xs cursor-pointer mb-2"
            value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || ''}
            onMouseDown={(e) => {
              e.stopPropagation()
              rememberSelection()
            }}
            onChange={(e) => {
              e.target.value
                ? runTextCommand((chain) => chain.setLineHeight(e.target.value))
                : runTextCommand((chain) => chain.unsetLineHeight())
              setOpen(false)
            }}
          >
            <option value="">Default</option>
            {['1', '1.15', '1.5', '2', '2.5', '3'].map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>

          <button
            role="menuitem"
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-[11px] text-left cursor-pointer transition-colors hover:bg-secondary text-text-primary"
            onMouseDown={(e) => {
              e.preventDefault()
              rememberSelection()
              runTextCommand((chain) => chain.clearNodes().unsetAllMarks())
              setOpen(false)
            }}
            onKeyDown={(e) => handleKeyboardActivation(e, () => {
              rememberSelection()
              runTextCommand((chain) => chain.clearNodes().unsetAllMarks())
              setOpen(false)
            })}
          >
            <RemoveFormatting size={14} />
            Clear Formatting
          </button>
        </div>
      )}
    </div>
  )
}
