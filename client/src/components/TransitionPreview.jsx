import { useState, useRef } from 'react'
import { X, RotateCcw } from 'lucide-react'
import { Button } from '../components/ui'

const TRANSITIONS = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom']

export default function TransitionPreview({ presentation, fromIndex, onClose }) {
  const [transition, setTransition] = useState(presentation.transition || 'slide')
  const [key, setKey] = useState(0)
  const iframeRef = useRef(null)

  const toIndex = Math.min(fromIndex + 1, (presentation.slides || []).length - 1)
  if (fromIndex === toIndex) return null // only one slide

  const slide1 = presentation.slides[fromIndex]
  const slide2 = presentation.slides[toIndex]

  function getBgAttrs(bg) {
    if (!bg) return ''
    if (bg.type === 'color' && bg.color) return ` data-background-color="${bg.color}"`
    if (bg.type === 'gradient' && bg.gradient) return ` data-background-gradient="${bg.gradient}"`
    return ''
  }

  function renderElements(elements) {
    return (elements || [])
      .map((el) => {
        const style = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;`
        if (el.type === 'text')
          return `<div style="${style}padding:8px 12px;color:white;">${el.content || ''}</div>`
        if (el.type === 'shape')
          return `<div style="${style}background:${el.fill || '#6366f1'};border-radius:${el.shape === 'circle' ? '50%' : '0'};"></div>`
        return `<div style="${style}background:rgba(99,102,241,0.2);"></div>`
      })
      .join('\n')
  }

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reset.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/${presentation.theme || 'black'}.css">
<style>
  html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;background:#000;}
  .reveal .slides section{padding:0!important;text-align:left!important;font-family:-apple-system,sans-serif;}
  .reveal .slides section *{text-transform:none!important;letter-spacing:normal!important;}
  .reveal .slides section h1{font-size:2.5em;font-weight:bold;line-height:1.2;margin:0 0 .4em;}
  .reveal .slides section h2{font-size:1.6em;font-weight:bold;line-height:1.2;margin:0 0 .4em;}
  .reveal .slides section p{margin:0 0 .4em;line-height:1.5;}
</style>
</head>
<body>
<div class="reveal">
<div class="slides">
  <section${getBgAttrs(slide1.background)} style="padding:0;width:960px;height:540px;overflow:hidden;font-size:42px;">${renderElements(slide1.elements)}</section>
  <section${getBgAttrs(slide2.background)} style="padding:0;width:960px;height:540px;overflow:hidden;font-size:42px;">${renderElements(slide2.elements)}</section>
</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
<script>
Reveal.initialize({
  hash:false,width:960,height:540,margin:0,minScale:0,maxScale:10,center:false,
  transition:'${transition}',controls:false,progress:false,
  keyboard:true,overview:false
});
setTimeout(()=>Reveal.next(),800);
</script>
</body>
</html>`

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/60 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card rounded-xl border border-border shadow-2xl w-[620px] max-w-[90vw] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <span className="font-semibold text-sm">Transition Preview</span>
          <span className="text-xs text-text-muted">
            Slide {fromIndex + 1} → {toIndex + 1}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <select
              value={transition}
              onChange={(e) => {
                setTransition(e.target.value)
                setKey((k) => k + 1)
              }}
              className="bg-hover border border-border text-text-primary px-2 py-1 rounded text-xs cursor-pointer"
            >
              {TRANSITIONS.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <Button variant="icon" onClick={() => setKey((k) => k + 1)} title="Replay">
              <RotateCcw size={14} />
            </Button>
            <Button variant="icon" onClick={onClose} title="Close">
              <X size={16} />
            </Button>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center bg-black/30 overflow-hidden h-[360px]">
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={html}
            style={{
              width: 960,
              height: 540,
              border: 'none',
              transform: 'scale(0.6)',
              transformOrigin: 'top left',
            }}
            title="Transition Preview"
          />
        </div>
      </div>
    </div>
  )
}
