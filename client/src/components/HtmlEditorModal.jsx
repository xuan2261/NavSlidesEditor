
export default function HtmlEditorModal({ state, onChange, onApply, onCancel }) {
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
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>HTML / D3 Embed</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            D3, plain HTML, or any JavaScript — renders in an iframe
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
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
            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
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
