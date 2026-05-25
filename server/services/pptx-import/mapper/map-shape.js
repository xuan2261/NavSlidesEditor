const { CANVAS_SIZE } = require('../constants')
const { sanitizeHtml } = require('../sanitize')
const { clampBox, mapBox, mapLineGeometry, readNumber } = require('../geometry')
const { arrowMarker, colorValue, gradientBackground, svgAttr } = require('./utils-color')
const { baseElement, extractShadow, shapeName } = require('./utils-base')
const { extractTextInsets, extractTextMetadata, plainText } = require('./utils-text')

function mapShape(element, context) {
  const shape = shapeName(element.shapType)
  if (element.path) {
    context.stats.shapeCount += 1
    const width = Math.max(1, Math.round(readNumber(element.width, 80) * context.scale.x))
    const height = Math.max(1, Math.round(readNumber(element.height, 40) * context.scale.y))
    const fill = colorValue(element.fill, '#e5e7eb')
    const stroke = colorValue(element.borderColor, 'none')
    const strokeWidth = readNumber(element.borderWidth, 0)
    return [{
      ...baseElement(element, context.scale, context.zIndex, mapBox(element, context.scale)),
      type: 'svg',
      content: `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><path d="${svgAttr(element.path)}" fill="${svgAttr(fill)}" stroke="${svgAttr(stroke)}" stroke-width="${strokeWidth}"/></svg>`,
    }]
  }
  if (shape === 'line') {
    context.stats.shapeCount += 1
    const lineGeom = mapLineGeometry(element, context.scale)
    const box = baseElement(element, context.scale, context.zIndex, clampBox(lineGeom.box, CANVAS_SIZE))
    const { x1, y1, x2, y2 } = lineGeom.endpoints
    const normType = String(element.shapType || '').toLowerCase()
    const explicitStart = arrowMarker(element.beginArrowType || element.arrowStart || element.startArrowType)
    const explicitEnd = arrowMarker(element.endArrowType || element.arrowEnd || element.arrowType)
    const hasArrowStart = /arrowstart|beginarrow|stealth/i.test(normType)
    const hasArrowEnd = /arrowend|endarrow|arrow|triangle|diamond|oval\b|square|stealth/i.test(normType) && !/\bno\b|\bnone\b/.test(normType)
    return [{
      ...box,
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      stroke: colorValue(element.borderColor, '#111827'),
      strokeWidth: Math.max(1, readNumber(element.borderWidth, 2)),
      dashArray: element.borderStrokeDasharray || element.dashArray || element.lineDash || undefined,
      arrowStart: explicitStart !== 'none' ? explicitStart : hasArrowStart ? 'arrow' : 'none',
      arrowEnd: explicitEnd !== 'none' ? explicitEnd : hasArrowEnd ? 'arrow' : 'none',
    }]
  }
  context.stats.shapeCount += 1
  const textHtml = sanitizeHtml(element.content)
  const textMetadata = extractTextMetadata(textHtml, element)
  const mapped = {
    ...baseElement(element, context.scale, context.zIndex, mapBox(element, context.scale)),
    type: 'shape',
    shape,
    fill: colorValue(element.fill, '#e5e7eb'),
    stroke: colorValue(element.borderColor, 'none'),
    strokeWidth: readNumber(element.borderWidth, 0),
    text: plainText(textHtml),
    textColor: '#111827',
    ...textMetadata,
  }
  if (textHtml) mapped.textHtml = textHtml
  const textInsets = extractTextInsets(element)
  if (textInsets) mapped._pptxImportMeta = { ...(mapped._pptxImportMeta || {}), textInsets }
  if (element.fill?.type === 'gradient') mapped.fillGradient = gradientBackground(element.fill)
  const shadow = extractShadow(element)
  if (shadow) {
    mapped.shadowX = shadow.shadowX
    mapped.shadowY = shadow.shadowY
    mapped.shadowBlur = shadow.shadowBlur
    mapped.shadowColor = shadow.shadowColor
  }
  return [mapped]
}

module.exports = {
  mapShape,
}
