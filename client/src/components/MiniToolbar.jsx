import { useEffect, useRef } from 'react'
import { Bold, Italic, Underline, Strikethrough, Type, Palette, Highlighter } from 'lucide-react'

export default function MiniToolbar({ editor, position, onClose }) {
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose()
      }
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  if (!editor) return null

  const isActive = (type, attrs) => editor.isActive(type, attrs)
  const toggle = (type, attrs) => {
    const method = `toggle${type.charAt(0).toUpperCase() + type.slice(1)}`
    if (attrs) {
      editor.chain().focus()[method](attrs).run()
    } else {
      editor.chain().focus()[method]().run()
    }
  }

  const currentFontSize = editor.getAttributes('textStyle').fontSize || '18'

  return (
    <div
      className="pointer-events-auto fixed z-[9999] flex items-center gap-[1px] rounded-md border border-border bg-card p-1 shadow-lg -translate-x-1/2 -translate-y-[calc(100%+12px)]"
      ref={ref}
      style={{ left: position.x, top: position.y }}
    >
      {/* Bold */}
      <button
        className={`relative flex h-7 w-7 items-center justify-center rounded text-text-primary transition-colors hover:bg-hover ${isActive('bold') ? 'bg-accent/20 text-accent' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          toggle('bold')
        }}
        title="Bold (Ctrl+B)"
      >
        <Bold size={13} />
      </button>
      {/* Italic */}
      <button
        className={`relative flex h-7 w-7 items-center justify-center rounded text-text-primary transition-colors hover:bg-hover ${isActive('italic') ? 'bg-accent/20 text-accent' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          toggle('italic')
        }}
        title="Italic (Ctrl+I)"
      >
        <Italic size={13} />
      </button>
      {/* Underline */}
      <button
        className={`relative flex h-7 w-7 items-center justify-center rounded text-text-primary transition-colors hover:bg-hover ${isActive('underline') ? 'bg-accent/20 text-accent' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          toggle('underline')
        }}
        title="Underline (Ctrl+U)"
      >
        <Underline size={13} />
      </button>
      {/* Strikethrough */}
      <button
        className={`relative flex h-7 w-7 items-center justify-center rounded text-text-primary transition-colors hover:bg-hover ${isActive('strike') ? 'bg-accent/20 text-accent' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault()
          toggle('strike')
        }}
        title="Strikethrough"
      >
        <Strikethrough size={13} />
      </button>

      <div className="mx-[2px] h-5 w-[1px] bg-border" />

      {/* Font Color */}
      <button
        className="relative flex h-7 w-7 items-center justify-center rounded text-text-primary transition-colors hover:bg-hover"
        onMouseDown={(e) => {
          e.preventDefault()
          const input = ref.current.querySelector('.mini-tb-color-input')
          if (input) input.click()
        }}
        title="Text color"
      >
        <Palette size={13} />
        <input
          type="color"
          className="absolute h-[1px] w-[1px] opacity-0 pointer-events-none mini-tb-color-input"
          onChange={(e) => {
            editor.chain().focus().setColor(e.target.value).run()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </button>

      {/* Highlight Color */}
      <button
        className="relative flex h-7 w-7 items-center justify-center rounded text-text-primary transition-colors hover:bg-hover"
        onMouseDown={(e) => {
          e.preventDefault()
          const input = ref.current.querySelector('.mini-tb-highlight-input')
          if (input) input.click()
        }}
        title="Highlight color"
      >
        <Highlighter size={13} />
        <input
          type="color"
          className="absolute h-[1px] w-[1px] opacity-0 pointer-events-none mini-tb-highlight-input"
          onChange={(e) => {
            editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </button>

      <div className="mx-[2px] h-5 w-[1px] bg-border" />

      {/* Font Size */}
      <div className="flex items-center gap-1 px-1 text-text-muted">
        <Type size={12} />
        <select
          className="cursor-pointer rounded border border-border bg-surface-2 px-1 py-0.5 text-xs text-text-primary outline-none"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            editor.chain().focus().setFontSize(e.target.value).run()
          }}
        >
          {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {/* Arrow pointing down */}
      <div className="absolute -bottom-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-border" />
    </div>
  )
}
