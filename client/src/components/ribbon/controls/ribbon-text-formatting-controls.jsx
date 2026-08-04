import { Bold, Italic, Underline, Strikethrough, Type, Highlighter } from 'lucide-react'
import { Button } from '../../ui'
import { handleRibbonKeyboardActivation } from '../ribbon-keyboard-activation'

const FONT_FAMILIES = [
  { group: 'Sans-serif', fonts: [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Helvetica', value: "'Helvetica Neue', sans-serif" },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Trebuchet', value: "'Trebuchet MS', sans-serif" },
    { label: 'Inter', value: 'Inter, sans-serif' },
    { label: 'Roboto', value: 'Roboto, sans-serif' },
    { label: 'Open Sans', value: "'Open Sans', sans-serif" },
    { label: 'Source Sans Pro', value: "'Source Sans Pro', sans-serif" },
  ]},
  { group: 'Serif', fonts: [
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Times New Roman', value: "'Times New Roman', serif" },
    { label: 'Playfair Display', value: "'Playfair Display', serif" },
    { label: 'Merriweather', value: 'Merriweather, serif' },
    { label: 'Computer Modern', value: "'Computer Modern Serif', serif" },
  ]},
  { group: 'Monospace', fonts: [
    { label: 'Courier New', value: "'Courier New', monospace" },
    { label: 'Fira Code', value: "'Fira Code', monospace" },
    { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  ]},
  { group: 'Display', fonts: [
    { label: 'Impact', value: 'Impact, sans-serif' },
  ]},
]

const FONT_SIZES = ['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','40px','48px','56px','64px','72px','96px']
const FONT_WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export default function FontControls({ editor, element, rememberSelection, runTextCommand, handleTextCommandMouseDown }) {
  if (!editor) return null

  // The ribbon reflects inline text-style marks first; when a span has no mark,
  // fall back to the element-level style so the controls match what's rendered.
  const textStyle = editor.getAttributes('textStyle')
  const currentFontFamily = textStyle.fontFamily || element?.fontFamily || ''
  const currentFontSize = textStyle.fontSize || (element?.fontSize ? `${element.fontSize}px` : '')
  const currentColor = textStyle.color || element?.textColor || '#ffffff'
  const handleKeyboardCommand = (event, command) =>
    handleRibbonKeyboardActivation(event, () => {
      rememberSelection()
      runTextCommand(command)
    })

  return (
    <div className="flex items-center gap-0.5">
      <select
        className="h-7 bg-card border border-border text-text-primary px-1.5 rounded text-xs max-w-[110px] cursor-pointer"
        value={currentFontFamily}
        onMouseDown={() => rememberSelection()}
        onChange={(e) =>
          e.target.value
            ? runTextCommand((chain) => chain.setFontFamily(e.target.value))
            : runTextCommand((chain) => chain.unsetFontFamily())
        }
        title="Font family"
        aria-label="Font family"
      >
        <option value="">Default</option>
        {FONT_FAMILIES.map((group) => (
          <optgroup key={group.group} label={group.group}>
            {group.fonts.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        className="h-7 bg-card border border-border text-text-primary px-1.5 rounded text-xs w-[55px] cursor-pointer"
        value={currentFontSize}
        onMouseDown={() => rememberSelection()}
        onChange={(e) =>
          e.target.value
            ? runTextCommand((chain) => chain.setFontSize(e.target.value))
            : runTextCommand((chain) => chain.unsetFontSize())
        }
        title="Font size"
        aria-label="Font size"
      >
        <option value="">Auto</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s.replace('px', '')}</option>
        ))}
      </select>

      <select
        data-testid="font-weight-select"
        className="h-7 bg-card border border-border text-text-primary px-1.5 rounded text-xs w-[65px] cursor-pointer"
        value={editor.getAttributes('textStyle').fontWeight || ''}
        onMouseDown={() => rememberSelection()}
        onChange={(e) =>
          e.target.value
            ? runTextCommand((chain) => chain.setFontWeight(e.target.value))
            : runTextCommand((chain) => chain.unsetFontWeight())
        }
        title="Font weight"
        aria-label="Font weight"
      >
        <option value="">Weight</option>
        {FONT_WEIGHTS.map((w) => (
          <option key={w} value={String(w)}>{w}</option>
        ))}
      </select>

      <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />

      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive('bold') ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleBold())}
        onKeyDown={(e) => handleKeyboardCommand(e, (chain) => chain.toggleBold())}
        title="Bold (Ctrl+B)"
        aria-label="Bold"
        aria-pressed={editor.isActive('bold')}
      >
        <Bold size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive('italic') ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleItalic())}
        onKeyDown={(e) => handleKeyboardCommand(e, (chain) => chain.toggleItalic())}
        title="Italic (Ctrl+I)"
        aria-label="Italic"
        aria-pressed={editor.isActive('italic')}
      >
        <Italic size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive('underline') ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleUnderline())}
        onKeyDown={(e) => handleKeyboardCommand(e, (chain) => chain.toggleUnderline())}
        title="Underline (Ctrl+U)"
        aria-label="Underline"
        aria-pressed={editor.isActive('underline')}
      >
        <Underline size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive('strike') ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleStrike())}
        onKeyDown={(e) => handleKeyboardCommand(e, (chain) => chain.toggleStrike())}
        title="Strikethrough"
        aria-label="Strikethrough"
        aria-pressed={editor.isActive('strike')}
      >
        <Strikethrough size={14} />
      </Button>

      <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />

      <div className="relative">
        <Button
          variant="icon"
          className="h-7 w-7"
          onMouseDown={(e) => {
            e.preventDefault()
            rememberSelection()
          }}
          title="Text color"
          aria-label="Text color"
        >
          <Type size={14} />
          <span className="inline-block w-3 h-1 rounded-sm mt-0.5" style={{ background: currentColor }} />
        </Button>
        <input
          type="color"
          value={currentColor}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          onMouseDown={(e) => { e.stopPropagation(); rememberSelection() }}
          onChange={(e) => runTextCommand((chain) => chain.setColor(e.target.value))}
        />
      </div>

      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={handleTextCommandMouseDown((chain) => chain.setHighlight({ color: '#fef08a' }))}
        onKeyDown={(e) => handleKeyboardCommand(e, (chain) => chain.setHighlight({ color: '#fef08a' }))}
        title="Highlight"
        aria-label="Highlight"
      >
        <Highlighter size={14} />
      </Button>
    </div>
  )
}
