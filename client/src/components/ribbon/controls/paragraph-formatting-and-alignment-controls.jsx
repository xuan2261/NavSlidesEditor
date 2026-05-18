import { AlignLeft, AlignCenter, AlignRight, List, ListOrdered, RemoveFormatting } from 'lucide-react'
import { Button } from '../../ui'

export default function ParagraphControls({ editor, rememberSelection, runTextCommand, handleTextCommandMouseDown }) {
  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive({ textAlign: 'left' }) ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.setTextAlign('left'))}
        title="Align left"
        aria-label="Align left"
        aria-pressed={editor.isActive({ textAlign: 'left' })}
      >
        <AlignLeft size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive({ textAlign: 'center' }) ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.setTextAlign('center'))}
        title="Align center"
        aria-label="Align center"
        aria-pressed={editor.isActive({ textAlign: 'center' })}
      >
        <AlignCenter size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive({ textAlign: 'right' }) ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.setTextAlign('right'))}
        title="Align right"
        aria-label="Align right"
        aria-pressed={editor.isActive({ textAlign: 'right' })}
      >
        <AlignRight size={14} />
      </Button>

      <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />

      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive('bulletList') ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleBulletList())}
        title="Bullet list"
        aria-label="Bullet list"
        aria-pressed={editor.isActive('bulletList')}
      >
        <List size={14} />
      </Button>
      <Button
        variant="icon"
        className={`h-7 w-7 ${editor.isActive('orderedList') ? 'bg-primary-light text-accent' : ''}`}
        onMouseDown={handleTextCommandMouseDown((chain) => chain.toggleOrderedList())}
        title="Ordered list"
        aria-label="Ordered list"
        aria-pressed={editor.isActive('orderedList')}
      >
        <ListOrdered size={14} />
      </Button>

      <span className="mx-1 h-5 w-[1px] shrink-0 bg-border" />

      <select
        data-testid="line-height-select"
        className="bg-card border border-border text-text-primary px-1.5 py-0.5 rounded text-xs w-[60px] cursor-pointer"
        value={editor.getAttributes('paragraph').lineHeight || editor.getAttributes('heading').lineHeight || ''}
        onMouseDown={() => rememberSelection()}
        onChange={(e) =>
          e.target.value
            ? runTextCommand((chain) => chain.setLineHeight(e.target.value))
            : runTextCommand((chain) => chain.unsetLineHeight())
        }
        title="Line height"
      >
        <option value="">Line</option>
        {['1', '1.15', '1.5', '2', '2.5', '3'].map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>

      <Button
        variant="icon"
        className="h-7 w-7"
        onMouseDown={(e) => {
          e.preventDefault()
          rememberSelection()
          runTextCommand((chain) => chain.clearNodes().unsetAllMarks())
        }}
        title="Clear formatting"
        aria-label="Clear formatting"
      >
        <RemoveFormatting size={14} />
      </Button>
    </div>
  )
}
