import { Button } from '../components/ui'

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

export default function CodeEditorModal({
  state,
  onChange,
  onApply,
  onCancel,
  codeTheme,
  onChangeTheme,
}) {
  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel()
      }}
    >
      <div className="bg-card border border-border rounded-xl w-[78vw] max-w-[960px] h-[78vh] flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-border flex justify-between items-center shrink-0 gap-3">
          <span className="font-semibold text-sm">Code Block</span>
          <select
            value={state.language}
            onChange={(e) => onChange({ ...state, language: e.target.value })}
            className="bg-hover border border-border text-[#e0e0e0] px-2 py-1 rounded-md text-xs cursor-pointer focus:outline-none focus:border-accent transition-colors"
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
            className="bg-hover border border-border text-[#e0e0e0] px-2 py-1 rounded-md text-xs cursor-pointer focus:outline-none focus:border-accent transition-colors"
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
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" className="text-xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" className="text-xs" onClick={onApply}>
              Apply
            </Button>
          </div>
        </div>
        <textarea
          value={state.content}
          onChange={(e) => onChange({ ...state, content: e.target.value })}
          className="flex-1 bg-[#0d0d1a] text-[#e2e8f0] font-mono text-[13px] p-4 md:p-5 border-none outline-none resize-none rounded-b-xl leading-relaxed"
          style={{ tabSize: 2 }}
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
