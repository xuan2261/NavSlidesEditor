/**
 * Shared element rendering functions used by both generateRevealHTML and generatePrintHTML.
 * Eliminates ~300 lines of duplicated rendering logic.
 */
const { shapeSvgString } = require('./shapeUtils.js')
const { sanitizeRichTextHtml, sanitizeSvgHtml, sanitizeHref } = require('./content-safety.js')
const iconPathsData = require('../data/icon-paths.json')
const ICON_PATHS = iconPathsData

function absoluteSrc(src) {
  if (!src) return src
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) return src
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`
  }
  return src
}

function getMediaFragmentSrc(src, startTime, endTime) {
  if (!src) return src
  const start = Number(startTime)
  const end = Number(endTime)
  const hasStart = Number.isFinite(start) && start > 0
  const hasEnd = Number.isFinite(end) && end > 0
  if (!hasStart && !hasEnd) return src
  const rangeStart = hasStart ? start : 0
  const rangeEnd = hasEnd && end > rangeStart ? `,${end}` : ''
  return `${String(src).split('#')[0]}#t=${rangeStart}${rangeEnd}`
}

function getPlaybackRate(value) {
  const rate = Number(value)
  return Number.isFinite(rate) && rate > 0 ? rate : null
}

function getAssetOrigin() {
  if (typeof window !== 'undefined' && window.location && window.location.origin !== 'null') {
    return window.location.origin
  }
  return ''
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeSrcdoc(html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function toHtmlDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

/** Build the shared base positioning style for an element */
// eslint-disable-next-line unused-imports/no-unused-vars
function buildBaseStyle(el, opts = {}) {
  const shadowStyle =
    el.shadowBlur || el.shadowX || el.shadowY
      ? `box-shadow:${el.shadowX || 0}px ${el.shadowY || 0}px ${el.shadowBlur || 0}px ${el.shadowColor || 'rgba(0,0,0,0.5)'};`
      : ''
  const borderRadiusStyle =
    (el.type === 'image' || el.type === 'code') && el.borderRadius
      ? `border-radius:${el.borderRadius}px;`
      : ''
  const rotationStyle = el.rotation ? `transform:rotate(${el.rotation}deg);` : ''
  return `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}${borderRadiusStyle}${rotationStyle}`
}

/** Build wrapper attributes for reveal.js (fragment + data-id) */
function buildWrapperAttrs(el, slide) {
  const dataIdAttr = slide && slide.autoAnimate ? ` data-id="${el.id}"` : ''
  const fragClass = el.fragment ? ` class="fragment ${el.fragmentAnimation || 'fade-in'}"` : ''
  const fragIdx =
    el.fragment && el.fragmentIndex != null ? ` data-fragment-index="${el.fragmentIndex}"` : ''
  return { dataIdAttr, fragClass, fragIdx }
}

// ─── Per-type renderers ──────────────────────────────────────────────────────

function renderText(el, style, wrap, vis) {
  const tc = el.textColor ? `;color:${el.textColor}` : ''
  const ff = el.fontFamily ? `;font-family:${el.fontFamily}` : ''
  const fs = el.fontSize ? `;font-size:calc(${el.fontSize}px * var(--font-zoom, 1))` : ''
  return `<div${wrap} style="${style}${vis}padding:8px 12px;color:white${tc}${ff}${fs}">${sanitizeRichTextHtml(el.content || '')}</div>`
}

function buildCitationHtml(el) {
  const text = el.citationText || el.citationLink
  if (!text) return ''
  const color = el.citationColor || 'rgba(255,255,255,0.5)'
  const align = el.citationAlign || 'left'
  const citeStyle = `position:absolute;left:0;right:0;top:100%;font-size:10px;color:${color};line-height:1.3;padding:3px 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;text-align:${align};`
  if (el.citationLink) {
    const href = sanitizeHref(el.citationLink)
    const display = escapeHtml(text)
    return `<a href="${href}" target="_blank" rel="noopener" style="${citeStyle}text-decoration:none;cursor:pointer;">${display}</a>`
  }
  return `<div style="${citeStyle}">${escapeHtml(text)}</div>`
}

function renderImage(el, style, wrap, vis, opts) {
  const src = absoluteSrc(el.src)
  const imgFilterParts = [
    el.filterBrightness != null && el.filterBrightness !== 100
      ? `brightness(${el.filterBrightness}%)`
      : '',
    el.filterContrast != null && el.filterContrast !== 100 ? `contrast(${el.filterContrast}%)` : '',
    el.filterGrayscale ? `grayscale(${el.filterGrayscale}%)` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const filterStyle = imgFilterParts ? `filter:${imgFilterParts};` : ''
  const imgReset = opts.forPrint ? 'max-width:none;max-height:none;' : ''
  const citationHtml = buildCitationHtml(el)
  if (el.imageW != null) {
    const offX = el.imageOffsetX ?? 0
    const offY = el.imageOffsetY ?? 0
    const imgStyle = `position:absolute;left:${offX}px;top:${offY}px;width:${el.imageW}px;height:${el.imageH}px;object-fit:${el.objectFit || 'contain'};${filterStyle}${imgReset}`
    return `<div${wrap} style="${style}${vis}overflow:visible;"><img src="${src}" alt="${el.alt || ''}" style="${imgStyle}" />${citationHtml}</div>`
  }
  return `<div${wrap} style="${style}${vis}overflow:visible;"><img src="${src}" alt="${el.alt || ''}" style="display:block;width:100%;height:100%;object-fit:${el.objectFit || 'contain'};${filterStyle}${imgReset}" />${citationHtml}</div>`
}

function renderShape(el, style, wrap, vis) {
  const opacityStyle = el.opacity !== undefined && el.opacity !== 1 ? `opacity:${el.opacity};` : ''
  return `<div${wrap} style="${style}${opacityStyle}${vis}">${shapeSvgString(el)}</div>`
}

function renderCode(el, style, wrap, vis) {
  const lang = el.language || 'plaintext'
  const codeContent = escapeHtml(el.content || '')
  const cls = vis ? ' class="hljs"' : ''
  return `<div${wrap} style="${style}${vis}"><pre${cls} style="margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:calc(${el.fontSize || 14}px * var(--font-zoom, 1));line-height:1.5;"><code class="language-${lang}" data-trim>${codeContent}</code></pre></div>`
}

function renderHtml(el, style, wrap, vis, opts) {
  const content = el.content || ''

  // PDF mode: use data-pdf-iframe with blob URL initialization.
  // Iframes with srcdoc break Chrome's CSS paged media engine layout, causing
  // slides to merge into one scrolling page. Instead, we emit an empty iframe
  // and inject a script at the end of the print HTML to convert data-pdf-iframe
  // into a Blob URL at runtime, avoiding the layout breakage while keeping interactivity.
  if (opts.forPrint) {
    const wrappedContent = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style></head><body>${content}</body></html>`
    return `<iframe${wrap} data-pdf-iframe="${encodeURIComponent(wrappedContent)}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
  }

  // Normal (present) mode: use iframe + data URL to isolate CSS/JS without
  // relying on srcdoc, which has inconsistent export behavior in reveal views.
  // Wrapped in a div so reveal.js fragment animations work correctly.
  const _origin = getAssetOrigin()
  const base = _origin ? `<base href="${_origin}/">` : ''
  const wrappedContent = `<!doctype html><html><head><meta charset="utf-8">${base}<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style></head><body>${content}</body></html>`
  return `<div${wrap} style="${style}${vis}"><iframe src="${toHtmlDataUrl(wrappedContent)}" style="width:100%;height:100%;border:none;background:transparent;" scrolling="no"></iframe></div>`
}

function renderMarkdown(el, style, wrap, vis, opts) {
  if (opts.forPrint) {
    return `<div style="${style}${vis}padding:8px 12px;color:white;overflow:auto;font-size:calc(16px * var(--font-zoom, 1));line-height:1.5;">${escapeHtml(el.content || '')}</div>`
  }
  const _origin = getAssetOrigin()
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><script src="${_origin}/vendor/marked/marked.min.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:white;font-family:-apple-system,sans-serif;font-size:calc(18px * var(--font-zoom, 1));line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out"></div><script>function __safeHref(v){v=String(v||'').trim();if(!v)return '#';if(v[0]==='#'||v[0]==='/'||v.startsWith('./')||v.startsWith('../'))return v;if(/^(https?:|mailto:)/i.test(v))return v;return '#'}function __sanitize(html){return String(html||'').replace(/<script[\\s\\S]*?<\\/script>/gi,'').replace(/\\son[a-z-]+\\s*=\\s*(['"]).*?\\1/gi,'').replace(/\\s(href|src)\\s*=\\s*(['"])(.*?)\\2/gi,function(_,a,q,v){return ' '+a+'='+q+__safeHref(v)+q})}document.getElementById('out').innerHTML=__sanitize(marked.parse(${JSON.stringify(el.content || '')}));</script></body></html>`
  return `<iframe${wrap} srcdoc="${escapeSrcdoc(srcdoc)}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
}

function renderChart(el, style, wrap, vis, opts) {
  const { chartType = 'bar', chartData = {} } = el
  const datasetsArr = (chartData.datasets || []).map((ds) => ({
    label: ds.label || '',
    data: ds.data || [],
    backgroundColor: ds.color || '#6366f1',
    borderColor: ds.color || '#6366f1',
    borderWidth: chartType === 'line' ? 2 : 0,
    fill: chartType === 'line' ? false : undefined,
  }))
  const scalesOpt =
    chartType === 'pie' || chartType === 'doughnut'
      ? '{}'
      : `{x:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}},y:{ticks:{color:'rgba(255,255,255,0.6)'},grid:{color:'rgba(255,255,255,0.1)'}}}`

  if (opts.forPrint) {
    const canvasId = `chart-${el.id || Math.random().toString(36).slice(2, 8)}`
    const chartConfig = JSON.stringify({
      type: chartType,
      data: { labels: chartData.labels || [], datasets: datasetsArr },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } } } },
        scales:
          chartType === 'pie' || chartType === 'doughnut'
            ? {}
            : {
                x: {
                  ticks: { color: 'rgba(255,255,255,0.6)' },
                  grid: { color: 'rgba(255,255,255,0.1)' },
                },
                y: {
                  ticks: { color: 'rgba(255,255,255,0.6)' },
                  grid: { color: 'rgba(255,255,255,0.1)' },
                },
              },
      },
    }).replace(/</g, '\\u003c')
    return `<div style="${style}${vis}"><canvas id="${canvasId}" data-chart-config='${chartConfig}' style="width:100%;height:100%;"></canvas></div>`
  }

  const labels = JSON.stringify(chartData.labels || [])
  const datasets = JSON.stringify(datasetsArr)
  const _origin = getAssetOrigin()
  const chartSrc = `<!doctype html><html><head><meta charset="utf-8"><script src="${_origin}/vendor/chart.js/dist/chart.umd.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style></head><body><canvas id="c" style="width:100%;height:100%"></canvas><script>new Chart(document.getElementById('c'),{type:'${chartType}',data:{labels:${labels},datasets:${datasets}},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'rgba(255,255,255,0.7)',font:{size:12}}}},scales:${scalesOpt}}});</script></body></html>`
  return `<iframe${wrap} srcdoc="${escapeSrcdoc(chartSrc)}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
}

function renderCallout(el, style, wrap, vis) {
  const bg = el.calloutColor || '#ef4444'
  const tc = el.calloutTextColor || '#ffffff'
  const fs = el.fontSize || 16
  return `<div${wrap} style="${style}${vis}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:calc(${fs}px * var(--font-zoom, 1));font-weight:700;font-family:-apple-system,sans-serif;">${el.calloutNumber || 1}</div>`
}

function renderIcon(el, style, wrap, vis) {
  const color = el.iconColor || '#ffffff'
  const sw = el.iconStrokeWidth || 2
  
  // Normalize icon name in case it has an 'Icon' suffix (from lucide-react aliases)
  const rawName = el.iconName || 'Star'
  const iconKey = rawName.endsWith('Icon') && rawName !== 'ImageIcon' ? rawName.replace(/Icon$/, '') : rawName
  const path = ICON_PATHS[iconKey] || ICON_PATHS['Star'] || ''
  
  return `<div${wrap} style="${style}${vis}display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg></div>`
}

function renderLatex(el, style, wrap, vis, opts) {
  const content = el.content || ''
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)
  const fontSize = el.latexFontSize || el.fontSize || 16
  const textColor = el.latexColor || el.textColor || el.fontColor || '#ffffff'

  // [FIX #13] If _fallbackSrc is available and content doesn't look like valid LaTeX, use image fallback.
  // This handles malformed LaTeX strings imported from PPTX that KaTeX cannot render.
  const hasFallbackImg = el._fallbackSrc && /^(data:image|\/uploads\/)/.test(String(el._fallbackSrc))
  const looksLikeLatex = /\\[a-zA-Z]+|[\^$_]|\\frac|\\sqrt|\\begin|\\left|\\right/.test(content)
  if (hasFallbackImg && !looksLikeLatex) {
    const fallbackSrc = absoluteSrc(el._fallbackSrc)
    return `<div${wrap} style="${style}${vis}"><img src="${fallbackSrc}" alt="Math equation" style="display:block;width:100%;height:100%;object-fit:contain;" /></div>`
  }

  if (opts.forPrint) {
    if (hasTikz) {
      const _origin = getAssetOrigin()
      const wrappedContent = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="${_origin}/vendor/tikzjax/fonts.css"><script src="${_origin}/vendor/tikzjax/tikzjax.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1))}svg{max-width:100%;max-height:100%}</style></head><body><script type="text/tikz">${content}</script></body></html>`
      return `<iframe${wrap} data-pdf-iframe="${encodeURIComponent(wrappedContent)}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
    }
    return `<div${wrap} style="${style}${vis}display:flex;align-items:center;justify-content:center;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1));"><span data-math-latex="${escapeHtml(content)}" data-math-display="true"></span></div>`
  }

  if (!hasTikz) {
    return `<div${wrap} style="${style}${vis}display:flex;align-items:center;justify-content:center;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1));"><span data-math-latex="${escapeHtml(content)}" data-math-display="true"></span></div>`
  }

  const _origin = getAssetOrigin()
  const tikzScript = hasTikz
    ? `<link rel="stylesheet" type="text/css" href="${_origin}/vendor/tikzjax/fonts.css"><script src="${_origin}/vendor/tikzjax/tikzjax.js"></script>`
    : ''
  let bodyContent
  if (hasTikz) {
    bodyContent = `<script type="text/tikz">${content}</script>`
  } else {
    bodyContent = `<div id="m"></div><script>katex.render(${JSON.stringify(content)},document.getElementById('m'),{displayMode:true,throwOnError:false})</script>`
  }
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${_origin}/vendor/katex/dist/katex.min.css"><script src="${_origin}/vendor/katex/dist/katex.min.js"></script>${tikzScript}<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1))}.katex{font-size:1.4em;color:inherit}svg{max-width:100%;max-height:100%}</style></head><body>${bodyContent}</body></html>`
  return `<iframe${wrap} srcdoc="${escapeSrcdoc(srcdoc)}" style="${style}border:none;background:transparent;" scrolling="no"></iframe>`
}

function renderVideo(el, style, wrap, vis, opts) {
  if (opts.forPrint) {
    return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:calc(16px * var(--font-zoom, 1));">&#9654; Video</div>`
  }
  const videoSrc = el.videoUrl || el.src
  const src = getMediaFragmentSrc(absoluteSrc(videoSrc), el.startTime, el.endTime)
  const attrs = []
  if (el.controls !== false) attrs.push('controls')
  if (el.autoplay) attrs.push('autoplay')
  if (el.loop) attrs.push('loop')
  if (el.muted) attrs.push('muted')
  const playbackRate = getPlaybackRate(el.playbackRate)
  const playbackAttr =
    playbackRate && playbackRate !== 1 ? ` onloadedmetadata="this.playbackRate=${playbackRate}"` : ''
  const posterAttr = el.poster ? ` poster="${absoluteSrc(el.poster)}"` : ''
  return `<div${wrap} style="${style}"><video src="${src}" ${attrs.join(' ')}${posterAttr}${playbackAttr} style="width:100%;height:100%;object-fit:${el.objectFit || 'contain'};display:block;"></video></div>`
}

function renderAudio(el, style, wrap, vis, opts) {
  if (opts.forPrint) {
    return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:calc(16px * var(--font-zoom, 1));">&#9835; Audio</div>`
  }
  const src = absoluteSrc(el.src)
  const attrs = ['controls']
  if (el.autoplay) attrs.push('autoplay')
  if (el.loop) attrs.push('loop')
  if (el.muted) attrs.push('muted')
  return `<div${wrap} style="${style}display:flex;align-items:center;justify-content:center;"><audio src="${src}" ${attrs.join(' ')} style="width:90%;"></audio></div>`
}

function renderTable(el, style, wrap, vis) {
  const data = el.data || [['']]
  const headerBg = el.headerBgColor || 'rgba(99,102,241,0.3)'
  const cellBg = el.cellBgColor || 'transparent'
  const borderColor = el.borderColor || 'rgba(255,255,255,0.2)'
  const borderWidth = el.borderWidth ?? 1
  const textColor = el.textColor || '#ffffff'
  const fontSize = el.fontSize || 14
  const cellPadding = el.cellPadding || 8
  const rows = data
    .map((row, ri) => {
      const cells = (row || [])
        .map((cell) => {
          const bg = el.headerRow && ri === 0 ? headerBg : cellBg
          return `<td style="padding:${cellPadding}px;border:${borderWidth}px solid ${borderColor};background:${bg};color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1));">${escapeHtml(cell || '')}</td>`
        })
        .join('')
      return `<tr>${cells}</tr>`
    })
    .join('')
  return `<div${wrap} style="${style}${vis}overflow:auto;"><table style="width:100%;height:100%;border-collapse:collapse;">${rows}</table></div>`
}

function renderDrawing(el, style, wrap, vis) {
  const paths = (el.paths || [])
    .map((p) => {
      const stroke = p.stroke || el.strokeColor || '#ffffff'
      const sw = p.strokeWidth || el.strokeWidth || 3
      return `<path d="${escapeHtml(p.d || '')}" stroke="${stroke}" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${p.opacity ?? 1}"/>`
    })
    .join('')
  return `<div${wrap} style="${style}${vis}"><svg width="100%" height="100%" viewBox="0 0 ${el.width} ${el.height}" preserveAspectRatio="none" style="position:absolute;inset:0;">${paths}</svg></div>`
}

function renderLine(el, style, wrap, vis) {
  const color = el.stroke || '#ffffff'
  const sw = el.strokeWidth || 2
  const dash = el.dashArray ? ` stroke-dasharray="${escapeHtml(el.dashArray)}"` : ''
  const x1 = el.x1 ?? 0,
    y1 = el.y1 ?? el.height / 2
  const x2 = el.x2 ?? el.width,
    y2 = el.y2 ?? el.height / 2
  const uid = (el.id || 'l').slice(0, 8)
  const startType = el.arrowStart || 'none'
  const endType = el.arrowEnd || 'none'
  let defs = ''
  let ms = '',
    me = ''
  const mkArrow = (id, c) =>
    `<marker id="${id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7" fill="${c}"/></marker>`
  const mkDiamond = (id, c) =>
    `<marker id="${id}" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto" markerUnits="strokeWidth"><polygon points="5 0,10 5,5 10,0 5" fill="${c}"/></marker>`
  const mkCircle = (id, c) =>
    `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth"><circle cx="4" cy="4" r="3" fill="${c}"/></marker>`
  const mkSquare = (id, c) =>
    `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth"><rect x="1" y="1" width="6" height="6" fill="${c}"/></marker>`
  const markerFns = { arrow: mkArrow, diamond: mkDiamond, circle: mkCircle, square: mkSquare }
  if (startType !== 'none' && markerFns[startType]) {
    const sid = `ms-${uid}`
    defs += markerFns[startType](sid, color)
    ms = ` marker-start="url(#${sid})"`
  }
  if (endType !== 'none' && markerFns[endType]) {
    const eid = `me-${uid}`
    defs += markerFns[endType](eid, color)
    me = ` marker-end="url(#${eid})"`
  }
  const pathD =
    el.cx != null && el.cy != null
      ? `M ${x1} ${y1} Q ${el.cx} ${el.cy} ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`
  return `<div${wrap} style="${style}${vis}"><svg width="100%" height="100%" viewBox="0 0 ${el.width} ${el.height}" preserveAspectRatio="none" style="position:absolute;inset:0;overflow:visible;"><defs>${defs}</defs><path d="${pathD}" stroke="${color}" stroke-width="${sw}" fill="none" stroke-linecap="round"${dash}${ms}${me}/></svg></div>`
}

function renderSvg(el, style, wrap, vis) {
  let svgContent = el.content || ''
  if (el.fillOverride) svgContent = svgContent.replace(/fill="[^"]*"/g, `fill="${el.fillOverride}"`)
  if (el.strokeOverride)
    svgContent = svgContent.replace(/stroke="[^"]*"/g, `stroke="${el.strokeOverride}"`)
  return `<div${wrap} style="${style}${vis}display:flex;align-items:center;justify-content:center;">${sanitizeSvgHtml(svgContent)}</div>`
}

function renderQrcode(el, style, wrap, vis, opts) {
  const data = el.qrData || 'https://example.com'
  const fg = el.qrColor || '#000000'
  const bgColor = el.qrBgColor || '#ffffff'
  const err = el.qrErrorLevel || 'M'

  if (opts.forPrint) {
    const canvasId = `qr-${el.id || Math.random().toString(36).slice(2, 8)}`
    const qrConfig = JSON.stringify({ data, fg, bg: bgColor, err }).replace(/</g, '\\u003c')
    return `<div style="${style}${vis}display:flex;align-items:center;justify-content:center;background:${bgColor};border-radius:${el.borderRadius || 0}px;overflow:hidden;"><canvas id="${canvasId}" data-qr-config='${qrConfig}' style="width:90%;height:90%;object-fit:contain;"></canvas></div>`
  }

  const _origin = getAssetOrigin()
  const qrSrc = `<!doctype html><html><head><meta charset="utf-8"><script src="${_origin}/vendor/qrcode/qrcode.min.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:${bgColor};overflow:hidden;display:flex;align-items:center;justify-content:center}</style></head><body><canvas id="c" style="width:100%;height:100%;object-fit:contain"></canvas><script>QRCode.toCanvas(document.getElementById('c'), ${JSON.stringify(data)}, { color: { dark: '${fg}', light: '${bgColor}' }, errorCorrectionLevel: '${err}', margin: 1, width: 500 });</script></body></html>`
  return `<iframe${wrap} srcdoc="${escapeSrcdoc(qrSrc)}" style="${style}border:none;background:transparent;border-radius:${el.borderRadius || 0}px;overflow:hidden;" scrolling="no"></iframe>`
}

function renderTimeline(el, style, wrap, vis, _opts) {
  const w = el.width || 800
  const h = el.height || 400
  const lineY = h * 0.5
  const pad = 30
  const lineColor = el.lineColor || '#6366f1'
  const dotColor = el.dotColor || lineColor
  const textColor = el.textColor || '#fff'
  const fs = el.fontSize || 11
  const startDate = el.timelineStart ?? el.startDate ?? '2000'
  const endDate = el.timelineEnd ?? el.endDate ?? '2025'
  const items = (el.events || el.items || []).map((item) => ({
    ...item,
    label: item.title ?? item.label ?? '',
    image: item.imageUrl ?? item.image ?? '',
    connectorLength: item.connectorLength ?? item.connectorOffset ?? el.connectorOffset ?? 0,
  }))
  const spacing = el.tickSpacing || 'auto'
  const yearMode = ['year', '10year', '100year', '1000year'].includes(spacing) ||
    (spacing === 'auto' && /^-?\d+$/.test(String(startDate)))

  function datePos(d) {
    if (yearMode) {
      const y0 = parseInt(startDate) || 0
      const y1 = parseInt(endDate) || 0
      const yr = y1 - y0 || 1
      return pad + (((parseInt(d) || 0) - y0) / yr) * (w - pad * 2)
    }
    const t0 = new Date(startDate).getTime()
    const t1 = new Date(endDate).getTime()
    const range = t1 - t0 || 1
    return pad + ((new Date(d).getTime() - t0) / range) * (w - pad * 2)
  }

  const ticks = []
  if (yearMode) {
    const y0 = parseInt(startDate) || 0
    const y1 = parseInt(endDate) || 0
    const step = spacing === '1000year' ? 1000 : spacing === '100year' ? 100 : spacing === '10year' ? 10 : Math.abs(y1 - y0) > 8 ? 2 : 1
    const sY = y0 < y1 ? Math.ceil(y0 / step) * step : Math.floor(y0 / step) * step
    for (let y = sY; y0 < y1 ? y <= y1 : y >= y1; y += y0 < y1 ? step : -step) ticks.push({ date: String(y), label: String(y) })
  }

  let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">`
  svg += `<line x1="${pad}" y1="${lineY}" x2="${w - pad}" y2="${lineY}" stroke="${lineColor}" stroke-width="2"/>`
  ticks.forEach((t) => {
    const x = datePos(t.date)
    svg += `<line x1="${x}" y1="${lineY - 4}" x2="${x}" y2="${lineY + 4}" stroke="${lineColor}" stroke-width="1.5"/>`
    svg += `<text x="${x}" y="${lineY + 14}" text-anchor="end" fill="${textColor}" font-size="${fs - 1}" opacity="0.5" transform="rotate(-45,${x},${lineY + 14})">${escapeHtml(t.label)}</text>`
  })
  items.forEach((item) => {
    const x = datePos(item.date)
    const isTop = item.side !== 'bottom'
    const cl = item.connectorLength ?? 0
    const cardY = isTop ? 8 - cl : lineY + 28 + cl
    const cardH = isTop ? lineY - 36 : h - lineY - 36
    const connY1 = isTop ? cardY + cardH : lineY
    const connY2 = isTop ? lineY : cardY
    svg += `<line x1="${x}" y1="${connY1}" x2="${x}" y2="${connY2}" stroke="${lineColor}" stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>`
    svg += `<circle cx="${x}" cy="${lineY}" r="4" fill="${dotColor}"/>`
    let ty = cardY + fs
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${textColor}" font-size="${fs}" font-weight="600">${escapeHtml(item.label || '')}</text>`
    ty += fs + 2
    if (item.description) {
      svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${textColor}" font-size="${fs - 1}" opacity="0.6">${escapeHtml(item.description)}</text>`
      ty += fs
    }
    const dateLabel = yearMode ? String(parseInt(item.date) || item.date) : item.date
    svg += `<text x="${x}" y="${ty}" text-anchor="middle" fill="${textColor}" font-size="${fs - 2}" opacity="0.35">${escapeHtml(dateLabel)}</text>`
  })
  svg += '</svg>'

  return `<div${wrap} style="${style}${vis}">${svg}</div>`
}

function isPluginType(type) {
  return typeof type === 'string' && type.startsWith('plugin:')
}

function isSafePluginAssetPath(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)
}

function isSafeSandboxFile(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(value) && !value.includes('..')
}

function getPluginFallbackText(el) {
  const data = el.pluginData || {}
  if (data.value !== undefined) return `${data.prefix || ''}${data.value}${data.suffix || ''}`
  return el.pluginRuntime?.label || el.pluginSlug || el.type.replace('plugin:', '')
}

function renderPluginFallback(el, style, wrap, vis) {
  const label = escapeHtml(el.pluginRuntime?.label || 'Plugin')
  const text = escapeHtml(getPluginFallbackText(el))
  return `<div${wrap} data-plugin-fallback="true" style="${style}${vis}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(15,23,42,0.72);border:1px solid rgba(148,163,184,0.35);border-radius:6px;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"><strong style="font-size:calc(18px * var(--font-zoom, 1));">${text}</strong><span style="font-size:calc(12px * var(--font-zoom, 1));opacity:.72;">${label}</span></div>`
}

function renderPlugin(el, style, wrap, vis, opts) {
  if (opts.forPrint) return renderPluginFallback(el, style, wrap, vis)
  const slug = el.pluginSlug
  const sandbox = el.pluginRuntime?.sandbox
  if (!isSafePluginAssetPath(slug) || !isSafeSandboxFile(sandbox)) {
    return renderPluginFallback(el, style, wrap, vis)
  }
  const src = `/api/plugins/${slug}/assets/${sandbox}`
  const title = escapeHtml(el.pluginRuntime?.label || 'Plugin')
  const dataJson = escapeHtml(JSON.stringify(el.pluginData || {}))
  return `<div${wrap} data-plugin-runtime="true" data-plugin-data="${dataJson}" style="${style}${vis}"><iframe title="${title}" src="${src}" sandbox="allow-scripts" style="width:100%;height:100%;border:none;background:transparent;" scrolling="no"></iframe></div>`
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

const RENDERERS = {
  text: renderText,
  image: renderImage,
  shape: renderShape,
  code: renderCode,
  html: renderHtml,
  markdown: renderMarkdown,
  chart: renderChart,
  callout: renderCallout,
  icon: renderIcon,
  latex: renderLatex,
  video: renderVideo,
  audio: renderAudio,
  table: renderTable,
  drawing: renderDrawing,
  line: renderLine,
  svg: renderSvg,
  qrcode: renderQrcode,
  timeline: renderTimeline,
}

/**
 * Render a single element to HTML string.
 * @param {Object} el - The element data
 * @param {Object} slide - Parent slide (for autoAnimate data-id)
 * @param {Object} opts - { forPrint: boolean, isHidden: boolean }
 */
function renderElement(el, slide, opts = {}) {
  const style = buildBaseStyle(el, opts)
  const { dataIdAttr, fragClass, fragIdx } = opts.forPrint
    ? { dataIdAttr: '', fragClass: '', fragIdx: '' }
    : buildWrapperAttrs(el, slide)
  const exportIdAttr =
    opts.exportElementIds && el.id ? ` data-export-element-id="${escapeHtml(el.id)}"` : ''
  const wrap = `${exportIdAttr}${dataIdAttr}${fragClass}${fragIdx}`
  const vis = opts.isHidden ? 'visibility:hidden;' : ''

  const renderer = isPluginType(el.type) ? renderPlugin : RENDERERS[el.type]
  if (!renderer) return ''
  return renderer(el, style, wrap, vis, opts)
}

/**
 * Render all elements of a slide, sorted by zIndex.
 */
function renderSlideElements(slide, opts = {}) {
  return (slide.elements || [])
    .slice()
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map((el) => {
      const elementOpts = { ...opts }
      if (opts.forPrint && el.fragment) {
        elementOpts.isHidden = (el.fragmentIndex || 1) > (opts.maxFragIdx ?? Infinity)
      }
      return renderElement(el, slide, elementOpts)
    })
    .join('\n')
}

module.exports = {
  renderElement,
  renderSlideElements,
  buildBaseStyle,
  escapeHtml,
  escapeSrcdoc,
  absoluteSrc,
  getMediaFragmentSrc,
  getPlaybackRate,
  getAssetOrigin,
  getBackgroundAttrs: null, // will be set from htmlGenerator
}
