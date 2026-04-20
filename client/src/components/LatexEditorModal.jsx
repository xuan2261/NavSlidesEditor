export default function LatexEditorModal({ state, onChange, onApply, onCancel }) {
  const content = state.content || ''
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)
  const tikzScript = hasTikz
    ? `<link rel="stylesheet" type="text/css" href="https://tikzjax.com/v1/fonts.css"><script src="https://tikzjax.com/v1/tikzjax.js"><\/script>`
    : ''
  let bodyContent
  if (hasTikz) {
    bodyContent = `<script type="text/tikz">${content}<\/script>`
  } else {
    bodyContent = `<div id="math"></div><script>try{katex.render(${JSON.stringify(content)},document.getElementById('math'),{displayMode:true,throwOnError:false})}catch(e){document.getElementById('math').textContent=e.message}<\/script>`
  }
  const previewSrcDoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"><script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"><\/script>${tikzScript}<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:white}.katex{font-size:1.6em}svg{max-width:100%;max-height:100%}</style></head><body>${bodyContent}</body></html>`

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
          <span style={{ fontWeight: 600, fontSize: 14 }}>LaTeX / TikZ</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Supports KaTeX math and TikZ diagrams (via TikZJax)
          </span>
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
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
              lineHeight: 1.6,
              tabSize: 2,
              borderRight: '1px solid var(--border)',
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
          <div
            style={{
              flex: 1,
              background: '#1a1a2e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'auto',
              padding: 16,
            }}
          >
            <iframe
              key={state.content}
              srcDoc={previewSrcDoc}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'transparent',
              }}
              sandbox="allow-scripts"
              title="LaTeX Preview"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
