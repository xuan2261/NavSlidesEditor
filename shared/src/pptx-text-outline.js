const { normalizeTextProperties } = require('./pptx-text-document')
const { resolveProperty } = require('./pptx-style-resolution')

// ISO/IEC 29500-1, ln (20.1.2.2.24), reproduced in Microsoft Learn's
// Drawing.Outline Remarks: omitted w assumes 0. Keep that absence authored;
// only the paint boundary supplies the zero, never a guessed one-point stroke.
function textOutlinePaint(outline, fontScale = 1, theme) {
  if (outline === undefined) return { width: 0, color: 'transparent' }
  const value = normalizeTextProperties({ outline }, 'run').outline
  if (!Number.isFinite(fontScale) || fontScale <= 0)
    throw new TypeError('Invalid text outline font scale')
  const width = (value.width ?? 0) / 9525 * fontScale
  if (!width || value.fill === 'none' || value.color?.kind === 'none')
    return { width: 0, color: 'transparent' }
  const unsupported = value.dash?.value && value.dash.value !== 'solid' ? 'dash' :
    value.join?.kind && value.join.kind !== 'round' ? 'join' : null
  if (unsupported) throw Object.assign(new TypeError(`Unsupported text outline ${unsupported}`), {
    code: `unsupported-text-outline-${unsupported}`,
  })
  const result = resolveProperty({ property: 'outline', scope: 'run', ...(theme ? { theme } : {}),
    layers: { target: {}, entries: [{ id: 'outline-paint', kind: 'run',
      source: { part: 'pptxTextDocument', path: 'properties.outline' }, properties: { outline: value } }] } })
  if (!result.resolved || result.resolved.color?.kind !== 'srgb')
    throw new TypeError(`Unresolved text outline color: ${result.unsupportedReason}`)
  const paint = resolveProperty({ property: 'color', scope: 'run',
    layers: { target: {}, entries: [{ id: 'outline-color', kind: 'run',
      source: { part: 'pptxTextDocument', path: 'properties.outline.color' },
      properties: { color: result.resolved.color } }] } }).resolved
  const rgb = paint.rgb.match(/../g).map((channel) => parseInt(channel, 16))
  return { width, color: `rgba(${rgb.join(',')},${paint.alpha})` }
}
function textOutlineCss(outline, fontScale = 1, theme) {
  const paint = textOutlinePaint(outline, fontScale, theme)
  return `-webkit-text-stroke-width:${paint.width}px;-webkit-text-stroke-color:${paint.color}`
}
function textOutlineSvgStyle(outline, fontScale = 1, theme) {
  const paint = textOutlinePaint(outline, fontScale, theme)
  return `stroke:${paint.color};stroke-width:${paint.width}px;stroke-linejoin:round;paint-order:fill stroke`
}
module.exports = { textOutlinePaint, textOutlineCss, textOutlineSvgStyle }
