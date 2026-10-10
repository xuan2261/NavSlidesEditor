/**
 * Shared element rendering functions used by both generateRevealHTML and generatePrintHTML.
 * Eliminates ~300 lines of duplicated rendering logic.
 */
const { shapeSvgString } = require('./shapeUtils.js')
const {
  sanitizeRichTextHtml,
  sanitizeSvgHtml,
  sanitizeMarkdownHtml,
  sanitizeHref,
  sanitizeMediaSrc,
} = require('./content-safety.js')
const { resolveColorField, svgPaint, isTokenVar } = require('./design-tokens.js')
const { resolveMergedCells } = require('./table-merge-resolver.js')
const { resolveTableDimensions } = require('./table-layout.js')
const { normalizeLatexForRender } = require('./latex-utils.js')
const { resolveChartPalette } = require('./chart-colors.js')
const { normalizeElementAction, serializeElementAction } = require('./element-actions.js')
const {
  normalizeImageAccessibility,
  normalizeMediaAccessibility,
  MEDIA_CAPTION_CSS,
  MEDIA_CAPTION_TEXT_CSS,
} = require('./media-accessibility.js')
const { resolveConnectorGeometry } = require('./connector-geometry.js')
const { buildTicks, parseDatePos } = require('./timeline-utils.js')
const { applySvgPaintOverrides } = require('./svg-paint-overrides.js')
const { resolveChartAuthoringOptions } = require('./chart-authoring-options.js')
const { marked } = require('marked')
const { staticGameContent } = require('./education/static-game-content.js')
const { renderStaticGameSnapshot } = require('./education/static-snapshot.js')
const { GAME_CATALOG } = require('./education/game-registry.js')
const { normalizeGameConfig } = require('./education/normalize-game-config.js')
const { projectPublicGameConfig } = require('./education/game-public-projection.js')
const { serializeEducationConfig } = require('./education/config-serialization.js')
const {
  buildSandboxFrameDocument,
  HTML_SANDBOX,
  validateHtmlDependencies,
} = require('./education/html-sandbox-policy.js')

/**
 * Inline SVG paint that preserves the exact `name="value"` token shape for
 * literal colors (byte-identical frozen-hex output) but swaps to a `style`
 * declaration for token vars, since SVG presentation attributes don't resolve
 * CSS custom properties.
 */
function inlineSvgPaint(name, value) {
  return isTokenVar(value)
    ? `style="${escapeHtml(`${name}:${value}`)}"`
    : `${name}="${escapeHtml(value)}"`
}
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

function mediaPlaybackAttribute(media) {
  return ` data-ns-media-playback="${escapeHtml(
    JSON.stringify({
      startTime: Number(media.startTime) || 0,
      endTime: Number(media.endTime) || 0,
      loop: media.loop === true,
      playbackRate: getPlaybackRate(media.playbackRate) || 1,
    })
  )}"`
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

// Stable, collision-resistant id fragment derived from the FULL element id.
// A prior `id.slice(0,8)` truncation made two elements whose ids shared an
// 8-char prefix emit the same marker def id, so one line's arrowheads bound to
// the other's marker. A 32-bit FNV-1a hash over the whole id avoids that while
// staying deterministic and DOM-id safe.
function hashId(value) {
  const str = String(value == null ? '' : value)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(36)
}

function safeCssColor(value, fallback) {
  const color = typeof value === 'string' ? value.trim() : ''
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(color)) return color
  if (/^hsla?\(\s*[\d.\s,%deg]+\)$/i.test(color)) return color
  if (/^var\(--ns-[a-z0-9-]+\)$/.test(color)) return color
  if (['transparent', 'currentColor'].includes(color)) return color
  return fallback
}

function safeBorderStyle(value) {
  const style = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['solid', 'dashed', 'dotted', 'double', 'none'].includes(style) ? style : 'solid'
}

function safeCssFontSize(value) {
  const size = Number(value)
  return Number.isFinite(size) && size > 0 ? Math.round(size * 10) / 10 : null
}

function safeCssFontFamily(value) {
  const family = typeof value === 'string' ? value.trim() : ''
  if (!family) return null
  if ([...family].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) return null
  if (/[;:()\\/]/.test(family)) return null
  if (/\/\*|\*\/|url|import|expression|javascript|behavior|binding/i.test(family)) return null
  return /^[a-zA-Z0-9 _.-]+$/.test(family) ? family : null
}

function escapeSrcdoc(html) {
  return html
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeScriptElementContent(value) {
  return String(value || '').replace(/<\//gi, '\\u003c/')
}

const MERMAID_SOURCE_LIMIT = 12000

function getMermaidSource(el) {
  const source = String(el.mermaidSource || el.content || '').slice(0, MERMAID_SOURCE_LIMIT)
  return source
}

function buildMermaidDocument(source, runtimeUrl) {
  return `<!doctype html><html><head><meta charset="utf-8"><script src="${escapeHtml(runtimeUrl)}"></script><style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;height:100%;overflow:auto;background:transparent;color:#f8fafc;font-family:system-ui,sans-serif}.mermaid{width:100%;min-height:100%;display:flex;align-items:center;justify-content:center;padding:12px}.mermaid svg{max-width:100%;height:auto}.mermaid-error{margin:12px;padding:10px;border:1px solid #f59e0b;border-radius:8px;background:rgba(245,158,11,.12);color:#fde68a;font:13px/1.4 ui-monospace,monospace;white-space:pre-wrap}</style></head><body><pre class="mermaid">${escapeHtml(source)}</pre><script>
function showMermaidError(error){document.body.innerHTML='<div class="mermaid-error">Mermaid render error: '+String(error&&error.message||error).replace(/[<>&]/g,function(c){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[c]})+'</div>'}
  mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'dark'});
Promise.resolve(document.fonts.ready).then(function(){
  var ns='http://www.w3.org/2000/svg',probe=document.createElementNS(ns,'svg'),text=document.createElementNS(ns,'text');
  probe.setAttribute('width','1');probe.setAttribute('height','1');probe.style.cssText='position:absolute;opacity:0;pointer-events:none';
  text.textContent='M';probe.appendChild(text);document.body.appendChild(probe);
  var pending;
  function renderWhenVisible(){
    if(text.getBBox().width>0){probe.remove();mermaid.run().catch(showMermaidError)}
    else pending=requestAnimationFrame(renderWhenVisible);
  }
  window.addEventListener('pagehide',function(){cancelAnimationFrame(pending)},{once:true});
  renderWhenVisible();
}).catch(showMermaidError)
</script></body></html>`
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
  const opacityStyle = el.opacity !== undefined && el.opacity !== 1 ? `opacity:${el.opacity};` : ''
  return `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex || 1};overflow:hidden;box-sizing:border-box;${shadowStyle}${borderRadiusStyle}${rotationStyle}${opacityStyle}`
}

/** Build wrapper attributes for reveal.js (fragment + data-id) */
function buildWrapperAttrs(el, slide) {
  const dataIdAttr = slide && slide.autoAnimate ? ` data-id="${escapeHtml(el.id)}"` : ''
  const fragClass = el.fragment
    ? ` class="fragment ${escapeHtml(el.fragmentAnimation || 'fade-in')}"`
    : ''
  const fragIdx =
    el.fragment && el.fragmentIndex != null
      ? ` data-fragment-index="${escapeHtml(el.fragmentIndex)}"`
      : ''
  return { dataIdAttr, fragClass, fragIdx }
}

function renderActionSurface(el, style, opts) {
  if (opts.forPrint || el.type === 'game') return ''
  const { action } = normalizeElementAction(el.action)
  if (!action) return ''
  const label =
    action.label ||
    (action.kind === 'slide' ? 'Go to slide' : action.kind === 'url' ? 'Open link' : action.kind)
  const actionData = serializeElementAction(action)
  const surfaceStyle = `${style}border:0;padding:0;background:transparent;color:transparent;cursor:pointer;`
  const identity = el.id
    ? ` data-ns-element-for="${escapeHtml(el.id)}" data-ns-initial-visibility="${el.initialVisibility === 'hidden' ? 'hidden' : 'visible'}"${el.initialVisibility === 'hidden' ? ' hidden' : ''}`
    : ''
  return `<button type="button" class="ns-element-action${action.hotspot ? ' ns-element-hotspot' : ''}"${identity} data-ns-action="${escapeHtml(actionData)}" aria-label="${escapeHtml(label)}" style="${escapeHtml(surfaceStyle)}"></button>`
}

// ─── Per-type renderers ──────────────────────────────────────────────────────

function importedTextInsetStyle(el) {
  const insets = el?._pptxImportMeta?.textInsets
  if (!insets) return 'padding:0;'
  const unitScale = el._pptxImportMeta.textInsetsUnit === 'px' ? 1 : 96 / 72
  const side = (value, maxDimension) => {
    const raw = Number(value)
    if (!Number.isFinite(raw)) return 0
    const max = Math.min(
      Number.isFinite(maxDimension) && maxDimension >= 0 ? maxDimension / 2 : 96,
      96
    )
    return Math.min(Math.round(Math.max(0, raw) * unitScale * 10) / 10, max)
  }
  return `padding:${side(insets.top, el.height)}px ${side(insets.right, el.width)}px ${side(insets.bottom, el.height)}px ${side(insets.left, el.width)}px;`
}

function renderText(el, style, wrap, vis) {
  const resolvedTextColor = safeCssColor(resolveColorField(el.textColor, 'text', 'textColor'), null)
  const tc = resolvedTextColor ? `;color:${resolvedTextColor}` : ''
  const fontFamily = safeCssFontFamily(el.fontFamily)
  const ff = fontFamily ? `;font-family:${fontFamily}` : ''
  const importedFit = Number(el._pptxImportMeta?.fitFontSizePx)
  const fontSize = Number.isFinite(importedFit) && importedFit > 0 ? importedFit : el.fontSize
  const fs = fontSize ? `;font-size:calc(${fontSize}px * var(--font-zoom, 1))` : ''
  const textStyle =
    el?._pptxImportMeta?.textFit === 'wrap'
      ? style.replace('overflow:hidden;', 'overflow:visible;')
      : style
  const fit = el._pptxImportMeta
    ? ';overflow-wrap:anywhere;word-break:normal;white-space:pre-wrap'
    : ''
  const padding = el._pptxImportMeta ? importedTextInsetStyle(el) : 'padding:8px 12px;'
  return `<div${wrap} style="${escapeHtml(`${textStyle}${vis}${padding}color:white${tc}${ff}${fs}${fit}`)}">${sanitizeRichTextHtml(el.content || '')}</div>`
}

function buildCitationHtml(el) {
  const text = el.citationText || el.citationLink
  if (!text) return ''
  const color = safeCssColor(el.citationColor, 'rgba(255,255,255,0.5)')
  const align = ['left', 'center', 'right'].includes(el.citationAlign) ? el.citationAlign : 'left'
  const citeStyle = `position:absolute;left:0;right:0;top:100%;font-size:10px;color:${color};line-height:1.3;padding:3px 2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:${align};`
  if (el.citationLink) {
    const href = sanitizeHref(el.citationLink)
    const display = escapeHtml(text)
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" style="${escapeHtml(`${citeStyle}pointer-events:auto;text-decoration:none;cursor:pointer;`)}">${display}</a>`
  }
  return `<div style="${escapeHtml(`${citeStyle}pointer-events:none;`)}">${escapeHtml(text)}</div>`
}

function renderImage(el, style, wrap, vis, opts) {
  const image = normalizeImageAccessibility(el)
  const src = absoluteSrc(sanitizeMediaSrc(image.src))
  const imgFilterParts = [
    image.filterBrightness != null && image.filterBrightness !== 100
      ? `brightness(${image.filterBrightness}%)`
      : '',
    image.filterContrast != null && image.filterContrast !== 100
      ? `contrast(${image.filterContrast}%)`
      : '',
    image.filterGrayscale ? `grayscale(${image.filterGrayscale}%)` : '',
    image.filterSaturate != null && image.filterSaturate !== 100
      ? `saturate(${image.filterSaturate}%)`
      : '',
    image.filterSepia ? `sepia(${image.filterSepia}%)` : '',
    image.filterBlur ? `blur(${image.filterBlur}px)` : '',
  ]
    .filter(Boolean)
    .join(' ')
  const filterStyle = imgFilterParts ? `filter:${imgFilterParts};` : ''
  const flipParts = [image.flipH ? 'scaleX(-1)' : '', image.flipV ? 'scaleY(-1)' : '']
    .filter(Boolean)
    .join(' ')
  const flipStyle = flipParts ? `transform:${flipParts};` : ''
  const borderW = Number(image.borderWidth)
  const borderColor = image.borderColor ? safeCssColor(image.borderColor, null) : null
  const borderStyle =
    Number.isFinite(borderW) && borderW > 0 && borderColor
      ? `border:${borderW}px solid ${borderColor};`
      : ''
  const imgReset = opts.forPrint ? 'max-width:none;max-height:none;' : ''
  const citationHtml = buildCitationHtml(image)
  const sourceCrop = image._pptxImportMeta?.sourceCrop && image._pptxImportMeta?.cropData
  const cropAttrs = sourceCrop
    ? ` data-pptx-crop-intent="source-crop" data-pptx-crop-data="${escapeHtml(JSON.stringify(image._pptxImportMeta.cropData))}"`
    : ''
  const descriptionId = image.longDescription ? `image-description-${hashId(image.id)}` : ''
  const description = descriptionId
    ? `<span id="${descriptionId}" class="ns-image-long-description" style="position:absolute;width:1px;height:1px;padding:0;border:0;overflow:hidden;clip:rect(0,0,0,0);clip-path:inset(50%);white-space:nowrap;">${escapeHtml(image.longDescription)}</span>`
    : ''
  const describedBy = descriptionId ? ` aria-describedby="${descriptionId}"` : ''
  const alt = escapeHtml(image.decorative ? '' : image.alt)
  const clipStyle =
    'position:relative;width:100%;height:100%;overflow:hidden;border-radius:inherit;'
  if (image.imageW != null) {
    const offX = image.imageOffsetX ?? 0
    const offY = image.imageOffsetY ?? 0
    const imgStyle = `position:absolute;left:${offX}px;top:${offY}px;width:${image.imageW}px;height:${image.imageH}px;object-fit:${image.objectFit || 'contain'};${filterStyle}${flipStyle}${imgReset}`
    return `<div${wrap}${cropAttrs} style="${escapeHtml(`${style}${borderStyle}${vis}overflow:visible;`)}"><div style="${escapeHtml(clipStyle)}"><img src="${src}" alt="${alt}"${describedBy} style="${escapeHtml(imgStyle)}" /></div>${description}${citationHtml}</div>`
  }
  return `<div${wrap} style="${escapeHtml(`${style}${borderStyle}${vis}overflow:visible;`)}"><div style="${escapeHtml(clipStyle)}"><img src="${src}" alt="${alt}"${describedBy} style="${escapeHtml(`display:block;width:100%;height:100%;object-fit:${image.objectFit || 'contain'};${filterStyle}${flipStyle}${imgReset}`)}" /></div>${description}${citationHtml}</div>`
}

function renderShape(el, style, wrap, vis) {
  // opacity is emitted once by buildBaseStyle for all types; no per-shape re-apply
  return `<div${wrap} style="${escapeHtml(`${style}${vis}`)}">${shapeSvgString(el)}</div>`
}

function getCodeWalkthroughStep(el) {
  const steps = Array.isArray(el.walkthroughSteps) ? el.walkthroughSteps : []
  if (!steps.length) return null
  const index = Number.isInteger(el.defaultStepIndex) ? el.defaultStepIndex : 0
  return steps[Math.min(Math.max(index, 0), steps.length - 1)] || null
}

function isCodeLineInStep(lineNumber, step) {
  if (!step) return false
  const start = Math.max(1, Number(step.startLine) || 1)
  const end = Math.max(start, Number(step.endLine) || start)
  return lineNumber >= start && lineNumber <= end
}

function renderCodeLines(el) {
  const step = getCodeWalkthroughStep(el)
  const lines = String(el.content || '').split('\n')
  return lines
    .map((line, index) => {
      const lineNumber = index + 1
      const active = isCodeLineInStep(lineNumber, step)
      const activeAttr = active ? ' data-walkthrough-active="true"' : ''
      const activeStyle = active
        ? 'background:rgba(250,204,21,.18);box-shadow:inset 3px 0 0 #facc15;'
        : ''
      return `<span data-code-line="${lineNumber}"${activeAttr} style="${escapeHtml(`display:block;margin:0 -14px;padding:0 14px;${activeStyle}`)}">${escapeHtml(line || ' ')}</span>`
    })
    .join('')
}

function renderCode(el, style, wrap, vis) {
  const lang = el.language || 'plaintext'
  const hasWalkthrough = Array.isArray(el.walkthroughSteps) && el.walkthroughSteps.length
  const cls = vis ? ' class="hljs"' : ''
  const walkthroughAttr = hasWalkthrough
    ? ` data-code-walkthrough="${escapeHtml(JSON.stringify({ defaultStepIndex: el.defaultStepIndex || 0, steps: el.walkthroughSteps }))}"`
    : ''
  const codeClass = hasWalkthrough ? 'nohighlight' : `language-${escapeHtml(lang)}`
  const escapeAttr = hasWalkthrough ? ' data-noescape' : ''
  const content = hasWalkthrough ? renderCodeLines(el) : escapeHtml(String(el.content || ''))
  return `<div${wrap} style="${escapeHtml(`${style}${vis}`)}"><pre${cls}${walkthroughAttr} style="${escapeHtml(`margin:0;padding:10px 14px;width:100%;height:100%;overflow:hidden;box-sizing:border-box;font-family:'Fira Code','JetBrains Mono','Courier New',monospace;font-size:calc(${el.fontSize || 14}px * var(--font-zoom, 1));line-height:1.5;`)}"><code class="${codeClass}"${escapeAttr}>${content}</code></pre></div>`
}

function renderHtml(el, style, wrap, vis, opts) {
  const isMermaid = el.embedKind === 'mermaid'
  const baseUrl = opts.baseUrl || getAssetOrigin()
  const dependencies = isMermaid
    ? {
        network: true,
        offlineCapable: true,
        resources: [
          { url: new URL('/vendor/mermaid/mermaid.min.js', baseUrl).href, kind: 'script' },
        ],
        dynamicResources: [],
      }
    : el.htmlDependencies
  const content = isMermaid
    ? buildMermaidDocument(getMermaidSource(el), dependencies.resources[0].url)
    : `<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style>${el.content || ''}`
  const wrappedContent = buildSandboxFrameDocument(content, dependencies, { baseUrl })
  const declaration = dependencies
    ? ` data-html-dependencies="${escapeHtml(JSON.stringify(dependencies))}"`
    : ''

  // PDF mode: use data-pdf-iframe with blob URL initialization.
  // Iframes with srcdoc break Chrome's CSS paged media engine layout, causing
  // slides to merge into one scrolling page. Instead, we emit an empty iframe
  // and inject a script at the end of the print HTML to convert data-pdf-iframe
  // into a Blob URL at runtime, avoiding the layout breakage while keeping interactivity.
  if (opts.forPrint) {
    return `<iframe${wrap} sandbox="${HTML_SANDBOX}" referrerpolicy="no-referrer"${declaration} data-pdf-iframe="${encodeURIComponent(wrappedContent)}" style="${escapeHtml(`${style}border:none;background:transparent;`)}" scrolling="no"></iframe>`
  }

  return `<div${wrap} style="${escapeHtml(`${style}${vis}`)}"><iframe sandbox="${HTML_SANDBOX}" referrerpolicy="no-referrer"${declaration} srcdoc="${escapeSrcdoc(wrappedContent)}" style="width:100%;height:100%;border:none;background:transparent;" scrolling="no"></iframe></div>`
}

function renderMarkdown(el, style, wrap, vis, opts) {
  const mdColor = safeCssColor(resolveColorField(el.textColor, 'markdown', 'textColor'), '#141413')
  const mdFont = Number(el.fontSize) > 0 ? Number(el.fontSize) : null
  const html = sanitizeMarkdownHtml(marked.parse(el.content || ''))
  if (opts.forPrint) {
    const fs = mdFont || 16
    return `<div data-ns-markdown style="${escapeHtml(`${style}${vis}padding:8px 12px;color:${mdColor};overflow:auto;font-size:calc(${fs}px * var(--font-zoom, 1));line-height:1.5;`)}">${html}</div>`
  }
  const bodyFs = mdFont || 18
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;color:${mdColor};font-family:-apple-system,sans-serif;font-size:calc(${bodyFs}px * var(--font-zoom, 1));line-height:1.6;padding:8px 12px;overflow:auto}h1,h2,h3,h4{margin:0 0 .4em}p{margin:0 0 .4em}ul,ol{padding-left:1.5em;margin:0 0 .4em}a{color:#60a5fa}pre{background:rgba(0,0,0,0.3);padding:10px 14px;border-radius:6px;overflow:auto;font-size:13px}code{font-family:'Fira Code',monospace}</style></head><body><div id="out">${html}</div></body></html>`
  return `<iframe${wrap} data-ns-generated-frame="true" srcdoc="${escapeSrcdoc(srcdoc)}" style="${escapeHtml(`${style}border:none;background:transparent;`)}" scrolling="no"></iframe>`
}

function suggestedImportedAxisMax(datasets, targetTicks, valueAt) {
  let max = 0
  for (const dataset of datasets || []) {
    const values = valueAt(dataset) || []
    for (const value of values) {
      const numeric = Number(value)
      if (Number.isFinite(numeric) && numeric > max) max = numeric
    }
  }
  if (!(max > 0)) return undefined
  const rawStep = max / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalized = rawStep / magnitude
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude
  let axisMax = Math.ceil(max / step) * step
  if (axisMax - max < step * 0.25) axisMax += step
  return axisMax
}

function renderChart(el, style, wrap, vis, opts) {
  const { chartType = 'bar', chartData = {} } = el
  const isScatter = el._pptxChartMeta?.originalType === 'scatterChart'
  const runtimeChartType = isScatter ? 'scatter' : chartType
  const lineLike = chartType === 'line' || isScatter
  const authoredOptions = resolveChartAuthoringOptions(el)
  const chartTitle = authoredOptions.title.text
  const legendFontSize = chartTitle ? 9 : 12
  const importedLine = chartType === 'line' && Boolean(el._pptxChartMeta)
  const areaFill = chartType === 'line' && el.areaFill === true
  const stacked = el.stacked === true
  const chartPalette = resolveChartPalette(opts.slideBackground)
  const axisTextColor = safeCssColor(el.axisTextColor, chartPalette.text)
  const gridColor = safeCssColor(el.gridColor, chartPalette.grid)
  const legendTextColor = safeCssColor(el.legendTextColor, axisTextColor)
  const importedChart = Boolean(el._pptxChartMeta)
  const suggestedYMax = importedChart
    ? suggestedImportedAxisMax(chartData.datasets, 10, (dataset) => dataset.data)
    : undefined
  const suggestedXMax = isScatter
    ? suggestedImportedAxisMax(chartData.datasets, 5, (dataset) => dataset.xValues)
    : undefined
  const legendLabels = {
    color: legendTextColor,
    font: { size: legendFontSize },
    boxWidth: lineLike ? 12 : 8,
    boxHeight: 8,
    ...(lineLike ? { usePointStyle: true, pointStyleWidth: 12 } : {}),
  }
  const pluginsConfig = {
    title: { ...authoredOptions.title, color: axisTextColor },
    legend: { ...authoredOptions.legend, labels: legendLabels },
  }
  const datasetsArr = (chartData.datasets || []).map((ds) => ({
    label: ds.label || '',
    data: isScatter
      ? (ds.data || []).map((y, index) => ({ x: ds.xValues?.[index] ?? index + 1, y }))
      : ds.data || [],
    backgroundColor: ds.colors || ds.color || '#6366f1',
    borderColor: ds.color || '#6366f1',
    borderWidth: lineLike ? 2 : 0,
    ...(isScatter ? { showLine: true } : {}),
    fill: lineLike ? areaFill : undefined,
  }))
  const radialScales = {
    r: {
      ...authoredOptions.valueAxis,
      angleLines: { color: gridColor },
      ticks: { color: axisTextColor, backdropColor: 'transparent' },
      grid: { color: gridColor },
      pointLabels: { color: axisTextColor },
    },
  }
  const cartesianScales = {
    x: {
      ...authoredOptions.categoryAxis,
      ...(isScatter ? { type: 'linear', beginAtZero: true } : {}),
      ...(suggestedXMax ? { suggestedMax: suggestedXMax } : {}),
      ...(stacked ? { stacked: true } : {}),
      ticks: { color: axisTextColor },
      grid: { color: gridColor },
    },
    y: {
      ...authoredOptions.valueAxis,
      ...(stacked ? { stacked: true } : {}),
      ...(isScatter || importedLine ? { beginAtZero: true } : {}),
      ...(suggestedYMax ? { suggestedMax: suggestedYMax } : {}),
      ticks: { color: axisTextColor },
      grid: { color: gridColor },
    },
  }
  const scalesConfig =
    chartType === 'pie' || chartType === 'doughnut' || chartType === 'polarArea'
      ? {}
      : chartType === 'radar'
        ? radialScales
        : cartesianScales

  if (opts.forPrint) {
    const canvasId = `chart-${el.id || Math.random().toString(36).slice(2, 8)}`
    const chartConfig = JSON.stringify({
      type: runtimeChartType,
      data: { labels: chartData.labels || [], datasets: datasetsArr },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: pluginsConfig,
        scales: scalesConfig,
      },
    }).replace(/</g, '\\u003c')
    return `<div style="${escapeHtml(`${style}${vis}`)}"><canvas id="${escapeHtml(canvasId)}" data-chart-config='${escapeHtml(chartConfig)}' style="width:100%;height:100%;"></canvas></div>`
  }

  const labels = JSON.stringify(chartData.labels || []).replace(/</g, '\\u003c')
  const datasets = JSON.stringify(datasetsArr).replace(/</g, '\\u003c')
  const _origin = getAssetOrigin()
  const plugins = JSON.stringify(pluginsConfig).replace(/</g, '\\u003c')
  const scales = JSON.stringify(scalesConfig).replace(/</g, '\\u003c')
  const chartSrc = `<!doctype html><html><head><meta charset="utf-8"><script src="${_origin}/vendor/chart.js/dist/chart.umd.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:transparent;overflow:hidden}</style></head><body><canvas id="c" style="width:100%;height:100%"></canvas><script>new Chart(document.getElementById('c'),{type:'${runtimeChartType}',data:{labels:${labels},datasets:${datasets}},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:${plugins},scales:${scales}}})</script></body></html>`
  return `<iframe${wrap} data-ns-generated-frame="true" srcdoc="${escapeSrcdoc(chartSrc)}" style="${escapeHtml(`${style}border:none;background:transparent;`)}" scrolling="no"></iframe>`
}

function renderCallout(el, style, wrap, vis) {
  const bg = el.calloutColor || '#ef4444'
  const tc = resolveColorField(el.calloutTextColor, 'callout', 'calloutTextColor') || '#ffffff'
  const fs = el.fontSize || 16
  return `<div${wrap} style="${escapeHtml(`${style}${vis}border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:${tc};font-size:calc(${fs}px * var(--font-zoom, 1));font-weight:700;font-family:-apple-system,sans-serif;`)}">${escapeHtml(el.calloutNumber || 1)}</div>`
}

function renderIcon(el, style, wrap, vis) {
  const color = resolveColorField(el.iconColor, 'icon', 'iconColor') || '#ffffff'
  const sw = el.iconStrokeWidth || 2

  // Normalize icon name in case it has an 'Icon' suffix (from lucide-react aliases)
  const rawName = el.iconName || 'Star'
  const iconKey =
    rawName.endsWith('Icon') && rawName !== 'ImageIcon' ? rawName.replace(/Icon$/, '') : rawName
  const path = ICON_PATHS[iconKey] || ICON_PATHS['Star'] || ''
  const ip = svgPaint('stroke', color)
  const ipStyle = ip.style ? ` style="${escapeHtml(ip.style)}"` : ''
  return `<div${wrap} style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;`)}"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none"${ip.attr} stroke-width="${escapeHtml(sw)}" stroke-linecap="round" stroke-linejoin="round"${ipStyle}>${path}</svg></div>`
}

function renderLatex(el, style, wrap, vis, opts) {
  const content = el.content || ''
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)
  const renderContent = hasTikz ? content : normalizeLatexForRender(content)
  const fontSize = safeCssFontSize(el.latexFontSize || el.fontSize) || 16
  const textColor = safeCssColor(
    el.latexColor || resolveColorField(el.textColor, 'latex', 'textColor') || el.fontColor,
    '#ffffff'
  )

  // [FIX #13] If _fallbackSrc is available and content doesn't look like valid LaTeX, use image fallback.
  // This handles malformed LaTeX strings imported from PPTX that KaTeX cannot render.
  const hasFallbackImg =
    el._fallbackSrc && /^(data:image|\/uploads\/)/.test(String(el._fallbackSrc))
  const looksLikeLatex = /\\[a-zA-Z]+|[\^$_]|\\frac|\\sqrt|\\begin|\\left|\\right/.test(content)
  if (hasFallbackImg && !looksLikeLatex) {
    const fallbackSrc = absoluteSrc(el._fallbackSrc)
    return `<div${wrap} style="${escapeHtml(`${style}${vis}`)}"><img src="${fallbackSrc}" alt="Math equation" style="display:block;width:100%;height:100%;object-fit:contain;" /></div>`
  }

  if (opts.forPrint) {
    if (hasTikz) {
      const _origin = getAssetOrigin()
      const wrappedContent = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" type="text/css" href="${_origin}/vendor/tikzjax/fonts.css"><script src="${_origin}/vendor/tikzjax/tikzjax.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1))}svg{max-width:100%;max-height:100%}</style></head><body><script type="text/tikz" data-disable-cache="true">${escapeScriptElementContent(content)}</script></body></html>`
      return `<iframe${wrap} data-pdf-iframe="${encodeURIComponent(wrappedContent)}" style="${escapeHtml(`${style}border:none;background:transparent;`)}" scrolling="no"></iframe>`
    }
    return `<div${wrap} style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1));`)}"><span data-math-latex="${escapeHtml(renderContent)}" data-math-display="true"></span></div>`
  }

  if (!hasTikz) {
    return `<div${wrap} style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1));`)}"><span data-math-latex="${escapeHtml(renderContent)}" data-math-display="true"></span></div>`
  }

  const _origin = getAssetOrigin()
  const tikzScript = hasTikz
    ? `<link rel="stylesheet" type="text/css" href="${_origin}/vendor/tikzjax/fonts.css"><script src="${_origin}/vendor/tikzjax/tikzjax.js"></script>`
    : ''
  let bodyContent
  if (hasTikz) {
    bodyContent = `<script type="text/tikz" data-disable-cache="true">${escapeScriptElementContent(content)}</script>`
  } else {
    bodyContent = `<div id="m"></div><script>katex.render(${JSON.stringify(renderContent)},document.getElementById('m'),{displayMode:true,throwOnError:false})</script>`
  }
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${_origin}/vendor/katex/dist/katex.min.css"><script src="${_origin}/vendor/katex/dist/katex.min.js"></script>${tikzScript}<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:transparent;overflow:hidden;color:${textColor};font-size:calc(${fontSize}px * var(--font-zoom, 1))}.katex{font-size:1.4em;color:inherit}svg{max-width:100%;max-height:100%}</style></head><body>${bodyContent}</body></html>`
  return `<iframe${wrap} data-ns-generated-frame="true" srcdoc="${escapeSrcdoc(srcdoc)}" style="${escapeHtml(`${style}border:none;background:transparent;`)}" scrolling="no"></iframe>`
}

function renderMediaAccessibility(el) {
  const normalized = normalizeMediaAccessibility(el)
  const tracks = normalized.tracks
    .map((track) => {
      const attrs = [
        `src="${escapeHtml(absoluteSrc(track.src))}"`,
        `kind="${track.kind}"`,
        track.srcLang ? `srclang="${escapeHtml(track.srcLang)}"` : '',
        track.label ? `label="${escapeHtml(track.label)}"` : '',
        track.default ? 'default' : '',
      ]
        .filter(Boolean)
        .join(' ')
      return `<track ${attrs}>`
    })
    .join('')
  const descriptions = [
    normalized.audioDescription
      ? `<p class="ns-media-audio-description" style="${escapeHtml(MEDIA_CAPTION_CSS)}">${escapeHtml(normalized.audioDescription)}</p>`
      : '',
    normalized.transcript
      ? `<details class="ns-media-transcript" style="${escapeHtml(MEDIA_CAPTION_CSS)}"><summary style="${escapeHtml(MEDIA_CAPTION_TEXT_CSS)}">Transcript</summary><p style="${escapeHtml(MEDIA_CAPTION_TEXT_CSS)}">${escapeHtml(normalized.transcript)}</p></details>`
      : '',
  ].join('')
  return { normalized, tracks, descriptions }
}

function renderVideo(el, style, wrap, vis, opts) {
  if (opts.forPrint) {
    return `<div style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:calc(16px * var(--font-zoom, 1));`)}">&#9654; Video</div>`
  }
  const { normalized, tracks, descriptions } = renderMediaAccessibility(el)
  const videoSrc = sanitizeMediaSrc(
    Object.prototype.hasOwnProperty.call(normalized, 'src') ? normalized.src : normalized.videoUrl
  )
  const src = absoluteSrc(videoSrc)
  const attrs = []
  if (normalized.controls !== false) attrs.push('controls')
  if (normalized.autoplay) attrs.push('autoplay')
  if (normalized.muted) attrs.push('muted')
  const poster = sanitizeMediaSrc(normalized.poster)
  const posterAttr = poster ? ` poster="${escapeHtml(absoluteSrc(poster))}"` : ''
  const mediaStyle = descriptions ? style.replace('overflow:hidden;', 'overflow:visible;') : style
  return `<div${wrap} style="${escapeHtml(mediaStyle)}"><video src="${escapeHtml(src)}" ${attrs.join(' ')}${posterAttr}${mediaPlaybackAttribute(normalized)} style="${escapeHtml(`width:100%;height:100%;object-fit:${normalized.objectFit || 'contain'};display:block;`)}">${tracks}</video>${descriptions}</div>`
}

function renderAudio(el, style, wrap, vis, opts) {
  if (opts.forPrint) {
    return `<div style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);color:rgba(255,255,255,0.4);font-family:sans-serif;font-size:calc(16px * var(--font-zoom, 1));`)}">&#9835; Audio</div>`
  }
  const { normalized, tracks, descriptions } = renderMediaAccessibility(el)
  const src = absoluteSrc(sanitizeMediaSrc(normalized.src))
  const attrs = []
  if (normalized.controls !== false) attrs.push('controls')
  if (normalized.autoplay) attrs.push('autoplay')
  if (normalized.muted) attrs.push('muted')
  const mediaStyle = descriptions ? style.replace('overflow:hidden;', 'overflow:visible;') : style
  return `<div${wrap} style="${escapeHtml(mediaStyle)}"><div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"><audio src="${escapeHtml(src)}" ${attrs.join(' ')}${mediaPlaybackAttribute(normalized)} style="width:90%;">${tracks}</audio></div>${descriptions}</div>`
}

function renderTable(el, style, wrap, vis) {
  const data = Array.isArray(el.data) && el.data.length ? el.data : [['']]
  const headerBg =
    resolveColorField(el.headerBgColor, 'table', 'headerBgColor') || 'rgba(99,102,241,0.3)'
  const cellBg = resolveColorField(el.cellBgColor, 'table', 'cellBgColor') || 'transparent'
  const borderColor =
    resolveColorField(el.borderColor, 'table', 'borderColor') || 'rgba(20,20,19,0.22)'
  const borderWidth = el.borderWidth ?? 1
  const textColor = resolveColorField(el.textColor, 'table', 'textColor') || '#141413'
  const headerTextColor =
    resolveColorField(el.headerTextColor, 'table', 'headerTextColor') || textColor
  const tableBorderStyle = safeBorderStyle(el.borderStyle)
  const fontSize = el.fontSize || 14
  const cellPadding = el.cellPadding ?? 8
  const cellStyles = el.cellStyles || {}
  const columnWidths = resolveTableDimensions(el.colWidths, Number(el.width))
  const rowHeights = resolveTableDimensions(el.rowHeights, Number(el.height))
  const colgroup = columnWidths
    ? `<colgroup>${columnWidths.map((width) => `<col style="${escapeHtml(`width:${width}px`)}" />`).join('')}</colgroup>`
    : ''
  const borderCss = (ri, ci) => {
    const borders = cellStyles.borders?.[ri]?.[ci]
    if (!borders) return `border:${borderWidth}px ${tableBorderStyle} ${borderColor};`
    return ['top', 'right', 'bottom', 'left']
      .map((side) => {
        const border = borders[side] || {}
        const width = Number.isFinite(Number(border.width))
          ? Math.max(0, Number(border.width))
          : borderWidth
        const style = safeBorderStyle(border.style ?? el.borderStyle)
        const color = safeCssColor(border.color, borderColor)
        return `border-${side}:${width}px ${style} ${color};`
      })
      .join('')
  }
  const { spans, covered } = resolveMergedCells(el.mergedCells)
  const rows = data
    .map((row, ri) => {
      const cells = (Array.isArray(row) ? row : [])
        .map((cell, ci) => {
          if (covered.has(`${ri}:${ci}`)) return ''
          const span = spans.get(`${ri}:${ci}`)
          const spanAttrs = span
            ? `${span.colSpan > 1 ? ` colspan="${span.colSpan}"` : ''}${span.rowSpan > 1 ? ` rowspan="${span.rowSpan}"` : ''}`
            : ''
          const isHeader = el.headerRow && ri === 0
          const bg = safeCssColor(cellStyles.bgColors?.[ri]?.[ci], isHeader ? headerBg : cellBg)
          const color = safeCssColor(
            cellStyles.textColors?.[ri]?.[ci],
            isHeader ? headerTextColor : textColor
          )
          const bold = cellStyles.isBold?.[ri]?.[ci]
          const align = ['left', 'center', 'right', 'justify'].includes(
            cellStyles.aligns?.[ri]?.[ci]
          )
            ? cellStyles.aligns[ri][ci]
            : 'left'
          const verticalAlign = ['top', 'middle', 'bottom'].includes(cellStyles.vAligns?.[ri]?.[ci])
            ? cellStyles.vAligns[ri][ci]
            : 'top'
          const cellFontSize = safeCssFontSize(cellStyles.fontSizes?.[ri]?.[ci]) || fontSize
          const cellFontFamily = safeCssFontFamily(cellStyles.fontFamilies?.[ri]?.[ci])
          const familyCss = cellFontFamily ? `font-family:${cellFontFamily};` : ''
          const weightCss =
            bold != null
              ? `font-weight:${bold ? 600 : 400};`
              : isHeader
                ? `font-weight:${el.headerIsBold === false ? 400 : 600};`
                : ''
          return `<td${spanAttrs} style="${escapeHtml(`padding:${cellPadding}px;${borderCss(ri, ci)}background:${bg};color:${color};font-size:calc(${cellFontSize}px * var(--font-zoom, 1));${familyCss}${weightCss}text-align:${align};vertical-align:${verticalAlign};white-space:pre-wrap;`)}">${escapeHtml(cell ?? '')}</td>`
        })
        .join('')
      const rowHeight = rowHeights?.[ri]
      const rowStyle = rowHeight ? ` style="${escapeHtml(`height:${rowHeight}px`)}"` : ''
      return `<tr${rowStyle}>${cells}</tr>`
    })
    .join('')
  return `<div${wrap} style="${escapeHtml(`${style}${vis}overflow:auto;`)}"><table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;">${colgroup}${rows}</table></div>`
}

function renderDrawing(el, style, wrap, vis) {
  const resolvedStroke = resolveColorField(el.strokeColor, 'drawing', 'strokeColor')
  const paths = (el.paths || [])
    .map((p) => {
      const stroke = p.stroke || resolvedStroke || '#ffffff'
      const sw = p.strokeWidth ?? el.strokeWidth ?? 3
      return `<path d="${escapeHtml(p.d || '')}" ${inlineSvgPaint('stroke', stroke)} stroke-width="${escapeHtml(sw)}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${escapeHtml(p.opacity ?? 1)}"/>`
    })
    .join('')
  return `<div${wrap} style="${escapeHtml(`${style}${vis}`)}"><svg width="100%" height="100%" viewBox="${escapeHtml(`0 0 ${el.width} ${el.height}`)}" preserveAspectRatio="none" style="position:absolute;inset:0;">${paths}</svg></div>`
}

function renderLine(el, style, wrap, vis) {
  const lineStyle = style.replace('overflow:hidden;', 'overflow:visible;')
  const color = resolveColorField(el.stroke, 'line', 'stroke') || '#ffffff'
  const lp = svgPaint('fill', color) // marker paint: var via style, hex via attr
  const markerPaint = `${lp.attr}${lp.style ? ` style="${escapeHtml(lp.style)}"` : ''}`
  const strokePaint = svgPaint('stroke', color)
  const pathStyle = strokePaint.style ? ` style="${escapeHtml(strokePaint.style)}"` : ''
  const sw = el.strokeWidth || 2
  const dash = el.dashArray ? ` stroke-dasharray="${escapeHtml(el.dashArray)}"` : ''
  const x1 = el.x1 ?? 0,
    y1 = el.y1 ?? el.height / 2
  const x2 = el.x2 ?? el.width,
    y2 = el.y2 ?? el.height / 2
  const uid = `l${hashId(el.id || 'l')}`
  const startType = el.arrowStart || 'none'
  const endType = el.arrowEnd || 'none'
  let defs = ''
  let ms = '',
    me = ''
  const mkArrow = (id) =>
    `<marker id="${id}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="strokeWidth"><polygon points="0 0,10 3.5,0 7"${markerPaint}/></marker>`
  const mkDiamond = (id) =>
    `<marker id="${id}" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto" markerUnits="strokeWidth"><polygon points="5 0,10 5,5 10,0 5"${markerPaint}/></marker>`
  const mkCircle = (id) =>
    `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth"><circle cx="4" cy="4" r="3"${markerPaint}/></marker>`
  const mkSquare = (id) =>
    `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth"><rect x="1" y="1" width="6" height="6"${markerPaint}/></marker>`
  const markerFns = { arrow: mkArrow, diamond: mkDiamond, circle: mkCircle, square: mkSquare }
  if (startType !== 'none' && markerFns[startType]) {
    const sid = `ms-${uid}`
    defs += markerFns[startType](sid)
    ms = ` marker-start="url(#${sid})"`
  }
  if (endType !== 'none' && markerFns[endType]) {
    const eid = `me-${uid}`
    defs += markerFns[endType](eid)
    me = ` marker-end="url(#${eid})"`
  }
  const pathD =
    el.cx != null && el.cy != null
      ? `M ${x1} ${y1} Q ${el.cx} ${el.cy} ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`
  const pad = Math.max(12, Math.ceil(sw * 6))
  const svgW = Number(el.width || 0) + pad * 2
  const svgH = Number(el.height || 0) + pad * 2
  return `<div${wrap} style="${escapeHtml(`${lineStyle}${vis}`)}"><svg width="${svgW}" height="${svgH}" viewBox="${-pad} ${-pad} ${svgW} ${svgH}" preserveAspectRatio="none" style="${escapeHtml(`position:absolute;left:${-pad}px;top:${-pad}px;overflow:visible;`)}"><defs>${defs}</defs><path d="${escapeHtml(pathD)}"${strokePaint.attr} stroke-width="${escapeHtml(sw)}" fill="none" stroke-linecap="round"${dash}${ms}${me}${pathStyle}/></svg></div>`
}

function renderSvg(el, style, wrap, vis) {
  const svgContent = applySvgPaintOverrides(el.content || '', {
    fillOverride: el.fillOverride,
    strokeOverride: el.strokeOverride,
  })
  return `<div${wrap} style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;`)}">${sanitizeSvgHtml(svgContent)}</div>`
}

function renderQrcode(el, style, wrap, vis, opts) {
  const data = el.qrData || 'https://example.com'
  const fg = safeCssColor(el.qrColor, '#000000')
  const bgColor = safeCssColor(el.qrBgColor, '#ffffff')
  const err = ['L', 'M', 'Q', 'H'].includes(el.qrErrorLevel) ? el.qrErrorLevel : 'M'

  if (opts.forPrint) {
    const canvasId = `qr-${el.id || Math.random().toString(36).slice(2, 8)}`
    const qrConfig = JSON.stringify({ data, fg, bg: bgColor, err }).replace(/</g, '\\u003c')
    return `<div style="${escapeHtml(`${style}${vis}display:flex;align-items:center;justify-content:center;background:${bgColor};border-radius:${el.borderRadius || 0}px;overflow:hidden;`)}"><canvas id="${escapeHtml(canvasId)}" data-qr-config='${escapeHtml(qrConfig)}' style="width:90%!important;height:90%!important;object-fit:contain;"></canvas></div>`
  }

  const _origin = getAssetOrigin()
  const qrSrc = `<!doctype html><html><head><meta charset="utf-8"><script src="${_origin}/vendor/qrcode/qrcode.min.js"></script><style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;background:${bgColor};overflow:hidden;display:flex;align-items:center;justify-content:center}canvas{width:100%!important;height:100%!important;object-fit:contain}</style></head><body><canvas id="c"></canvas><script>QRCode.toCanvas(document.getElementById('c'), ${serializeEducationConfig(data)}, { color: { dark: ${serializeEducationConfig(fg)}, light: ${serializeEducationConfig(bgColor)} }, errorCorrectionLevel: '${err}', margin: 1, width: 500 });</script></body></html>`
  return `<iframe${wrap} data-ns-generated-frame="true" srcdoc="${escapeSrcdoc(qrSrc)}" style="${escapeHtml(`${style}border:none;background:transparent;border-radius:${el.borderRadius || 0}px;overflow:hidden;`)}" scrolling="no"></iframe>`
}

function renderTimeline(el, style, wrap, vis, _opts) {
  const w = Number(el.width) || 800
  const h = Number(el.height) || 400
  const lineY = h * 0.5
  const pad = 30
  const lineColor = resolveColorField(el.lineColor, 'timeline', 'lineColor') || '#6366f1'
  const dotColor = resolveColorField(el.dotColor, 'timeline', 'dotColor') || lineColor
  const textColor = resolveColorField(el.textColor, 'timeline', 'textColor') || '#fff'
  const lineStroke = inlineSvgPaint('stroke', lineColor)
  const dotFill = inlineSvgPaint('fill', dotColor)
  const textFill = inlineSvgPaint('fill', textColor)
  const fs = Number(el.fontSize) || 11
  const startDate = el.timelineStart ?? el.startDate ?? '2000'
  const endDate = el.timelineEnd ?? el.endDate ?? '2025'
  const items = (el.events || el.items || []).map((item) => ({
    ...item,
    label: item.title ?? item.label ?? '',
    image: item.imageUrl ?? item.image ?? '',
    connectorLength: item.connectorLength ?? item.connectorOffset ?? el.connectorOffset ?? 0,
  }))
  const spacing = el.tickSpacing || 'auto'
  const yearMode =
    ['year', '10year', '100year', '1000year'].includes(spacing) ||
    (spacing === 'auto' && /^-?\d+$/.test(String(startDate)))

  const datePos = (date) => parseDatePos(date, startDate, endDate, w, pad, yearMode)
  const ticks = buildTicks(startDate, endDate, spacing, yearMode, w - pad * 2, fs - 1)

  let svg = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;overflow:visible">`
  svg += `<line x1="${pad}" y1="${lineY}" x2="${w - pad}" y2="${lineY}" ${lineStroke} stroke-width="2"/>`
  ticks.forEach((t) => {
    const x = datePos(t.date)
    svg += `<line x1="${x}" y1="${lineY - 4}" x2="${x}" y2="${lineY + 4}" ${lineStroke} stroke-width="1.5"/>`
    svg += `<text x="${x}" y="${lineY + 14}" text-anchor="end" ${textFill} font-size="${fs - 1}" opacity="0.5" transform="rotate(-45,${x},${lineY + 14})">${escapeHtml(t.label)}</text>`
  })
  items.forEach((item) => {
    const x = datePos(item.date)
    const isTop = item.side !== 'bottom'
    const cl = Number(item.connectorLength) || 0
    const cardY = isTop ? 8 - cl : lineY + 28 + cl
    const cardH = isTop ? lineY - 36 : h - lineY - 36
    const connY1 = isTop ? cardY + cardH : lineY
    const connY2 = isTop ? lineY : cardY
    const imgH = item.image ? Math.min(cardH * 0.55, 60) : 0
    svg += `<line x1="${x}" y1="${connY1}" x2="${x}" y2="${connY2}" ${lineStroke} stroke-width="1" stroke-dasharray="3,2" opacity="0.5"/>`
    svg += `<circle cx="${x}" cy="${lineY}" r="4" ${dotFill}/>`
    if (isTop) {
      let ty = cardY + fs
      svg += `<text x="${x}" y="${ty}" text-anchor="middle" ${textFill} font-size="${fs}" font-weight="600">${escapeHtml(item.label || '')}</text>`
      ty += fs + 2
      if (item.description) {
        svg += `<text x="${x}" y="${ty}" text-anchor="middle" ${textFill} font-size="${fs - 1}" opacity="0.6">${escapeHtml(item.description)}</text>`
        ty += fs
      }
      const dateLabel = yearMode ? String(parseInt(item.date) || item.date) : item.date
      svg += `<text x="${x}" y="${ty}" text-anchor="middle" ${textFill} font-size="${fs - 2}" opacity="0.35">${escapeHtml(dateLabel)}</text>`
      ty += 4
      if (item.image) {
        svg += `<image href="${escapeHtml(item.image)}" x="${x - 40}" y="${ty}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`
      }
    } else {
      if (item.image) {
        svg += `<image href="${escapeHtml(item.image)}" x="${x - 40}" y="${cardY}" width="80" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`
      }
      svg += `<text x="${x}" y="${cardY + imgH + fs + 2}" text-anchor="middle" ${textFill} font-size="${fs}" font-weight="600">${escapeHtml(item.label || '')}</text>`
      if (item.description) {
        svg += `<text x="${x}" y="${cardY + imgH + fs * 2 + 4}" text-anchor="middle" ${textFill} font-size="${fs - 1}" opacity="0.6">${escapeHtml(item.description)}</text>`
      }
      const dateLabel = yearMode ? String(parseInt(item.date) || item.date) : item.date
      svg += `<text x="${x}" y="${cardY + imgH + fs * (item.description ? 3 : 2) + 6}" text-anchor="middle" ${textFill} font-size="${fs - 2}" opacity="0.35">${escapeHtml(dateLabel)}</text>`
    }
  })
  svg += '</svg>'

  return `<div${wrap} style="${escapeHtml(`${style}${vis}overflow:visible;`)}">${svg}</div>`
}

function isPluginType(type) {
  return typeof type === 'string' && type.startsWith('plugin:')
}

function isSafePluginAssetPath(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value)
}

function isSafeSandboxFile(value) {
  return (
    typeof value === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/.test(value) &&
    !value.includes('..')
  )
}

function getPluginFallbackText(el) {
  const data = el.pluginData || {}
  if (data.value !== undefined) return `${data.prefix || ''}${data.value}${data.suffix || ''}`
  return el.pluginRuntime?.label || el.pluginSlug || el.type.replace('plugin:', '')
}

function renderPluginFallback(el, style, wrap, vis) {
  const label = escapeHtml(el.pluginRuntime?.label || 'Plugin')
  const text = escapeHtml(getPluginFallbackText(el))
  return `<div${wrap} data-plugin-fallback="true" style="${escapeHtml(`${style}${vis}display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(15,23,42,0.72);border:1px solid rgba(148,163,184,0.35);border-radius:6px;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;`)}"><strong style="font-size:calc(18px * var(--font-zoom, 1));">${text}</strong><span style="font-size:calc(12px * var(--font-zoom, 1));opacity:.72;">${label}</span></div>`
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
  const dependencies = validateHtmlDependencies(el.pluginRuntime?.htmlDependencies)
  const declaration = dependencies
    ? ` data-html-dependencies="${escapeHtml(JSON.stringify(dependencies))}"`
    : ''
  return `<div${wrap} data-plugin-runtime="true" style="${escapeHtml(`${style}${vis}`)}"><iframe title="${title}" data-plugin-src="${src}"${declaration} data-plugin-data="${dataJson}" data-plugin-width="${escapeHtml(el.width)}" data-plugin-height="${escapeHtml(el.height)}" sandbox="${HTML_SANDBOX}" referrerpolicy="no-referrer" style="width:100%;height:100%;border:none;background:transparent;" scrolling="no"></iframe></div>`
}

// Print is an inert authored snapshot; non-print roots mount the shared DOM runtime.
function renderGame(el, style, wrap, vis, opts = {}) {
  const gameType = el.gameType || 'name-picker'
  const privateConfig = opts.gameConfigs?.get(el.id) || normalizeGameConfig(el, gameType)
  if (opts.forPrint)
    return `<div${wrap} style="${escapeHtml(`${style}${vis}`)}">${renderStaticGameSnapshot({ ...el, gameType, [gameType]: privateConfig }, { teacherReveal: opts.teacherReveal === true, designTokens: opts.designTokens })}</div>`
  const educationView = opts.educationView || 'local'
  const gameConfig =
    educationView === 'audience' ? projectPublicGameConfig(gameType, privateConfig) : privateConfig
  const title = gameConfig.title || el.title || GAME_CATALOG[gameType]?.label || 'Game'
  const label = escapeHtml(title)
  const badge = escapeHtml(gameType)
  const publicContent = staticGameContent(gameType, gameConfig)
    .filter((row) => typeof row.text === 'string' && row.text)
    .map((row) => {
      const src = sanitizeMediaSrc(row.media?.src)
      const image = src
        ? `<img src="${escapeHtml(absoluteSrc(src))}" alt="${escapeHtml(row.media?.alt || '')}" style="max-width:100%;max-height:120px;object-fit:contain;" />`
        : ''
      return `<li>${escapeHtml(row.text)}${image}</li>`
    })
    .join('')
  const snapshot = publicContent
    ? `<ul style="max-width:90%;max-height:65%;overflow:auto;margin:0;padding-left:20px;font-size:calc(13px * var(--font-zoom, 1));">${publicContent}</ul>`
    : ''
  const contents = `<strong>${label}</strong><span>${badge}</span>${snapshot}`
  const baseStyle = `${style}${vis}background:${safeCssColor(el.backgroundColor, '#1a1a2e')};border:1px solid rgba(148,163,184,0.35);border-radius:8px;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;`
  const action = serializeElementAction(el.action)
  const actionAttrs = action
    ? ` data-ns-action="${escapeHtml(action)}" role="button" tabindex="0"`
    : ''
  return `<div${wrap}${actionAttrs} data-ns-game="true" data-ns-game-type="${badge}" data-ns-education-view="${educationView}" style="${escapeHtml(baseStyle)}"><script type="application/json" data-ns-game-config>${serializeEducationConfig(gameConfig)}</script><div data-ns-game-static style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">${contents}</div><div data-ns-game-ui></div></div>`
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
  game: renderGame,
}

/**
 * Render a single element to HTML string.
 * @param {Object} el - The element data
 * @param {Object} slide - Parent slide (for autoAnimate data-id)
 * @param {Object} opts - { forPrint: boolean, isHidden: boolean }
 */
function renderElement(el, slide, opts = {}) {
  const renderOpts =
    opts.slideBackground === undefined ? { ...opts, slideBackground: slide?.background } : opts
  const style = buildBaseStyle(el, renderOpts)
  const { dataIdAttr, fragClass, fragIdx } = renderOpts.forPrint
    ? { dataIdAttr: '', fragClass: '', fragIdx: '' }
    : buildWrapperAttrs(el, slide)
  const exportIdAttr =
    renderOpts.exportElementIds && el.id ? ` data-export-element-id="${escapeHtml(el.id)}"` : ''
  const identity =
    !renderOpts.forPrint && el.id
      ? ` data-ns-element-id="${escapeHtml(el.id)}" data-ns-initial-visibility="${el.initialVisibility === 'hidden' ? 'hidden' : 'visible'}"${el.initialVisibility === 'hidden' ? ' hidden' : ''}`
      : ''
  const wrap = `${exportIdAttr}${identity}${dataIdAttr}${fragClass}${fragIdx}`
  const vis = renderOpts.isHidden ? 'visibility:hidden;' : ''

  const renderer = isPluginType(el.type) ? renderPlugin : RENDERERS[el.type]
  if (!renderer) return ''
  return `${renderer(el, style, wrap, vis, renderOpts)}${renderActionSurface(el, style, renderOpts)}`
}

/**
 * Render all elements of a slide, sorted by zIndex.
 */
function renderSlideElements(slide, opts = {}) {
  const { effectiveLines } = resolveConnectorGeometry(slide?.elements || [])
  return (slide.elements || [])
    .filter((el) => !(el.hidden || false))
    .slice()
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    .map((sourceElement) => {
      const el = sourceElement.id
        ? effectiveLines.get(sourceElement.id) || sourceElement
        : sourceElement
      const elementOpts = {
        ...opts,
        slideBackground:
          opts.slideBackground === undefined ? slide.background : opts.slideBackground,
      }
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
  getPlaybackRate,
  getAssetOrigin,
}
