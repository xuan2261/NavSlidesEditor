import { useState } from 'react'
import { TEMPLATES, generateAnimeHtml } from '../data/anime-js-animation-templates'

export default function AnimeJsAnimationTemplateSelectorModal({ onInsert, onClose }) {
  const [template, setTemplate] = useState('scatter-dots')
  const [params, setParams] = useState({
    color: '#6366f1',
    color2: '#f59e0b',
    background: '#0f0f23',
    duration: 2,
    count: 20,
    size: 10,
    customCode: '',
  })

  const update = (k, v) => setParams((p) => ({ ...p, [k]: v }))

  const handleInsert = () => {
    const html = generateAnimeHtml(template, {
      color: params.color,
      color2: params.color2,
      bg: params.background,
      duration: params.duration,
      count: params.count,
      size: params.size,
      customCode: params.customCode,
    })
    onInsert(html)
    onClose()
  }

  const selected = TEMPLATES.find((t) => t.id === template)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[600px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border font-semibold text-text-primary">Anime.js Animation</div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-44 border-r border-border overflow-y-auto p-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className={`w-full text-left px-3 py-2 rounded text-sm mb-1 cursor-pointer ${template === t.id ? 'bg-accent text-white' : 'hover:bg-hover text-text-primary'}`}
                onClick={() => setTemplate(t.id)}
                title={t.desc}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {selected?.desc && template !== 'custom' && (
              <div className="text-[11px] text-text-muted mb-3">{selected.desc}</div>
            )}
            {template === 'custom' ? (
              <textarea
                className="w-full h-48 bg-card border border-border text-text-primary p-2 rounded text-xs font-mono"
                value={params.customCode}
                onChange={(e) => update('customCode', e.target.value)}
                placeholder="<!DOCTYPE html>..."
              />
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Color</div>
                    <input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.color} onChange={(e) => update('color', e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Color 2</div>
                    <input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.color2} onChange={(e) => update('color2', e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Background</div>
                    <input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.background} onChange={(e) => update('background', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Duration (s)</div>
                    <input type="number" min={0.5} max={10} step={0.5} className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.duration} onChange={(e) => update('duration', +e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Count</div>
                    <input type="number" min={1} max={100} step={1} className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.count} onChange={(e) => update('count', +e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Size</div>
                    <input type="number" min={2} max={60} step={1} className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.size} onChange={(e) => update('size', +e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button className="btn btn-secondary px-4 py-1.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary px-4 py-1.5 text-sm" onClick={handleInsert}>Insert</button>
        </div>
      </div>
    </div>
  )
}
