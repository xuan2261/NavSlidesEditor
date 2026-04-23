import { Button } from '../components/ui'
import { isBackdropClick, useEscapeClose } from '../lib/utils'

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
  useEscapeClose(onCancel)

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/75 flex items-center justify-center"
      onClick={(event) => {
        if (isBackdropClick(event)) onCancel()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="latex-editor-modal-title"
    >
      <div
        className="bg-card border border-border rounded-xl w-[78vw] max-w-[960px] h-[78vh] flex flex-col shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex justify-between items-center shrink-0 gap-3">
          <h2 id="latex-editor-modal-title" className="font-semibold text-sm">LaTeX / TikZ</h2>
          <span className="text-xs text-text-muted">
            Supports KaTeX math and TikZ diagrams (via TikZJax)
          </span>
          <div className="flex gap-2 ml-auto">
            <Button variant="secondary" className="text-xs" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" className="text-xs" onClick={onApply}>
              Apply
            </Button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <textarea
            value={state.content}
            onChange={(e) => onChange({ ...state, content: e.target.value })}
            className="flex-1 bg-[#0d0d1a] text-[#e2e8f0] font-mono text-[13px] p-4 md:p-5 border-none outline-none resize-none leading-relaxed border-r border-border rounded-bl-xl"
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
          <div className="flex-1 bg-[#1a1a2e] flex items-center justify-center overflow-auto p-4 rounded-br-xl">
            <iframe
              key={state.content}
              srcDoc={previewSrcDoc}
              className="w-full h-full border-none bg-transparent"
              sandbox="allow-scripts"
              title="LaTeX Preview"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
