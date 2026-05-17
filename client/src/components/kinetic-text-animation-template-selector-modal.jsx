import { useState } from 'react'

const TEMPLATES = [
  { id: 'typewriter', name: 'Typewriter' },
  { id: 'word-reveal', name: 'Word Reveal' },
  { id: 'revolve', name: 'Revolve' },
  { id: 'wave', name: 'Wave' },
  { id: 'split-flap', name: 'Split-Flap' },
  { id: 'fade-cascade', name: 'Fade Cascade' },
  { id: 'circular', name: 'Circular' },
  { id: 'glitch', name: 'Glitch' },
  { id: 'bounce', name: 'Bounce' },
  { id: 'stagger-center', name: 'Stagger Center' },
  { id: 'custom', name: 'Custom Code' },
]

function escapeCssValue(v) {
  return String(v).replace(/['"\\;{}()]/g, '')
}

function generateHTML(id, p) {
  if (id === 'custom') return p.customCode || ''
  const font = escapeCssValue(p.fontFamily || "'Barlow', sans-serif")
  const size = (p.fontSize || 48) * 10
  const col = p.color || '#fff'
  const dur = p.duration || 2
  const bg = p.background || 'transparent'
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const chars = [...(p.text || 'Hello')]
  const words = (p.text || 'Hello').split(/\s+/)
  const base = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@100..900&family=Inter:wght@100..900&display=swap');*{margin:0;padding:0;box-sizing:border-box}html,body{width:1000%;height:1000%;overflow:hidden;background:${bg};transform:scale(.1);transform-origin:0 0}body{display:flex;align-items:center;justify-content:center;font-family:${font};color:${col}}</style>`

  const templates = {
    typewriter: `${base}<style>.tw{font-size:${size}px;white-space:nowrap;overflow:hidden;border-right:3px solid ${col};width:0;animation:tw ${dur}s steps(${chars.length}) forwards,bl .6s step-end infinite}@keyframes tw{to{width:${chars.length}ch}}@keyframes bl{50%{border-color:transparent}}</style></head><body><div class="tw">${esc(p.text || 'Hello')}</div></body></html>`,

    'word-reveal': `${base}<style>.wr{font-size:${size}px;text-align:center;line-height:1.4}.wr span{display:inline-block;opacity:0;transform:translateY(20px);animation:wi .5s ease-out forwards;margin:0 .15em}@keyframes wi{to{opacity:1;transform:translateY(0)}}</style></head><body><div class="wr">${words.map((w, i) => `<span style="animation-delay:${(i * dur / words.length).toFixed(2)}s">${esc(w)}</span>`).join(' ')}</div></body></html>`,

    revolve: `${base}<style>.rv{font-size:${size}px;white-space:nowrap;animation:rv ${dur}s ease-in-out infinite;transform-style:preserve-3d}@keyframes rv{0%,100%{transform:rotateY(0)}50%{transform:rotateY(360deg)}}</style></head><body><div class="rv">${esc(p.text || 'Hello')}</div></body></html>`,

    wave: `${base}<style>.wv{font-size:${size}px;white-space:nowrap}.wv span{display:inline-block;animation:wv ${dur}s ease-in-out infinite}@keyframes wv{0%,100%{transform:translateY(0)}50%{transform:translateY(-${size / 3}px)}}</style></head><body><div class="wv">${chars.map((c, i) => `<span style="animation-delay:${(i * 0.05).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div></body></html>`,

    'split-flap': `${base}<style>.sf{font-size:${size}px;white-space:nowrap;letter-spacing:.04em}.sf span{display:inline-block;background:rgba(255,255,255,.08);padding:.05em .1em;margin:.02em;transform-origin:top;animation:sf ${dur}s ease-out infinite}@keyframes sf{0%{transform:rotateX(90deg);filter:brightness(.4)}35%,100%{transform:rotateX(0);filter:brightness(1)}}</style></head><body><div class="sf">${chars.map((c, i) => `<span style="animation-delay:${(i * 0.04).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div></body></html>`,

    'fade-cascade': `${base}<style>.fc{font-size:${size}px;white-space:nowrap}.fc span{display:inline-block;opacity:0;animation:fi ${dur * 0.5}s ease-out forwards}@keyframes fi{to{opacity:1}}</style></head><body><div class="fc">${chars.map((c, i) => `<span style="animation-delay:${(i * dur / chars.length / 2).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div></body></html>`,

    circular: `${base}<style>.ci{position:relative;width:${size * 4}px;height:${size * 4}px;animation:ci ${dur * 2}s linear infinite}.ci span{position:absolute;left:50%;top:50%;font-size:${size * 0.35}px;transform-origin:0 ${size * -1.7}px}@keyframes ci{to{transform:rotate(360deg)}}</style></head><body><div class="ci">${chars.map((c, i) => `<span style="transform:rotate(${i * 360 / Math.max(chars.length, 1)}deg)">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div></body></html>`,

    glitch: `${base}<style>.gl{font-size:${size}px;position:relative;white-space:nowrap}.gl::before,.gl::after{content:attr(data-text);position:absolute;top:0;left:0;width:100%;height:100%}.gl::before{color:#f0f;animation:gl1 .3s infinite;clip-path:polygon(0 0,100% 0,100% 45%,0 45%)}.gl::after{color:#0ff;animation:gl2 .3s infinite;clip-path:polygon(0 55%,100% 55%,100% 100%,0 100%)}@keyframes gl1{0%,100%{transform:translate(0)}20%{transform:translate(-3px,3px)}40%{transform:translate(3px,-3px)}60%{transform:translate(-2px,1px)}80%{transform:translate(2px,-1px)}}@keyframes gl2{0%,100%{transform:translate(0)}20%{transform:translate(3px,-3px)}40%{transform:translate(-3px,3px)}60%{transform:translate(2px,-1px)}80%{transform:translate(-2px,1px)}}</style></head><body><div class="gl" data-text="${esc(p.text || 'Hello')}">${esc(p.text || 'Hello')}</div></body></html>`,

    bounce: `${base}<style>.bn{font-size:${size}px;white-space:nowrap}.bn span{display:inline-block;opacity:0;transform:translateY(-100px);animation:bn .6s cubic-bezier(.34,1.56,.64,1) forwards}@keyframes bn{to{opacity:1;transform:translateY(0)}}</style></head><body><div class="bn">${chars.map((c, i) => `<span style="animation-delay:${(i * 0.06).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div></body></html>`,

    'stagger-center': `${base}<style>.sc{font-size:${size}px;white-space:nowrap}.sc span{display:inline-block;opacity:0;transform:scale(.2);animation:sc .55s ease-out forwards}@keyframes sc{to{opacity:1;transform:scale(1)}}</style></head><body><div class="sc">${chars.map((c, i) => `<span style="animation-delay:${(Math.abs(i - chars.length / 2) * 0.05).toFixed(2)}s">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div></body></html>`,
  }
  return templates[id] || templates.typewriter
}

export default function KineticTextAnimationTemplateSelectorModal({ onInsert, onClose }) {
  const [template, setTemplate] = useState('typewriter')
  const [params, setParams] = useState({
    text: 'Hello World',
    fontFamily: "'Barlow', sans-serif",
    fontSize: 48,
    color: '#ffffff',
    duration: 2,
    background: 'transparent',
    customCode: '',
  })

  const update = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  const isCustom = template === 'custom'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-border font-semibold text-text-primary">Kinetic Text</div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-border overflow-y-auto p-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                className={`w-full text-left px-3 py-2 rounded text-sm mb-1 cursor-pointer ${template === t.id ? 'bg-accent text-white' : 'hover:bg-hover text-text-primary'}`}
                onClick={() => setTemplate(t.id)}
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {isCustom ? (
              <textarea
                className="w-full h-48 bg-card border border-border text-text-primary p-2 rounded text-xs font-mono"
                value={params.customCode}
                onChange={(e) => update('customCode', e.target.value)}
                placeholder="<!DOCTYPE html>..."
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[11px] text-text-muted mb-1">Text</div>
                  <input className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.text} onChange={(e) => update('text', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Font Size</div>
                    <input type="number" min={12} max={120} className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.fontSize} onChange={(e) => update('fontSize', +e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Duration (s)</div>
                    <input type="number" min={0.5} max={10} step={0.5} className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs" value={params.duration} onChange={(e) => update('duration', +e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Text Color</div>
                    <input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.color} onChange={(e) => update('color', e.target.value)} />
                  </div>
                  <div>
                    <div className="text-[11px] text-text-muted mb-1">Background</div>
                    <input type="color" className="w-full h-7 border border-border rounded cursor-pointer" value={params.background === 'transparent' ? '#000000' : params.background} onChange={(e) => update('background', e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button className="btn btn-secondary px-4 py-1.5 text-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary px-4 py-1.5 text-sm" onClick={() => { onInsert(generateHTML(template, params)); onClose() }}>Insert</button>
        </div>
      </div>
    </div>
  )
}
