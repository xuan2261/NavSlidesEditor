import { Input, Select } from '../../components/ui'
import { Button } from '../../components/ui'
import { clampNumber } from '../../utils/number-input'
/**
 * Code block properties: edit button, language, font size, border radius.
 */

const CODE_LANGUAGES = [
  { id: 'plaintext', label: 'Plain Text' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'r', label: 'R' },
  { id: 'scala', label: 'Scala' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'bash', label: 'Bash/Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'latex', label: 'LaTeX' },
]

export default function CodeProperties({ element, onUpdate, onEditCode }) {
  return (
    <div className="mb-2.5">
      <Button
        data-testid="prop-code-edit"
        variant="secondary"
        className="w-full justify-center text-xs mb-2"
        onClick={onEditCode}
      >
        Edit Code
      </Button>
      <div className="grid grid-cols-[1fr_80px] gap-2">
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Language</div>
          <Select
            data-testid="prop-code-language"
            className="w-full bg-card border border-border text-text-primary px-1.5 py-1 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            value={element.language || 'plaintext'}
            onChange={(e) => onUpdate({ language: e.target.value })}
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <div className="text-[11px] text-text-muted mb-0.5">Font Size</div>
          <Input
            data-testid="prop-code-font-size"
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            min="8"
            max="32"
            step="1"
            value={element.fontSize || 14}
            onChange={(e) => {
              const value = clampNumber(e.target.value, 8, 32, null)
              if (value === null) return
              onUpdate({ fontSize: value })
            }}
          />
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[11px] text-text-muted mb-0.5">
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          data-testid="prop-code-border-radius"
          type="range"
          className="w-full accent-accent"
          min="0"
          max="50"
          value={element.borderRadius || 0}
          onChange={(e) => {
            const value = clampNumber(e.target.value, 0, 50, null)
            if (value === null) return
            onUpdate({ borderRadius: value })
          }}
        />
      </div>
    </div>
  )
}
