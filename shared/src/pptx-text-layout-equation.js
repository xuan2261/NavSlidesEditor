const { evaluateFontProfile } = require('./pptx-text-document')
const { collectOmmlFontRequests } = require('./pptx-omml-source-style')
const { createOmmlRuntime } = require('./pptx-omml-runtime')

// This seam accepts only the browser measurer's verified bytes and loaded aliases.
// OMML stays an atomic typed item; it never enters text shaping as dummy text.
function measureInlineEquation({ document, fontRuntime, fontProfile, fontErrors,
  item, fontScale, outputFontFamilies }) {
  const issue = (code, detail) => ({ code, componentId: item.componentId, path: item.path,
    ...(detail ? { detail } : {}) })
  if (!fontRuntime) return { issues: [issue('inline-equation-runtime-required')] }
  try {
    const textDefaults = { run: item.properties }, theme = item.theme
    const requests = collectOmmlFontRequests(item.ommlDocument, { textDefaults, theme })
    const issues = []
    for (const request of requests) {
      const result = evaluateFontProfile({ profile: fontProfile, requests: [{
        typeface: request.fontFamily, bold: request.bold, italic: request.italic,
        source: { part: 'pptxTextDocument', path: item.path },
      }] }).results[0]
      const code = !result.metricsQualified ? result.unsupportedReason :
        !fontRuntime.fontFamilies[result.faceId] ? fontErrors.get(result.faceId) ?? 'font-not-loaded' : null
      if (code) issues.push({ ...issue(code), mathComponentId: request.componentId })
    }
    if (issues.length) return { issues }
    const runtime = createOmmlRuntime({ document, fontRuntime, textDefaults,
      sourceStyle: true, theme, outputFontFamilies })
    const rendered = runtime.render(item.ommlDocument)
    const { width, ascent, descent } = rendered.layout
    // Scale the complete vector layout, including authored nested sizes, without
    // rewriting the source AST or scaling only the inherited paragraph font.
    const advance = width * fontScale, up = ascent * fontScale, down = descent * fontScale
    const svg = fontScale === 1 ? rendered.svg : rendered.svg.replace(
      `width="${width}" height="${ascent + descent}"`,
      `width="${advance}" height="${up + down}"`)
    return { issues: [], equation: { advance, ascent: up, descent: down, svg } }
  } catch (error) {
    return { issues: [issue('inline-equation-measurement-failed', error.message)] }
  }
}

function inlineEquationStyle(equation, shift) {
  const align = shift - equation.descent
  return `display:inline-block;width:${equation.advance}px;height:${equation.ascent + equation.descent}px;` +
    `vertical-align:${align === 0 ? 'baseline' : `${align}px`};line-height:0;font-size:0;` +
    'padding:0;margin:0;border:0;letter-spacing:0;white-space:pre;'
}
module.exports = { measureInlineEquation, inlineEquationStyle }
