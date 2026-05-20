// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky
// Template HTML strings ported from parallax-presentations
// (jbirky/parallax-presentations @ ce548c5, AGPL-3.0-or-later).
// Adapted into a NavSlides data module; UI shell rewritten locally.

export const FONTS = [
  "'Barlow', sans-serif",
  "'Inter', sans-serif",
  "'Roboto', sans-serif",
  "'Playfair Display', serif",
  "'Bebas Neue', sans-serif",
  "'JetBrains Mono', monospace",
  "'Space Mono', monospace",
  "'Source Sans 3', sans-serif",
  "'Merriweather', serif",
  "'Fira Code', monospace",
  "'Latin Modern Roman', serif",
  "'Comfortaa', sans-serif",
  "'Codystar', sans-serif",
]

export const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

export const TEMPLATES = [
  { id: 'typewriter', name: 'Typewriter', desc: 'Characters appear one at a time with a blinking cursor' },
  { id: 'word-reveal', name: 'Word Reveal', desc: 'Words fade and slide in one by one' },
  { id: 'revolve', name: 'Revolve', desc: '3D rotation around the Y-axis' },
  { id: 'wave', name: 'Wave', desc: 'Letters undulate in a sine wave' },
  { id: 'split-flap', name: 'Split-Flap', desc: 'Airport departure board flip effect' },
  { id: 'fade-cascade', name: 'Fade Cascade', desc: 'Letters fade in with cascading delay' },
  { id: 'circular', name: 'Circular', desc: 'Text arranged on a rotating circle' },
  { id: 'glitch', name: 'Glitch', desc: 'Digital glitch with color channel split' },
  { id: 'bounce', name: 'Bounce', desc: 'Letters drop in with spring physics' },
  { id: 'stagger-center', name: 'Stagger Center', desc: 'Letters spread out from center' },
  { id: 'custom', name: 'Custom Code', desc: 'Write your own kinetic text HTML/CSS/JS' },
]

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function textStyle(params) {
  const parts = []
  if (params.bold) parts.push('font-weight:' + Math.max(params.fontWeight || 700, 700))
  else if (params.fontWeight && params.fontWeight !== 400) parts.push('font-weight:' + params.fontWeight)
  if (params.italic) parts.push('font-style:italic')
  if (params.underline) parts.push('text-decoration:underline')
  return parts.join(';')
}

const FONTS_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@100;200;300;400;500;600;700;800;900&family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Roboto:wght@100;300;400;500;700;900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Bebas+Neue&family=JetBrains+Mono:wght@100;200;300;400;500;600;700;800&family=Space+Mono:wght@400;700&family=Source+Sans+3:wght@300;400;500;600;700;800;900&family=Merriweather:wght@300;400;700;900&family=Fira+Code:wght@300;400;500;600;700&family=Comfortaa:wght@300;400;500;600;700&family=Codystar:wght@300;400&display=swap');"

export function generateKineticHtml(templateId, params = {}) {
  if (templateId === 'custom') return params.customCode || ''

  const text = params.text || 'Hello World'
  const font = params.fontFamily || "'Barlow', sans-serif"
  const scale = 10
  const size = (params.fontSize || 48) * scale
  const col = params.color || '#ffffff'
  const dur = params.duration || 2
  const bg = params.background || 'transparent'
  const escaped = escapeHtml(text)
  const chars = [...text]
  const words = text.split(/\s+/)
  const ts = textStyle(params)
  const tsAttr = ts ? `;${ts}` : ''

  const base = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
${FONTS_IMPORT}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${scale * 100}%;height:${scale * 100}%;overflow:hidden;background:${bg};transform:scale(${1 / scale});transform-origin:0 0}
body{display:flex;align-items:center;justify-content:center;font-family:${font};color:${col}${tsAttr}}
</style>`

  switch (templateId) {
    case 'typewriter': {
      return `${base}
<style>
.tw{font-size:${size}px;white-space:nowrap;overflow:hidden;border-right:3px solid ${col};width:0;animation:tw-type ${dur}s steps(${chars.length}) forwards,tw-blink 0.6s step-end infinite}
@keyframes tw-type{to{width:${chars.length}ch}}
@keyframes tw-blink{50%{border-color:transparent}}
</style></head><body><div class="tw">${escaped}</div></body></html>`
    }

    case 'word-reveal': {
      const delay = dur / words.length
      const spans = words
        .map(
          (w, i) =>
            `<span style="display:inline-block;opacity:0;transform:translateY(20px);animation:wr-in 0.5s ease-out ${(i * delay).toFixed(2)}s forwards">${escapeHtml(w)}</span>`,
        )
        .join(' ')
      return `${base}
<style>
.wr{font-size:${size}px;text-align:center;max-width:90%;line-height:1.4}
.wr span{margin:0 0.15em}
@keyframes wr-in{to{opacity:1;transform:translateY(0)}}
</style></head><body><div class="wr">${spans}</div></body></html>`
    }

    case 'revolve': {
      return `${base}
<style>
.rv-wrap{perspective:800px;text-align:center}
.rv{font-size:${size}px;display:inline-block;transform-style:preserve-3d;opacity:0;transform:rotateY(-180deg);animation:rv-in ${dur}s cubic-bezier(0.23,1,0.32,1) 0.2s forwards,rv-drift ${dur * 4}s ease-in-out ${dur + 0.5}s infinite}
@keyframes rv-in{0%{opacity:0;transform:rotateY(-180deg)}30%{opacity:1}100%{opacity:1;transform:rotateY(0)}}
@keyframes rv-drift{0%,100%{transform:rotateY(0)}50%{transform:rotateY(10deg)}}
</style></head><body><div class="rv-wrap"><div class="rv">${escaped}</div></div></body></html>`
    }

    case 'wave': {
      const spans = chars
        .map((c, i) => {
          const d = (i * 0.08).toFixed(2)
          const ch = c === ' ' ? '&nbsp;' : escapeHtml(c)
          return `<span style="animation-delay:${d}s">${ch}</span>`
        })
        .join('')
      return `${base}
<style>
.wv{font-size:${size}px;white-space:nowrap}
.wv span{display:inline-block;animation:wv-bob ${dur}s ease-in-out infinite}
@keyframes wv-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-${Math.round(size * 0.4)}px)}}
</style></head><body><div class="wv">${spans}</div></body></html>`
    }

    case 'split-flap': {
      const spans = chars
        .map((c, i) => {
          const d = (i * (dur / chars.length)).toFixed(2)
          const ch = c === ' ' ? '&nbsp;' : escapeHtml(c)
          return `<span style="animation-delay:${d}s">${ch}</span>`
        })
        .join('')
      return `${base}
<style>
.sf{font-size:${size}px;display:flex;gap:2px;letter-spacing:0.05em}
.sf span{display:inline-block;background:rgba(255,255,255,0.08);padding:4px 6px;border-radius:3px;opacity:0;transform:rotateX(-90deg);transform-origin:top center;animation:sf-flip 0.4s ease-out forwards}
@keyframes sf-flip{to{opacity:1;transform:rotateX(0)}}
</style></head><body><div style="perspective:600px"><div class="sf">${spans}</div></div></body></html>`
    }

    case 'fade-cascade': {
      const spans = chars
        .map((c, i) => {
          const d = (i * (dur / chars.length)).toFixed(2)
          const ch = c === ' ' ? '&nbsp;' : escapeHtml(c)
          return `<span style="animation-delay:${d}s">${ch}</span>`
        })
        .join('')
      return `${base}
<style>
.fc{font-size:${size}px;white-space:nowrap}
.fc span{display:inline-block;opacity:0;filter:blur(8px);animation:fc-in 0.6s ease-out forwards}
@keyframes fc-in{to{opacity:1;filter:blur(0)}}
</style></head><body><div class="fc">${spans}</div></body></html>`
    }

    case 'circular': {
      const radius = Math.max(60, size * 1.5)
      const spans = chars
        .map((c, i) => {
          const angle = (i / chars.length) * 360
          const ch = c === ' ' ? '&nbsp;' : escapeHtml(c)
          return `<span style="position:absolute;left:50%;top:50%;transform:rotate(${angle}deg) translateY(-${radius}px);transform-origin:0 ${radius}px;font-size:${size * 0.4}px">${ch}</span>`
        })
        .join('')
      return `${base}
<style>
.ci{position:relative;width:${radius * 2 + size}px;height:${radius * 2 + size}px;animation:ci-spin ${dur * 3}s linear infinite}
@keyframes ci-spin{to{transform:rotate(360deg)}}
.ci span{display:inline-block;white-space:nowrap}
</style></head><body><div class="ci">${spans}</div></body></html>`
    }

    case 'glitch': {
      const safeAttr = escaped.replace(/'/g, "\\'")
      return `${base}
<style>
.gl{font-size:${size}px;position:relative;white-space:nowrap}
.gl::before,.gl::after{content:'${safeAttr}';position:absolute;left:0;top:0;width:100%;overflow:hidden}
.gl::before{color:#0ff;animation:gl-r ${dur * 0.5}s infinite linear alternate-reverse;clip-path:inset(0 0 60% 0)}
.gl::after{color:#f0f;animation:gl-b ${dur * 0.4}s infinite linear alternate-reverse;clip-path:inset(60% 0 0 0)}
@keyframes gl-r{0%{transform:translate(0)}20%{transform:translate(-3px,2px)}40%{transform:translate(3px,-1px)}60%{transform:translate(-2px,1px)}80%{transform:translate(2px,-2px)}100%{transform:translate(0)}}
@keyframes gl-b{0%{transform:translate(0)}25%{transform:translate(2px,-2px)}50%{transform:translate(-3px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0)}}
</style></head><body><div class="gl">${escaped}</div></body></html>`
    }

    case 'bounce': {
      const spans = chars
        .map((c, i) => {
          const d = (i * (dur / chars.length)).toFixed(2)
          const ch = c === ' ' ? '&nbsp;' : escapeHtml(c)
          return `<span style="animation-delay:${d}s">${ch}</span>`
        })
        .join('')
      return `${base}
<style>
.bn{font-size:${size}px;white-space:nowrap}
.bn span{display:inline-block;opacity:0;transform:translateY(-80px);animation:bn-drop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards}
@keyframes bn-drop{to{opacity:1;transform:translateY(0)}}
</style></head><body><div class="bn">${spans}</div></body></html>`
    }

    case 'stagger-center': {
      const mid = chars.length / 2
      const spans = chars
        .map((c, i) => {
          const d = (Math.abs(i - mid) * (dur / chars.length)).toFixed(2)
          const ch = c === ' ' ? '&nbsp;' : escapeHtml(c)
          return `<span style="animation-delay:${d}s">${ch}</span>`
        })
        .join('')
      return `${base}
<style>
.sc{font-size:${size}px;white-space:nowrap}
.sc span{display:inline-block;opacity:0;transform:scale(0) rotate(20deg);animation:sc-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
@keyframes sc-pop{to{opacity:1;transform:scale(1) rotate(0)}}
</style></head><body><div class="sc">${spans}</div></body></html>`
    }

    default:
      return `${base}</head><body><div style="font-size:${size}px">${escaped}</div></body></html>`
  }
}

export const DEFAULT_CUSTOM = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
body { display: flex; align-items: center; justify-content: center; font-family: 'Barlow', sans-serif; color: #ffffff; }

.text {
  font-size: 48px;
  font-weight: 700;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.05); }
}
</style>
</head>
<body>
  <div class="text">Your Text Here</div>
</body>
</html>`
