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

function generateRevealHTML(presentation) {
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

  const slidesHtml = presentation.slides
    // eslint-disable-next-line unused-imports/no-unused-vars
    .map((slide, slideIndex) => {
      const bgAttrs = getBackgroundAttrs(slide.background)
      const autoAnimateAttr = slide.autoAnimate ? ' data-auto-animate' : ''
      const slideNotes = getSlideNotes(slide)
      const notes = slideNotes ? `<aside class="notes">${escapeHtml(slideNotes)}</aside>` : ''

      const elementsHtml = renderSlideElements(slide, { forPrint: false })

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

      const sectionHtml = `    <section${autoAnimateAttr}${bgAttrs} style="padding:0;width:${resW}px;height:${resH}px;overflow:hidden;font-size:calc(16px * var(--font-zoom, 1));">\n${elementsHtml}\n${footerHtml}\n${gridHtml}\n      ${notes}\n    </section>`

      // Vertical slides support: if slide has children, wrap in a vertical section stack
      if (slide.children && slide.children.length > 0) {
        const childSections = slide.children
          .map((child) => {
            const childBg = getBackgroundAttrs(child.background)
            const childAutoAnimate = child.autoAnimate ? ' data-auto-animate' : ''
            const childNotesText = getSlideNotes(child)
            const childNotes = childNotesText
              ? `<aside class="notes">${escapeHtml(childNotesText)}</aside>`
              : ''
            const childElements = renderSlideElements(child, { forPrint: false })
            return `    <section${childAutoAnimate}${childBg} style="padding:0;width:${resW}px;height:${resH}px;overflow:hidden;font-size:calc(16px * var(--font-zoom, 1));">\n${childElements}\n      ${childNotes}\n    </section>`
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

  <style>
    html, body { margin: 0; padding: 0; overflow: hidden; width: 100%; height: 100%; background: #000; }
    /* Reset reveal.js section padding/alignment so absolute positions match the 960x540 editor canvas exactly */
    .reveal .slides section { padding: 0 !important; text-align: left !important; }
    /* Neutralise theme typography overrides so presentation matches editor exactly */
    /* font-family only on section (inherited) so KaTeX's explicit rules take precedence */
    .reveal .slides section { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .reveal .slides section * { text-transform: none !important; letter-spacing: normal !important; }
    /* Explicit heading sizes ΓÇö override theme so present mode matches editor exactly */
    .reveal .slides section h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .reveal .slides section p  { margin: 0 0 0.4em; line-height: 1.5; }
    .reveal .slides section ul,
    .reveal .slides section ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .reveal .slides section li { margin-bottom: 0.2em; line-height: 1.5; }
    .reveal .slides section a  { text-decoration: underline; }
    /* reveal.js constrains/decorates section imgs ΓÇö reset everything */
    .reveal .slides section img { margin: 0 !important; border: none !important; background: none !important; box-shadow: none !important; max-width: none !important; max-height: none !important; }
    /* Footer ΓÇö explicit CSS rule with high specificity so reveal.js theme cannot override */
    .reveal .slides section .reveal-footer,
    .reveal .slides section .reveal-footer * { font-family: ${footerFontFamily} !important; font-size: ${footerFontSize}px !important; color: ${footerColor} !important; }
  </style>
  ${getPresenterToolsHead(presenterTools)}${presentation.customCSS ? `\n  <style>\n${presentation.customCSS}\n  </style>` : ''}
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
      transition: '${presentation.transition || 'slide'}',
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

      // Live presenter: connect Socket.IO and broadcast navigation
      var liveRoom = params.get('live');
      if (liveRoom) {
        var script = document.createElement('script');
        script.src = '/vendor/socket.io/socket.io.min.js';
        script.onload = function() {
          var sock = io({ path: '/ws' });
          sock.on('connect', function() {
            sock.emit('join-room', {
              roomId: liveRoom,
              role: 'presenter',
              presentationId: '${presentation.id || ''}'
            });
            // Show live indicator
            var badge = document.createElement('div');
            badge.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;background:rgba(239,68,68,0.9);color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;font-family:system-ui,sans-serif;';
            badge.innerHTML = '<span style="width:8px;height:8px;border-radius:50%;background:#fff;animation:livePulse 1.5s ease-in-out infinite;display:inline-block;"></span> LIVE';
            var style = document.createElement('style');
            style.textContent = '@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.3}}';
            document.head.appendChild(style);
            document.body.appendChild(badge);
          });
          // Broadcast slide changes
          Reveal.on('slidechanged', function(event) {
            var indices = Reveal.getIndices();
            sock.emit('navigate', {
              slideIndex: indices.h || 0,
              verticalIndex: indices.v || 0,
              fragmentIndex: indices.f || 0
            });
          });
          Reveal.on('fragmentshown', function(event) {
            var indices = Reveal.getIndices();
            sock.emit('navigate', {
              slideIndex: indices.h || 0,
              verticalIndex: indices.v || 0,
              fragmentIndex: indices.f || 0
            });
          });
          Reveal.on('fragmenthidden', function(event) {
            var indices = Reveal.getIndices();
            sock.emit('navigate', {
              slideIndex: indices.h || 0,
              verticalIndex: indices.v || 0,
              fragmentIndex: indices.f || 0
            });
          });
          sock.on('control-navigate', function(state) {
            Reveal.slide(state.slideIndex || 0, state.verticalIndex || 0, state.fragmentIndex || 0);
          });
          // Track cursor for viewers
          document.addEventListener('mousemove', function(e) {
            sock.emit('cursor-move', {
              x: e.clientX / window.innerWidth,
              y: e.clientY / window.innerHeight
            });
          });
        };
        document.head.appendChild(script);
      }
    });
  </script>${getPresenterToolsInlineJS(presenterTools)}
</body>
</html>`
}

function getBackgroundAttrs(bg) {
  if (!bg) return ''
  if (bg.type === 'color' && bg.color) return ` data-background-color="${bg.color}"`
  if (bg.type === 'image' && bg.image)
    return ` data-background-image="${absoluteSrc(bg.image)}" data-background-size="${bg.size || 'cover'}" data-background-position="${bg.position || 'center'}"`
  if (bg.type === 'gradient' && bg.gradient) return ` data-background-gradient="${bg.gradient}"`
  return ''
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

function getBgPrintStyle(bg) {
  if (!bg || bg.type === 'none') return 'background-color:#1e1e2e;'
  if (bg.type === 'color') return `background-color:${bg.color || '#1e1e2e'};`
  if (bg.type === 'gradient') return `background:${bg.gradient || '#1e1e2e'};`
  if (bg.type === 'image' && bg.image) {
    const src = absoluteSrc(bg.image)
    return `background-image:url('${src}');background-size:${bg.size || 'cover'};background-position:${bg.position || 'center'};`
  }
  return 'background-color:#1e1e2e;'
}

function generatePrintHTML(presentation) {
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

  // Expand each slide into one page per fragment step (initial + one per unique index)
  const pages = []
  let printPageCounter = 0
  presentation.slides.forEach((slide) => {
    const fragIndices = [
      ...new Set(
        (slide.elements || []).filter((el) => el.fragment).map((el) => el.fragmentIndex || 1)
      ),
    ].sort((a, b) => a - b)
    pages.push({ slide, maxIdx: -Infinity }) // initial: no fragments
    fragIndices.forEach((idx) => pages.push({ slide, maxIdx: idx }))
  })
  const totalPages = pages.length

  const pagesHtml = pages
    // eslint-disable-next-line unused-imports/no-unused-vars
    .map(({ slide, maxIdx }, pageIndex) => {
      const bgStyle = getBgPrintStyle(slide.background)

      const elementsHtml = renderSlideElements(slide, { forPrint: true, maxFragIdx: maxIdx })

      // Per-slide page numbering
      const slideHasPageNum = slide.showPageNumber !== false
      if (slideHasPageNum && maxIdx === -Infinity) printPageCounter++ // only increment on initial page of each slide
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
    typeof window !== 'undefined' && window.location && window.location.origin !== 'null'
      ? window.location.origin
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
    body { width: 100%; height: auto; overflow: visible !important; background: #000; margin: 0; padding-top: 48px; print-color-adjust: exact; -webkit-print-color-adjust: exact; display: block; }
    .slide-page {
      width: ${resW}px; height: ${resH}px; position: relative; overflow: hidden;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      break-after: page; page-break-after: always;
      print-color-adjust: exact; -webkit-print-color-adjust: exact;
    }
    .slide-page:last-child { break-after: avoid; page-break-after: avoid; }
    .slide-page h1 { font-size: 2.5em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page h2 { font-size: 1.6em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page h3 { font-size: 1.3em; font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page h4 { font-size: 1em;   font-weight: bold; line-height: 1.2; margin: 0 0 0.4em; }
    .slide-page p  { margin: 0 0 0.4em; line-height: 1.5; }
    .slide-page ul, .slide-page ol { padding-left: 1.5em; margin: 0 0 0.4em; }
    .slide-page li { margin-bottom: 0.2em; line-height: 1.5; }
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
  <div id="print-bar">
    <div>
      <strong>${title}</strong>
      <span class="hint"> &nbsp;┬╖&nbsp; ${totalPages} page${totalPages !== 1 ? 's' : ''} (fragments expanded)
        &nbsp;┬╖&nbsp; enable <em>Background graphics</em> in print settings</span>
    </div>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
${pagesHtml}
  <script src="/vendor/katex/dist/katex.min.js"></script>
  <script src="/vendor/reveal.js/plugin/highlight/highlight.js"></script>
  <script src="/vendor/chart.js/dist/chart.umd.js"></script>
  <script src="/vendor/qrcode/qrcode.min.js"></script>
  <script>
    window.addEventListener('load', function() {
      // Highlight code blocks
      document.querySelectorAll('pre code').forEach(function(el) { try { hljs.highlightElement(el); } catch(e) {} });
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
          el.src = URL.createObjectURL(blob);
        } catch(e) { console.error('Iframe PDF init error:', e); }
      });
      // Delay print to allow all inline content (srcdoc iframes, charts, etc.) to render
      setTimeout(function() { window.print(); }, 3000);
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
  downloadHTML,
  exportPDF,
  presentInWindow,
  getBackgroundAttrs,
  escapeHtml,
}
