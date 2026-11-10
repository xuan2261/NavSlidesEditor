// Coordinates use SVG's downward y axis; every box origin is its baseline.
function box(node, children = [], primitives = []) {
  return {
    componentId: node.componentId,
    type: node.type,
    x: 0,
    y: 0,
    width: 0,
    ascent: 0,
    descent: 0,
    children,
    primitives,
  }
}
function fit(result, minimumWidth = 0) {
  result.width = minimumWidth
  result.ascent = result.descent = 0
  for (const child of result.children) {
    result.width = Math.max(result.width, child.x + child.width)
    result.ascent = Math.max(result.ascent, child.ascent - child.y)
    result.descent = Math.max(result.descent, child.y + child.descent)
  }
  for (const p of result.primitives) {
    if (p.kind !== 'line') continue
    result.width = Math.max(result.width, p.x1, p.x2)
    result.ascent = Math.max(result.ascent, -Math.min(p.y1, p.y2) + p.strokeWidth / 2)
    result.descent = Math.max(result.descent, Math.max(p.y1, p.y2) + p.strokeWidth / 2)
  }
  return result
}
function row(node, children, gap = 0) {
  let x = 0
  for (const child of children) {
    child.x = x
    x += child.width + gap
  }
  return fit(box(node, children))
}
function line(x1, y1, x2, y2, metrics, style) {
  return { kind: 'line', x1, y1, x2, y2, strokeWidth: metrics.ruleThickness, color: style.color }
}
function validPaint(value) {
  if (typeof value !== 'string') return false
  if (/^#[0-9a-f]{6}$/i.test(value)) return true
  const match = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),([0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?)\)$/.exec(value)
  return !!match && match.slice(1, 4).every(channel => Number(channel) <= 255) &&
    Number.isFinite(Number(match[4])) && Number(match[4]) >= 0 && Number(match[4]) <= 1
}
function glyph(node, text, style, context) {
  const result = box(node)
  if (!text) return result
  if (!style.fontFamily || !Number.isFinite(style.fontSize) || style.fontSize <= 0 ||
      !validPaint(style.color))
    context.fail(node, 'source font, size and RGB color declarations required')
  if (/[\r\n\t]/.test(text))
    context.fail(node, 'control whitespace requires multiline math text layout')
  let m
  try {
    m = context.options.measureText(text, { ...style })
  } catch (error) {
    context.fail(node, `glyph measurement failed: ${error.message}`, 'PPTX_OMML_MEASUREMENT_FAILED')
  }
  if (
    !m ||
    !['advanceWidth', 'inkLeft', 'inkRight', 'ascent', 'descent'].every((key) =>
      Number.isFinite(m[key])
    ) ||
    m.advanceWidth < 0 ||
    m.ascent < 0 ||
    m.descent < 0 ||
    m.inkRight < m.inkLeft
  )
    context.fail(node, 'invalid measured glyph bounds', 'PPTX_OMML_MEASUREMENT_FAILED')
  const left = Math.min(0, m.inkLeft)
  result.width = Math.max(m.advanceWidth, m.inkRight) - left
  result.ascent = m.ascent
  result.descent = m.descent
  result.primitives.push({ kind: 'text', text, x: -left, y: 0, style: { ...style } })
  return result
}
function stretch(glyphBox, height, width) {
  const oldHeight = glyphBox.ascent + glyphBox.descent
  const sx = width === undefined || !glyphBox.width ? 1 : width / glyphBox.width
  const sy = height === undefined || !oldHeight ? 1 : height / oldHeight
  glyphBox.scaleX = sx
  glyphBox.scaleY = sy
  glyphBox.width *= sx
  glyphBox.ascent *= sy
  glyphBox.descent *= sy
  return glyphBox
}
function hidden(child) {
  child.hidden = true
  child.width = child.ascent = child.descent = 0
  return child
}
module.exports = { box, fit, row, line, glyph, stretch, hidden, validPaint }
