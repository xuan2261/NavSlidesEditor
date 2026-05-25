import { useState, useMemo } from 'react'
import {
  TEMPLATES,
  DEFAULT_CUSTOM,
  generateThreeJsHtml,
} from '../data/three-js-3d-scene-templates.js'

export default function ThreeJs3DSceneTemplateSelectorModal({ onInsert, onClose }) {
  const [selected, setSelected] = useState('rotating-cube')
  const [params, setParams] = useState({
    color: '#6366f1',
    background: '#0a0a14',
    transparent: false,
    speed: 1,
  })
  const [customCode, setCustomCode] = useState(DEFAULT_CUSTOM)
  const [previewKey, setPreviewKey] = useState(0)

  const isCustom = selected === 'custom'
  const update = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  const previewHtml = useMemo(
    () => (isCustom ? customCode : generateThreeJsHtml(selected, params)),
    [isCustom, selected, params, customCode]
  )

  const handleTextareaTab = (e) => {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const ta = e.target
    const start = ta.selectionStart
    const end = ta.selectionEnd
    setCustomCode((c) => c.substring(0, start) + '  ' + c.substring(end))
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + 2
    }, 0)
  }

  const handleEditAsCode = () => {
    setCustomCode(generateThreeJsHtml(selected, params))
    setSelected('custom')
    setPreviewKey((k) => k + 1)
  }

  const handleInsert = () => {
    onInsert(previewHtml)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl w-[820px] max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="font-semibold text-text-primary">Three.js 3D Scene</span>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary text-lg leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-44 border-r border-border overflow-y-auto p-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                title={t.desc}
                className={`w-full text-left px-3 py-2 rounded text-sm mb-1 cursor-pointer ${
                  selected === t.id
                    ? 'bg-accent text-white'
                    : 'hover:bg-hover text-text-primary'
                }`}
                onClick={() => setSelected(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 flex items-center justify-center bg-[#0a0a14] min-h-[260px]">
              <iframe
                key={previewKey}
                srcDoc={previewHtml}
                sandbox="allow-scripts"
                title="3D scene preview"
                className="w-[480px] h-[260px] border border-border rounded bg-black"
              />
            </div>

            <div className="p-3 border-t border-border overflow-y-auto">
              {isCustom ? (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] text-text-muted">
                      Custom Three.js code (ES module + importmap)
                    </div>
                    <button
                      onClick={() => setPreviewKey((k) => k + 1)}
                      className="px-2 py-0.5 text-[11px] bg-hover border border-border rounded text-text-primary hover:bg-card"
                    >
                      Refresh Preview
                    </button>
                  </div>
                  <textarea
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    onKeyDown={handleTextareaTab}
                    spellCheck={false}
                    className="w-full h-48 bg-card border border-border text-text-primary p-2 rounded text-xs font-mono"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Color</div>
                      <input
                        type="color"
                        value={params.color}
                        onChange={(e) => update('color', e.target.value)}
                        className="w-full h-7 border border-border rounded cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Background</div>
                      <input
                        type="color"
                        value={params.background}
                        onChange={(e) => update('background', e.target.value)}
                        disabled={params.transparent}
                        className="w-full h-7 border border-border rounded cursor-pointer disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <div className="text-[11px] text-text-muted mb-1">Speed</div>
                      <input
                        type="number"
                        min={0.1}
                        max={5}
                        step={0.1}
                        value={params.speed}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          update('speed', Number.isFinite(n) && n >= 0.1 && n <= 5 ? n : 1)
                        }}
                        className="w-full bg-card border border-border text-text-primary px-2 py-1 rounded text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-[11px] text-text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={params.transparent}
                        onChange={(e) => update('transparent', e.target.checked)}
                      />
                      Transparent
                    </label>
                    <button
                      onClick={handleEditAsCode}
                      title="Copy this template into the custom editor"
                      className="px-2 py-0.5 text-[11px] bg-hover border border-border rounded text-text-muted hover:text-text-primary"
                    >
                      Edit as code
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary px-4 py-1.5 text-sm">
            Cancel
          </button>
          <button onClick={handleInsert} className="btn btn-primary px-4 py-1.5 text-sm">
            Insert
          </button>
        </div>
      </div>
    </div>
  )
}
