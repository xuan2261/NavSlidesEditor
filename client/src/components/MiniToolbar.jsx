import { useEffect, useRef } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  Type, Palette, Highlighter,
} from 'lucide-react'

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
    <div className="mini-toolbar" ref={ref} style={{ left: position.x, top: position.y }}>
      {/* Bold */}
      <button
        className={`mini-tb-btn ${isActive('bold') ? 'active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); toggle('bold') }}
        title="Bold (Ctrl+B)"
      >
        <Bold size={13} />
      </button>
      {/* Italic */}
      <button
        className={`mini-tb-btn ${isActive('italic') ? 'active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); toggle('italic') }}
        title="Italic (Ctrl+I)"
      >
        <Italic size={13} />
      </button>
      {/* Underline */}
      <button
        className={`mini-tb-btn ${isActive('underline') ? 'active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); toggle('underline') }}
        title="Underline (Ctrl+U)"
      >
        <Underline size={13} />
      </button>
      {/* Strikethrough */}
      <button
        className={`mini-tb-btn ${isActive('strike') ? 'active' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); toggle('strike') }}
        title="Strikethrough"
      >
        <Strikethrough size={13} />
      </button>

      <div className="mini-tb-divider" />

      {/* Font Color */}
      <button
        className="mini-tb-btn mini-tb-color-btn"
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
          className="mini-tb-color-input"
          onChange={(e) => {
            editor.chain().focus().setColor(e.target.value).run()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </button>

      {/* Highlight Color */}
      <button
        className="mini-tb-btn mini-tb-highlight-btn"
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
          className="mini-tb-highlight-input"
          onChange={(e) => {
            editor.chain().focus().toggleHighlight({ color: e.target.value }).run()
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </button>

      <div className="mini-tb-divider" />

      {/* Font Size */}
      <div className="mini-tb-font-size">
        <Type size={12} />
        <select
          value={currentFontSize}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            editor.chain().focus().setFontSize(e.target.value).run()
          }}
        >
          {[12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72, 96].map(size => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {/* Arrow pointing down */}
      <div className="mini-tb-arrow" />
    </div>
  )
}