const { renderOmmlDocument } = require('./pptx-omml-renderer')
const { readFontCoverage } = require('./pptx-text-layout-font')
const { createOmmlMathMetrics } = require('./pptx-omml-runtime-math')
const { resolveOmmlSourceStyle, resolveOmmlFontFamily } = require('./pptx-omml-source-style')

// Consume the shared verified font runtime; it owns resource disposal.
function createOmmlRuntime({
  document,
  fontRuntime,
  fontFamily,
  fontSize,
  color,
  spacing,
  mathFrame,
  textDefaults,
  theme,
  sourceStyle = false,
  outputFontFamilies,
}) {
  theme = mathFrame?.textContext?.theme ?? theme
  if (!document?.createElement || !fontRuntime?.getFontAsset || !fontRuntime.measurement)
    throw new TypeError('OMML font runtime and browser document required')
  const entries = fontRuntime.fontProfile.faces.map((face) => {
    const { bytes } = fontRuntime.getFontAsset(face.id)
    return {
      face,
      alias: fontRuntime.fontFamilies[face.id],
      covers: readFontCoverage(bytes),
      bytes,
      metrics: null,
    }
  })
  const context = document.createElement('canvas').getContext('2d')
  if (!context) throw new TypeError('OMML glyph measurement canvas unavailable')
  function resolve(style) {
    const stale = fontRuntime.measurement.validate(
      fontRuntime.fontProfile,
      fontRuntime.rendererProfile
    )
    if (stale) throw new TypeError(`OMML font runtime: ${stale}`)
    const family = resolveOmmlFontFamily(style.fontFamily, theme, (detail) => {
      throw new TypeError(detail)
    })
    const entry = entries.find(
      ({ face, alias }) =>
        [face.typeface, alias].includes(family) &&
        Boolean(face.bold) === Boolean(style.bold) &&
        Boolean(face.italic) === Boolean(style.italic)
    )
    if (!entry?.alias) throw new TypeError('Source-matching OMML font/style unavailable')
    return entry
  }
  const options = {
    ...(sourceStyle
      ? resolveOmmlSourceStyle({ mathFrame, textDefaults, theme, deferPaint: true })
      : { fontFamily, fontSize, color }),
    theme,
    sourceStyle,
    resolveFontFamily(style) {
      const entry = resolve(style)
      if (!outputFontFamilies) return entry.alias
      const alias = outputFontFamilies[entry.face.id]
      if (typeof alias !== 'string' || !alias.trim())
        throw new TypeError('OMML output font alias unavailable')
      return alias
    },
    getMathMetrics(style) {
      const entry = resolve(style)
      entry.metrics ??= createOmmlMathMetrics(entry.bytes, spacing, fontRuntime.rendererProfile)
      return entry.metrics(style)
    },
    measureText(text, style) {
      const entry = resolve(style)
      if ([...text].some((character) => !entry.covers(character.codePointAt(0))))
        throw new TypeError('OMML font glyph coverage missing')
      context.font = `${style.italic ? 'italic' : 'normal'} ${style.bold ? 'bold' : 'normal'} ${style.fontSize}px "${entry.alias}"`
      context.fontKerning = 'normal'
      const m = context.measureText(text)
      return {
        advanceWidth: m.width,
        inkLeft: -m.actualBoundingBoxLeft,
        inkRight: m.actualBoundingBoxRight,
        ascent: Math.max(0, m.actualBoundingBoxAscent),
        descent: Math.max(0, m.actualBoundingBoxDescent),
      }
    },
  }
  return Object.freeze({ ...options, render: (source) => renderOmmlDocument(source, options) })
}
module.exports = { createOmmlRuntime }
