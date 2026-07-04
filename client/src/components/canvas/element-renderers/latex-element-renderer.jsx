import { normalizeLatexForRender } from 'revealjs-shared'

function escapeScriptElementContent(value) {
  return String(value || '').replace(/<\//gi, '\\u003c/')
}

function generateLatexIframeHtml(content, options = {}) {
  const hasTikz = /\\begin\{tikzpicture\}/.test(content)
  const renderContent = hasTikz ? content : normalizeLatexForRender(content)
  const fontSize = options.fontSize || 16
  const textColor = options.textColor || options.fontColor || '#ffffff'
  const tikzScript = hasTikz
    ? `<link rel="stylesheet" type="text/css" href="/vendor/tikzjax/fonts.css">
       <script src="/vendor/tikzjax/tikzjax.js"></script>`
    : ''

  let bodyContent
  if (hasTikz) {
    bodyContent = `<script type="text/tikz">${escapeScriptElementContent(content)}</script>`
  } else {
    bodyContent = `<div id="math"></div>
    <script>
      try {
        katex.render(${JSON.stringify(renderContent).replace(/</g, '\\u003c')}, document.getElementById('math'), { displayMode: true, throwOnError: false });
      } catch(e) {
        document.getElementById('math').textContent = e.message;
      }
    </script>`
  }

  return `<!doctype html><html><head>
<meta charset="utf-8">
<link rel="stylesheet" href="/vendor/katex/dist/katex.min.css">
<script src="/vendor/katex/dist/katex.min.js"></script>
${tikzScript}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: transparent; overflow: hidden; color: ${textColor}; font-size: ${fontSize}px; }
  .katex { font-size: 1.4em; color: inherit; }
  svg { max-width: 100%; max-height: 100%; }
</style>
</head><body>${bodyContent}</body></html>`
}

export function LatexRenderer({ element, isSelected, isDragging }) {
  const html = generateLatexIframeHtml(element.content || '', {
    fontSize: element.fontSize,
    textColor: element.textColor,
    fontColor: element.fontColor,
  })
  const latexFrameStyle = {
    width: '100%',
    height: '100%',
    border: 'none',
    display: 'block',
    pointerEvents: isSelected && !isDragging ? 'auto' : 'none',
    background: 'transparent',
  }
  return (
    <iframe srcDoc={html} style={latexFrameStyle} sandbox="allow-scripts" title="LaTeX / TikZ" />
  )
}

export { generateLatexIframeHtml }
