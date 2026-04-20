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
    <div style={{ marginBottom: 10 }}>
      <button
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'center', fontSize: 12, marginBottom: 8 }}
        onClick={onEditCode}
      >
        Edit Code
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Language
          </div>
          <select
            className="prop-input"
            style={{ padding: '4px 6px' }}
            value={element.language || 'plaintext'}
            onChange={(e) => onUpdate({ language: e.target.value })}
          >
            {CODE_LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
            Font Size
          </div>
          <input
            className="prop-input"
            type="number" min="8" max="32" step="1"
            value={element.fontSize || 14}
            onChange={(e) =>
              onUpdate({ fontSize: Math.max(8, Math.min(32, Number(e.target.value) || 14)) })
            }
          />
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
          Round Corners: {element.borderRadius || 0}px
        </div>
        <input
          type="range" min="0" max="50"
          value={element.borderRadius || 0}
          onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
