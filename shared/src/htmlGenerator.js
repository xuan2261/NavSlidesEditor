const {
  getPresenterToolsHead,
  getPresenterToolsScripts,
  getPresenterToolsPlugins,
  getPresenterToolsConfig,
  getPresenterToolsBody,
  getPresenterToolsInlineJS,
} = require('./presenterTools.js')
const { renderSlideElements, escapeHtml, absoluteSrc } = require('./element-renderers.js')
const { getSlideNotes } = require('./slideNotes.js')
const {
  DEFAULT_TOKENS,
  tokensToCssVars,
  mergeTokens,
  presentationUsesTokens,
} = require('./design-tokens.js')
const { getFxModule, buildFxRuntimeScript } = require('./fx/index.js')
const { resolveChartBackground } = require('./chart-colors.js')
const { buildLivePresenterRuntime } = require('./live-presenter-runtime.js')
const {
  normalizeTransition,
  normalizeTransitionDirection,
  normalizeTransitionDuration,
  normalizeTransitionSpeed,
} = require('./transition-settings.js')

function formatGradientCss(bg) {
  if (!bg || bg.type !== 'gradient') return ''
  if (bg.gradient) return bg.gradient
  const stops = Array.isArray(bg.stops) ? bg.stops : []
  if (!stops.length) return ''
  const angle = Number(bg.angle) || 0
  const cssStops = stops
    .map((stop) => {
      // Stop offsets follow the 0-1 convention used everywhere else (shapeUtils,
      // export-pptx-raster, the canvas gradient renderer). Convert to a CSS percent.
      const offset = Number(stop.offset)
      const percent = Number.isFinite(offset) ? Math.round(offset * 100) : 0
      return `${stop.color || '#000000'} ${percent}%`
    })
    .join(', ')
  return `linear-gradient(${angle}deg, ${cssStops})`
}

function getSlideTransitionAttrs(slide) {
  if (!slide) return ''
  const attrs = []
  const transition = normalizeTransition(slide.transition, null)
  const direction = normalizeTransitionDirection(slide.transitionDirection)
  const duration = normalizeTransitionDuration(slide.transitionDuration)
  if (transition) attrs.push(`data-transition="${escapeHtml(transition)}"`)
  if (slide.transitionDirection && direction !== 'default') {
    attrs.push(`data-transition-direction="${escapeHtml(direction)}"`)
  }
  if (duration !== null) attrs.push(`data-transition-duration="${duration}"`)
  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

function getSlideTransitionStyle(slide) {
  const duration = normalizeTransitionDuration(slide?.transitionDuration)
  return duration === null ? '' : `transition-duration:${duration}ms;`
}

const TRANSITION_METADATA_CSS = `    /* Reveal does not consume NavSlides direction/duration metadata. These
       selectors make the application-level settings operative for slide moves. */
    .reveal .slides section[data-transition-direction="left"].future { transform: translate3d(100%, 0, 0) !important; }
    .reveal .slides section[data-transition-direction="left"].past { transform: translate3d(-100%, 0, 0) !important; }
    .reveal .slides section[data-transition-direction="right"].future { transform: translate3d(-100%, 0, 0) !important; }
    .reveal .slides section[data-transition-direction="right"].past { transform: translate3d(100%, 0, 0) !important; }
    .reveal .slides section[data-transition-direction="up"].future { transform: translate3d(0, 100%, 0) !important; }
    .reveal .slides section[data-transition-direction="up"].past { transform: translate3d(0, -100%, 0) !important; }
    .reveal .slides section[data-transition-direction="down"].future { transform: translate3d(0, -100%, 0) !important; }
    .reveal .slides section[data-transition-direction="down"].past { transform: translate3d(0, 100%, 0) !important; }
    /* Duration is emitted inline on each section so Reveal's transition
       shorthand cannot replace the configured millisecond value. */
    .reveal .slides section[data-transition-duration] { transition-property: transform, opacity !important; }
`

function presentationUsesTransitionMetadata(presentation) {
  return (presentation?.slides || []).some((slide) =>
    [slide, ...(slide?.children || [])].some((section) =>
      normalizeTransitionDirection(section?.transitionDirection) !== 'default' ||
      normalizeTransitionDuration(section?.transitionDuration) !== null
    )
  )
}

function getSectionBackgroundStyle(background, usesTokens) {
  return usesTokens && (!background || background.type === 'none') ? 'background:var(--ns-bg);' : ''
}

function getPresentChartBackground(slide, deckTokens, usesTokens) {
  const slideTokens = mergeTokens(deckTokens, slide?.designTokens)
  const fallbackColor = slide?.background?.type === 'fx'
    ? '#0d0221'
    : usesTokens
      ? slideTokens.colors?.bg
      : '#000000'
  return resolveChartBackground(slide?.background, fallbackColor)
}

function getPrintChartBackground(slide, deckTokens) {
  const slideTokens = mergeTokens(deckTokens, slide?.designTokens)
  return resolveChartBackground(slide?.background, slideTokens.colors?.bg || '#1e1e2e', {
    preferFallback: true,
  })
}

/**
 * Build the deck-level :root token block (full merged DEFAULT + deck tokens so
 * every --ns-* resolves) plus per-slide override blocks keyed by data-slide-idx.
 * Returns { styleBlock, slideOverrideIdx } where slideOverrideIdx is a Set of
 * slide indices that carry an override (used to stamp data-slide-idx).
 */
function buildTokenStyleBlock(presentation) {
  const deckTokens = mergeTokens(DEFAULT_TOKENS, presentation.designTokens)
  let css = `    :root{ ${tokensToCssVars(deckTokens)} }\n`
  const slideOverrideIdx = new Set()
  ;(presentation.slides || []).forEach((slide, slideIndex) => {
    if (slide && slide.designTokens) {
      slideOverrideIdx.add(String(slideIndex))
      const merged = mergeTokens(deckTokens, slide.designTokens)
      css += `    [data-slide-idx="${slideIndex}"]{ ${tokensToCssVars(merged)} }\n`
    }
    ;(slide?.children || []).forEach((child, childIndex) => {
      if (child && child.designTokens) {
        const childKey = `${slideIndex}.${childIndex}`
        slideOverrideIdx.add(childKey)
        const merged = mergeTokens(deckTokens, child.designTokens)
        css += `    [data-slide-idx="${childKey}"]{ ${tokensToCssVars(merged)} }\n`
      }
    })
  })
  return { styleBlock: `  <style>\n${css}  </style>`, slideOverrideIdx }
}

function getPluginRuntimeInitScript() {
  return `
      function initPluginRuntime(root) {
        var iframe = root.querySelector('iframe');
        if (!iframe || !iframe.contentWindow) return;
        var pluginData = {};
        try { pluginData = JSON.parse(root.getAttribute('data-plugin-data') || '{}'); } catch (e) {}
        iframe.contentWindow.postMessage({
          source: 'navslides-host',
          type: 'init',
          pluginData: pluginData,
          size: { width: root.offsetWidth || 0, height: root.offsetHeight || 0 }
        }, '*');
      }
      document.querySelectorAll('[data-plugin-runtime="true"]').forEach(function(root) {
        var iframe = root.querySelector('iframe');
        if (!iframe) return;
        iframe.addEventListener('load', function() { initPluginRuntime(root); });
        setTimeout(function() { initPluginRuntime(root); }, 250);
      });
      window.addEventListener('message', function(event) {
        var message = event.data || {};
        if (message.source !== 'navslides-plugin' || message.type !== 'ready') return;
        document.querySelectorAll('[data-plugin-runtime="true"]').forEach(function(root) {
          var iframe = root.querySelector('iframe');
          if (iframe && iframe.contentWindow === event.source) initPluginRuntime(root);
        });
      });`
}

function generateRevealHTML(presentation) {
  const presentationTransition = normalizeTransition(presentation.transition, 'slide')
  const transitionSpeed = normalizeTransitionSpeed(presentation.transitionSpeed)
  const transitionSpeedConfig =
    presentation.transitionSpeed == null
      ? ''
      : `\n      transitionSpeed: '${transitionSpeed}',`
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const showPresentGrid = presentation.showPresentGrid || false
  const presentGridSize = presentation.gridSize || 40
  const footerMode = presentation.footerMode || 'basic'
  const sequenceSections = presentation.sequenceSections || []
  const footerInactiveColor = presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'
  const resW = presentation.resolution?.width || 960
  const resH = presentation.resolution?.height || 540
  const presenterTools = {
    ...presentation.presenterTools,
    _baseWidth: resW,
    _baseHeight: resH,
  }
  // Compute page numbers: only count slides where showPageNumber !== false
  const totalNumberedSlides = (presentation.slides || []).filter(
    (s) => s.showPageNumber !== false
  ).length
  let pageCounter = 0

  const usesTokens = presentationUsesTokens(presentation)
  const deckTokens = mergeTokens(DEFAULT_TOKENS, presentation.designTokens)
  const tokenInfo = usesTokens ? buildTokenStyleBlock(presentation) : null
  const slideOverrideIdx = tokenInfo ? tokenInfo.slideOverrideIdx : null
  const fxRuntimeScript = presentationUsesFx(presentation) ? buildFxRuntimeScript() : ''
  const hasGameElements = presentationUsesGameElements(presentation)
  const transitionMetadataCss = presentationUsesTransitionMetadata(presentation)
    ? TRANSITION_METADATA_CSS
    : ''

  const slidesHtml = presentation.slides
    .map((slide, slideIndex) => {
      const bgAttrs = getBackgroundAttrs(slide.background)
      const slideIdxAttr =
        slideOverrideIdx && slideOverrideIdx.has(String(slideIndex))
          ? ` data-slide-idx="${slideIndex}"`
          : ''
      const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate' : ''
      const transitionAttrs = getSlideTransitionAttrs(slide)
      const slideNotes = getSlideNotes(slide)
      const notes = slideNotes ? `<aside class="notes">${escapeHtml(slideNotes)}</aside>` : ''

      const elementsHtml = renderSlideElements(slide, {
        forPrint: false,
        slideBackground: getPresentChartBackground(slide, deckTokens, usesTokens),
      })

      // Page numbering: increment counter only for slides with showPageNumber !== false
      const slideHasPageNum = slide.showPageNumber !== false
      if (slideHasPageNum) pageCounter++
      const pageLabel =
        showPageNumbers && slideHasPageNum
          ? pageNumberFormat === 'c/t'
            ? `${pageCounter} / ${totalNumberedSlides}`
            : `${pageCounter}`
          : ''

      let footerHtml = ''
      if (footerMode === 'sequence' && sequenceSections.length > 0 && showFooter) {
        const activeIdx = slide.activeSection
        const seqSpans = sequenceSections
          .map((sec, i) => {
            const isActive = activeIdx === i
            const color = isActive ? footerColor || 'rgba(255,255,255,0.9)' : footerInactiveColor
            const weight = isActive ? 'font-weight:700;' : 'font-weight:400;'
            return `<span style="color:${color};${weight}">${escapeHtml(sec || `Section ${i + 1}`)}</span>`
          })
          .join('')
        const pageSpan = pageLabel
          ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>`
          : ''
        footerHtml = `      <div class="reveal-footer" style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;pointer-events:none;box-sizing:border-box;"><div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
        footerHtml =
          sectionLabel || pageLabel
            ? `      <div class="reveal-footer" style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>`
            : ''
      }
      const gridHtml = showPresentGrid
        ? `      <div style="position:absolute;inset:0;z-index:950;pointer-events:none;background-image:linear-gradient(to right,rgba(255,255,255,0.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,0.12) 1px,transparent 1px);background-size:${presentGridSize}px ${presentGridSize}px;"></div>`
        : ''

      const fxCanvas = getFxCanvasHtml(slide.background)
      const bgStyle = getSectionBackgroundStyle(slide.background, usesTokens)
      const sectionHtml = `    <section${autoAnimateAttr}${transitionAttrs}${bgAttrs}${slideIdxAttr} style="padding:0;width:${resW}px;height:${resH}px;overflow:hidden;font-size:calc(16px * var(--font-zoom, 1));${getSlideTransitionStyle(slide)}${bgStyle}">\n${fxCanvas}${elementsHtml}\n${footerHtml}\n${gridHtml}\n      ${notes}\n    </section>`

      // Vertical slides support: if slide has children, wrap in a vertical section stack
      if (slide.children && slide.children.length > 0) {
        const childSections = slide.children
          .map((child, childIndex) => {
            const childBg = getBackgroundAttrs(child.background)
            const childKey = `${slideIndex}.${childIndex}`
            const childIdxAttr =
              slideOverrideIdx && slideOverrideIdx.has(childKey)
                ? ` data-slide-idx="${childKey}"`
                : ''
            const childFxCanvas = getFxCanvasHtml(child.background)
            const childAutoAnimate = child.autoAnimate ? ' data-auto-animate' : ''
            const childTransitionAttrs = getSlideTransitionAttrs(child)
            const childNotesText = getSlideNotes(child)
            const childNotes = childNotesText
              ? `<aside class="notes">${escapeHtml(childNotesText)}</aside>`
              : ''
            const childElements = renderSlideElements(child, {
              forPrint: false,
              slideBackground: getPresentChartBackground(child, deckTokens, usesTokens),
            })
            const childBgStyle = getSectionBackgroundStyle(child.background, usesTokens)
            return `    <section${childAutoAnimate}${childTransitionAttrs}${childBg}${childIdxAttr} style="padding:0;width:${resW}px;height:${resH}px;overflow:hidden;font-size:calc(16px * var(--font-zoom, 1));${getSlideTransitionStyle(child)}${childBgStyle}">\n${childFxCanvas}${childElements}\n      ${childNotes}\n    </section>`
          })
          .join('\n')
        return `  <section>\n${sectionHtml}\n${childSections}\n  </section>`
      }

      return sectionHtml
    })
    .join('\n')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(presentation.title || 'Presentation')}</title>
  <link rel="stylesheet" href="/vendor/reveal.js/dist/reset.css">
  <link rel="stylesheet" href="/vendor/reveal.js/dist/reveal.css">
  <link rel="stylesheet" href="/vendor/reveal.js/dist/theme/${presentation.theme || 'black'}.css">
  <link rel="stylesheet" href="/vendor/highlight.js/styles/${codeTheme}.min.css">
  <link rel="stylesheet" href="/vendor/katex/dist/katex.min.css">
  <link rel="stylesheet" href="/reveal-overrides.css">

  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #000; }
    /* Reset reveal.js section padding/alignment so absolute positions match the 960x540 editor canvas exactly */
    .reveal .slides section { padding: 0 !important; text-align: left !important; line-height: normal !important; overflow: hidden; }
${transitionMetadataCss}    /* Neutralise theme typography overrides so presentation matches editor exactly */
    /* font-family only on section (inherited) so KaTeX's explicit rules take precedence */
    .reveal .slides section { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .reveal .slides section * { text-transform: none !important; letter-spacing: normal !important; }
    /* Explicit heading sizes ΓÇö override theme so present mode matches editor exactly */
    .reveal .slides section h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .reveal .slides section h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .reveal .slides section h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .reveal .slides section h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .reveal .slides section p  { margin: 0 0 6px; line-height: 1.5; }
    .reveal .slides section ul,
    .reveal .slides section ol { padding-left: 24px; margin: 0 0 6px; }
    .reveal .slides section li { margin-bottom: 3px; line-height: 1.5; }
    .reveal .slides section a  { text-decoration: underline; }
    /* reveal.js constrains/decorates section imgs ΓÇö reset everything */
    .reveal .slides section img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    /* Footer ΓÇö explicit CSS rule with high specificity so reveal.js theme cannot override */
    .reveal .slides section .reveal-footer,
    .reveal .slides section .reveal-footer * { font-family: ${footerFontFamily} !important; font-size: ${footerFontSize}px !important; color: ${footerColor} !important; }
  </style>
${tokenInfo ? `${tokenInfo.styleBlock}\n` : ''}  ${getPresenterToolsHead(presenterTools)}${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}
</head>
<body>
  <div class="reveal">
    <div class="slides">
${slidesHtml}
    </div>
  </div>
  ${getPresenterToolsBody(presenterTools)}
  <script src="/vendor/reveal.js/dist/reveal.js"></script>
  <script src="/vendor/reveal.js/plugin/notes/notes.js"></script>
  <script src="/vendor/reveal.js/plugin/highlight/highlight.js"></script>
  <script src="/vendor/katex/dist/katex.min.js"></script>
  ${getPresenterToolsScripts(presenterTools)}
  <script>
    var params = new URLSearchParams(window.location.search);
    var revealConfig = {
      hash: true,
      width: ${presentation.resolution?.width || 960},
      height: ${presentation.resolution?.height || 540},
      margin: 0,
      minScale: 0,
      maxScale: 10,
      center: false,
      transition: '${presentationTransition}',${transitionSpeedConfig}
      plugins: [ RevealNotes, RevealHighlight${getPresenterToolsPlugins(presenterTools)} ]${getPresenterToolsConfig(presenterTools) ? ',\n' + getPresenterToolsConfig(presenterTools) : ''}
    };
    ${presentation.autoSlide ? `revealConfig.autoSlide = ${presentation.autoSlide};` : ''}
    ${presentation.autoSlide && presentation.autoSlideLoop ? `revealConfig.loop = true;` : ''}
    ${presentation.autoSlide && presentation.kioskMode ? `revealConfig.autoSlideStoppable = false;` : ''}
    ${presentation.navigationMode ? `revealConfig.navigationMode = '${presentation.navigationMode}';` : ''}
    if (params.get('scroll') === 'true') { revealConfig.view = 'scroll'; revealConfig.scrollProgress = true; }
    Reveal.initialize(revealConfig);
    Reveal.on('ready', function() {
      document.querySelectorAll('span[data-math-latex]').forEach(function(el) {
        try {
          katex.render(el.getAttribute('data-math-latex'), el, {
            displayMode: el.getAttribute('data-math-display') === 'true',
            throwOnError: false
          });
        } catch(e) {}
      });
${getPluginRuntimeInitScript()}
${buildLivePresenterRuntime({ presentationId: presentation.id, hasGames: hasGameElements })}
    });
  </script>${getPresenterToolsInlineJS(presenterTools)}${fxRuntimeScript ? `\n${fxRuntimeScript}` : ''}
</body>
</html>`
}

function getBackgroundAttrs(bg) {
  if (!bg) return ''
  // 'fx' backgrounds render via a per-slide <canvas> (injected separately), so
  // emit no reveal bg attr — the section stays transparent over the canvas.
  if (bg.type === 'fx') return ''
  if (bg.type === 'color' && bg.color) return ` data-background-color="${bg.color}"`
  const imageSrc = bg.type === 'image' ? bg.image || bg.src : ''
  if (imageSrc)
    return ` data-background-image="${escapeHtml(absoluteSrc(imageSrc))}" data-background-size="${escapeHtml(bg.size || 'cover')}" data-background-position="${escapeHtml(bg.position || 'center')}"`
  const gradient = formatGradientCss(bg)
  if (gradient) return ` data-background-gradient="${gradient}"`
  return ''
}

const PRESENTATION_GAME_TYPES = new Set([
  'name-picker', 'hot-potato', 'jeopardy', 'four-corners', 'relay-race',
  'trivia-champ', 'scattergories', 'poll', 'word-cloud', 'matching',
])

function presentationUsesGameElements(presentation) {
  for (const slide of presentation?.slides || []) {
    for (const group of [slide, ...(slide?.children || [])]) {
      if ((group?.elements || []).some((element) => (
        element?.type === 'game' &&
        typeof element.id === 'string' &&
        PRESENTATION_GAME_TYPES.has(element.gameType)
      ))) return true
    }
  }
  return false
}

/** True if any slide (or vertical child) uses an `'fx'` background with a known module. */
function presentationUsesFx(presentation) {
  const slides = presentation.slides || []
  for (const slide of slides) {
    const groups = [slide, ...(slide.children || [])]
    for (const s of groups) {
      const fx = s && s.background && s.background.type === 'fx' && s.background.fx
      if (fx && getFxModule(fx.name)) return true
    }
  }
  return false
}

/**
 * Build the absolutely-positioned <canvas> for an `'fx'` background. Sits at
 * z-index 0 behind slide elements; the runtime starts/stops its rAF loop.
 */
function getFxCanvasHtml(bg) {
  if (!bg || bg.type !== 'fx' || !bg.fx || !getFxModule(bg.fx.name)) return ''
  const params = JSON.stringify(bg.fx.params || {}).replace(/'/g, '&#39;')
  return `<canvas data-fx-name="${escapeHtml(bg.fx.name)}" data-fx-params='${params}' style="position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;"></canvas>`
}

function downloadHTML(presentation) {
  try {
    const html = generateRevealHTML(presentation)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(presentation.title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Failed to download HTML:', err)
    if (typeof alert === 'function') alert('Failed to export HTML: ' + err.message)
  }
}

// ΓöÇΓöÇΓöÇ PDF export (print-ready HTML, one page per fragment state) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function getBgPrintStyle(bg, deckTokens) {
  const tokenBg = deckTokens?.colors?.bg || '#1e1e2e'
  if (!bg || bg.type === 'none') return `background-color:${tokenBg};`
  if (bg.type === 'color') return `background-color:${bg.color || tokenBg};`
  if (bg.type === 'gradient') return `background:${formatGradientCss(bg) || tokenBg};`
  if (bg.type === 'fx') {
    // Canvas can't print — fall back to a solid color (author override, then the
    // theme bg token, then default).
    const fallback = (bg.fx && bg.fx.fallbackColor) || (deckTokens && deckTokens.colors && deckTokens.colors.bg) || '#1e1e2e'
    return `background-color:${fallback};`
  }
  const imageSrc = bg.type === 'image' ? bg.image || bg.src : ''
  if (imageSrc) {
    const src = absoluteSrc(imageSrc)
    return `background-image:url('${src}');background-size:${bg.size || 'cover'};background-position:${bg.position || 'center'};`
  }
  return 'background-color:#1e1e2e;'
}

function generatePrintHTML(presentation, options = {}) {
  const autoPrint = options.autoPrint !== false
  const includePrintBar = options.includePrintBar !== false
  const fragmentMode = options.fragmentMode || 'expanded'
  const exportReadyDelayMs = Number(options.exportReadyDelayMs ?? (autoPrint ? 3000 : 300))
  const showFooter = presentation.showFooter || false
  const showPageNumbers = presentation.showPageNumbers || false
  const pageNumberFormat = presentation.pageNumberFormat || 'c/t'
  const codeTheme = presentation.codeTheme || 'monokai'
  const footerFontSize = presentation.footerFontSize || 14
  const footerFontFamily = presentation.footerFontFamily || '-apple-system,sans-serif'
  const footerColor = presentation.footerColor || 'rgba(255,255,255,0.65)'
  const footerMode = presentation.footerMode || 'basic'
  const sequenceSections = presentation.sequenceSections || []
  const footerInactiveColor = presentation.footerInactiveColor || 'rgba(255,255,255,0.25)'
  const resW = presentation.resolution?.width || 960
  const resH = presentation.resolution?.height || 540
  const printDeckTokens = mergeTokens(DEFAULT_TOKENS, presentation.designTokens)
  const pages = []
  let printPageCounter = 0
  presentation.slides.forEach((slide) => {
    if (fragmentMode === 'final') {
      pages.push({ slide, maxIdx: Infinity, countPageNumber: true })
      return
    }

    // Expand each slide into one page per fragment step (initial + one per unique index)
    const fragIndices = [
      ...new Set(
        (slide.elements || [])
          .filter((el) => !(el.hidden || false))
          .filter((el) => el.fragment)
          .map((el) => el.fragmentIndex || 1)
      ),
    ].sort((a, b) => a - b)
    pages.push({ slide, maxIdx: -Infinity, countPageNumber: true }) // initial: no fragments
    fragIndices.forEach((idx) => pages.push({ slide, maxIdx: idx, countPageNumber: false }))
  })
  const totalPages = pages.length

  const pagesHtml = pages
    // eslint-disable-next-line unused-imports/no-unused-vars
    .map(({ slide, maxIdx, countPageNumber }, pageIndex) => {
      const slidePrintTokens = mergeTokens(printDeckTokens, slide?.designTokens)
      const bgStyle = getBgPrintStyle(slide.background, slidePrintTokens)

      const elementsHtml = renderSlideElements(slide, {
        forPrint: true,
        maxFragIdx: maxIdx,
        exportElementIds: options.exportElementIds,
        slideBackground: getPrintChartBackground(slide, printDeckTokens),
      })

      // Per-slide page numbering
      const slideHasPageNum = slide.showPageNumber !== false
      if (slideHasPageNum && countPageNumber) printPageCounter++
      const pageLabel =
        showPageNumbers && slideHasPageNum
          ? pageNumberFormat === 'c/t'
            ? `${printPageCounter} / ${(presentation.slides || []).filter((s) => s.showPageNumber !== false).length}`
            : `${printPageCounter}`
          : ''

      let footerHtml = ''
      if (footerMode === 'sequence' && sequenceSections.length > 0 && showFooter) {
        const activeIdx = slide.activeSection
        const seqSpans = sequenceSections
          .map((sec, i) => {
            const isActive = activeIdx === i
            const color = isActive ? footerColor : footerInactiveColor
            const weight = isActive ? 'font-weight:700;' : 'font-weight:400;'
            return `<span style="color:${color};${weight}">${escapeHtml(sec || `Section ${i + 1}`)}</span>`
          })
          .join('')
        const pageSpan = pageLabel
          ? `<span style="margin-left:12px;flex-shrink:0;">${pageLabel}</span>`
          : ''
        footerHtml = `<div style="position:absolute;bottom:6px;left:16px;right:16px;z-index:900;display:flex;justify-content:center;align-items:center;font-size:calc(${footerFontSize}px * var(--font-zoom, 1));font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;"><div style="display:flex;flex:1;justify-content:space-evenly;align-items:center;">${seqSpans}</div>${pageSpan}</div>`
      } else {
        const sectionLabel = showFooter && slide.section ? escapeHtml(slide.section) : ''
        footerHtml =
          sectionLabel || pageLabel
            ? `<div style="position:absolute;bottom:8px;left:16px;right:16px;z-index:900;display:flex;justify-content:space-between;align-items:center;font-size:calc(${footerFontSize}px * var(--font-zoom, 1));color:${footerColor};font-family:${footerFontFamily};pointer-events:none;box-sizing:border-box;"><span>${sectionLabel}</span><span>${pageLabel}</span></div>`
            : ''
      }

      return `<div class="slide-page" style="${bgStyle}font-size:calc(16px * var(--font-zoom, 1));">\n${elementsHtml}\n${footerHtml}\n</div>`
    })
    .join('\n')

  const title = escapeHtml(presentation.title || 'Presentation')
  // Determine base URL for resolving relative asset paths (images, vendor, etc.)
  // When PDF HTML is opened via blob: URL, relative paths like /uploads/... won't resolve
  const baseUrl =
    options.baseUrl ||
    (typeof window !== 'undefined' && window.location && window.location.origin !== 'null'
      ? window.location.origin
      : '')
  const printBarHtml = includePrintBar
    ? `  <div id="print-bar">
    <div>
      <strong>${title}</strong>
      <span class="hint"> &nbsp;┬╖&nbsp; ${totalPages} page${totalPages !== 1 ? 's' : ''} (${fragmentMode === 'final' ? 'final fragment state' : 'fragments expanded'})
        &nbsp;┬╖&nbsp; enable <em>Background graphics</em> in print settings</span>
    </div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>`
    : ''

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} — PDF</title>${baseUrl ? `\n  <base href="${baseUrl}/">` : ''}
  <link rel="stylesheet" href="/vendor/katex/dist/katex.min.css">
  <link rel="stylesheet" href="/vendor/highlight.js/styles/${codeTheme}.min.css">
  <style>
    @page { size: ${resW}px ${resH}px; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    html { width: 100%; height: auto; overflow: visible !important; background: #000; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body { width: 100%; height: auto; overflow: visible !important; background: #000; margin: 0; padding-top: ${includePrintBar ? 48 : 0}px; print-color-adjust: exact; -webkit-print-color-adjust: exact; display: block; }
    .slide-page {
      width: ${resW}px; height: ${resH}px; position: relative; overflow: hidden;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      break-after: page; page-break-after: always;
      print-color-adjust: exact; -webkit-print-color-adjust: exact;
    }
    .slide-page:last-child { break-after: avoid; page-break-after: avoid; }
    .slide-page h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .slide-page h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .slide-page h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .slide-page h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; margin: 0 0 6px; }
    .slide-page p  { margin: 0 0 6px; line-height: 1.5; }
    .slide-page ul, .slide-page ol { padding-left: 24px; margin: 0 0 6px; }
    .slide-page li { margin-bottom: 3px; line-height: 1.5; }
    .slide-page a  { text-decoration: underline; }
    .slide-page img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    #print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: rgba(15,15,23,0.96); color: white; padding: 10px 20px;
      display: flex; align-items: center; justify-content: space-between;
      font-family: -apple-system, sans-serif; font-size: 13px;
      backdrop-filter: blur(8px); border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #print-bar button { padding: 7px 18px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 500; }
    #print-bar button:hover { background: #5254cc; }
    #print-bar .hint { color: rgba(255,255,255,0.5); font-size: 12px; }
    @media print { #print-bar { display: none; } body { margin-top: 0; padding-top: 0; } }
  </style>${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}
</head>
<body>
${printBarHtml}
${pagesHtml}
  <script src="/vendor/katex/dist/katex.min.js"></script>
  <script src="/vendor/reveal.js/plugin/highlight/highlight.js"></script>
  <script src="/vendor/chart.js/dist/chart.umd.js"></script>
  <script src="/vendor/qrcode/qrcode.min.js"></script>
  <script>
    window.__navslidesExportReady = false;
    window.addEventListener('load', function() {
      var iframePromises = [];
      // Highlight code blocks
      document.querySelectorAll('pre:not([data-code-walkthrough]) code').forEach(function(el) { try { hljs.highlightElement(el); } catch(e) {} });
      // Render KaTeX math
      document.querySelectorAll('span[data-math-latex]').forEach(function(el) {
        try { katex.render(el.getAttribute('data-math-latex'), el, { throwOnError: false, displayMode: el.getAttribute('data-math-display') === 'true' }); } catch(e) {}
      });
      // Render Chart.js charts
      document.querySelectorAll('canvas[data-chart-config]').forEach(function(el) {
        try {
          var config = JSON.parse(el.getAttribute('data-chart-config'));
          config.options = config.options || {};
          config.options.animation = false;
          new Chart(el, config);
        } catch(e) { console.error('Chart render error:', e); }
      });
      // Render QR codes
      document.querySelectorAll('canvas[data-qr-config]').forEach(function(el) {
        try {
          var cfg = JSON.parse(el.getAttribute('data-qr-config'));
          QRCode.toCanvas(el, cfg.data, {
            color: { dark: cfg.fg, light: cfg.bg },
            errorCorrectionLevel: cfg.err || 'M',
            margin: 1,
            width: Math.min(el.parentElement.offsetWidth, el.parentElement.offsetHeight, 500)
          });
        } catch(e) { console.error('QR render error:', e); }
      });
      // Initialize data-pdf-iframes via Blob URLs to prevent print layout merging
      document.querySelectorAll('iframe[data-pdf-iframe]').forEach(function(el) {
        try {
          var html = decodeURIComponent(el.getAttribute('data-pdf-iframe'));
          var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
          iframePromises.push(new Promise(function(resolve) {
            var done = false;
            var finish = function() { if (!done) { done = true; resolve(); } };
            el.addEventListener('load', function() { setTimeout(finish, 120); }, { once: true });
            setTimeout(finish, 3500);
          }));
          el.src = URL.createObjectURL(blob);
        } catch(e) { console.error('Iframe PDF init error:', e); }
      });
      Promise.all(iframePromises.concat([
        document.fonts && document.fonts.ready ? document.fonts.ready.catch(function(){}) : Promise.resolve()
      ])).then(function() {
        setTimeout(function() {
          window.__navslidesExportReady = true;
          if (${JSON.stringify(autoPrint)}) window.print();
        }, ${Math.max(0, exportReadyDelayMs)});
      });
    });
  </script>
</body>
</html>`
}

function exportPDF(presentation) {
  try {
    const html = generatePrintHTML(presentation)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 120000)
  } catch (err) {
    console.error('Failed to export PDF:', err)
    if (typeof alert === 'function') alert('Failed to export PDF: ' + err.message)
  }
}

function presentInWindow(presentation) {
  try {
    if (presentation && presentation.id) {
      // Use server endpoint so vendor assets (reveal.js, katex, etc.) resolve correctly
      window.open(`/api/presentations/${presentation.id}/present`, '_blank')
    } else {
      // Fallback for cases without an ID (e.g. template preview)
      const html = generateRevealHTML(presentation)
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 120000)
    }
  } catch (err) {
    console.error('Failed to open presentation:', err)
    if (typeof alert === 'function') alert('Failed to present: ' + err.message)
  }
}

module.exports = {
  generateRevealHTML,
  generatePrintHTML,
  downloadHTML,
  exportPDF,
  presentInWindow,
  getBackgroundAttrs,
  escapeHtml,
}
