const LANGUAGES = [
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

export default function CodeEditorModal({ state, onChange, onApply, onCancel, codeTheme, onChangeTheme }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          width: '78vw',
          maxWidth: 960,
          height: '78vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
            gap: 12,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Code Block</span>
          <select
            value={state.language}
            onChange={(e) => onChange({ ...state, language: e.target.value })}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              color: '#e0e0e0',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
          <select
            value={codeTheme || 'monokai'}
            onChange={(e) => onChangeTheme(e.target.value)}
            style={{
              background: 'var(--bg-hover)',
              border: '1px solid var(--border)',
              color: '#e0e0e0',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              cursor: 'pointer',
            }}
            title="Code highlight theme"
          >
            <optgroup label="Dark">
              <option value="monokai">Monokai</option>
              <option value="github-dark">GitHub Dark</option>
              <option value="atom-one-dark">Atom One Dark</option>
              <option value="tokyo-night-dark">Tokyo Night</option>
              <option value="vs2015">VS Code Dark</option>
              <option value="night-owl">Night Owl</option>
              <option value="an-old-hope">An Old Hope</option>
            </optgroup>
            <optgroup label="Light">
              <option value="atom-one-light">Atom One Light</option>
              <option value="github">GitHub Light</option>
              <option value="vs">Visual Studio</option>
            </optgroup>
          </select>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              className="btn btn-secondary"
              style={{ fontSize: 12 }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12 }}
              onClick={onApply}
            >
              Apply
            </button>
          </div>
        </div>
        <textarea
          value={state.content}
          onChange={(e) => onChange({ ...state, content: e.target.value })}
          style={{
            flex: 1,
            background: '#0d0d1a',
            color: '#e2e8f0',
            fontFamily: "'Fira Code','JetBrains Mono',monospace",
            fontSize: 13,
            padding: '16px 20px',
            border: 'none',
            outline: 'none',
            resize: 'none',
            borderRadius: '0 0 12px 12px',
            lineHeight: 1.6,
            tabSize: 2,
          }}
          spellCheck={false}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const { selectionStart: s, selectionEnd: end, value } = e.target
              const next = value.substring(0, s) + '  ' + value.substring(end)
              e.target.value = next
              onChange({ ...state, content: next })
              requestAnimationFrame(() => {
                e.target.selectionStart = e.target.selectionEnd = s + 2
              })
            }
          }}
        />
      </div>
    </div>
  )
}
