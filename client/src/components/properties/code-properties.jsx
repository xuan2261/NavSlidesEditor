import { Input, Select } from '../../components/ui'
import { Button } from '../../components/ui'
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
            className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs transition-colors focus:outline-none focus:border-accent placeholder:text-text-muted"
            type="number"
            min="8"
            max="32"
            step="1"
            value={element.fontSize || 14}
            onChange={(e) =>
              onUpdate({ fontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) })
            }
          />
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[11px] text-text-muted mb-0.5">
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          type="range"
          className="w-full accent-accent"
          min="0"
          max="50"
          value={element.borderRadius || 0}
          onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
        />
      </div>
    </div>
  )
}
