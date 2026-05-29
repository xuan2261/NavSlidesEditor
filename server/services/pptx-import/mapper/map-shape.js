const { CANVAS_SIZE } = require('../constants')
const { sanitizeHtml } = require('../sanitize')
const { clampBox, mapBox, mapLineGeometry, readNumber } = require('../geometry')
const { arrowMarker, colorValue, gradientBackground, svgAttr } = require('./utils-color')
const { baseElement, extractShadow, scaleLength, shapeName } = require('./utils-base')
const { buildPptxTextImportMeta, extractTextInsets, extractTextMetadata, normalizeImportedRichTextHtml, plainText } = require('./utils-text')

function isKnownBuiltInShapeType(shapType = '') {
  const value = String(shapType || '').toLowerCase().replace(/[\s_-]/g, '')
  if (!value) return false
  return (
    value === 'rect' ||
    value.includes('rectangle') ||
    value.includes('ellipse') ||
    value.includes('oval') ||
    value.includes('circle') ||
    value.includes('triangle') ||
    value.includes('diamond') ||
    value.includes('rhombus') ||
    value.includes('arrow') ||
    value.includes('line') ||
    value.includes('connector') ||
    value.includes('round') ||
    value.includes('star') ||
    value.includes('hexagon') ||
    value.includes('pentagon') ||
    value.includes('cloud') ||
    value.includes('cylinder') ||
    value.includes('can') ||
    value.includes('parallelogram') ||
    value.includes('trapezoid') ||
    value.includes('bracket') ||
    value.includes('brace')
  )
}

function mapShape(element, context) {
  const shape = shapeName(element.shapType)
  const sanitizedTextHtml = sanitizeHtml(element.content)
  const textHtml = normalizeImportedRichTextHtml(sanitizedTextHtml)
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
      strokeWidth: scaleLength(element.borderWidth, context.scale.x, 1),
      dashArray: element.borderStrokeDasharray || element.dashArray || element.lineDash || undefined,
      arrowStart: explicitStart !== 'none' ? explicitStart : hasArrowStart ? 'arrow' : 'none',
      arrowEnd: explicitEnd !== 'none' ? explicitEnd : hasArrowEnd ? 'arrow' : 'none',
    }]
  }
  const customPathShape = /custom|freeform|custgeom|geometry/i.test(String(element.shapType || ''))
  const unknownPathOnlyShape = !textHtml && !isKnownBuiltInShapeType(element.shapType)
  if (element.path && (customPathShape || unknownPathOnlyShape)) {
    context.stats.shapeCount += 1
    const rawWidth = Math.max(1, readNumber(element.width, 80))
    const rawHeight = Math.max(1, readNumber(element.height, 40))
    const fill = colorValue(element.fill, '#e5e7eb')
    const stroke = colorValue(element.borderColor, 'none')
    const strokeWidth = scaleLength(element.borderWidth)
    return [{
      ...baseElement(element, context.scale, context.zIndex, mapBox(element, context.scale)),
      type: 'svg',
      content: `<svg width="100%" height="100%" viewBox="0 0 ${rawWidth} ${rawHeight}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="${svgAttr(element.path)}" fill="${svgAttr(fill)}" stroke="${svgAttr(stroke)}" stroke-width="${strokeWidth}"/></svg>`,
    }]
  }
  context.stats.shapeCount += 1
  const textMetadata = extractTextMetadata(sanitizedTextHtml, element, context.scale)
  const box = baseElement(element, context.scale, context.zIndex, mapBox(element, context.scale))
  const fillFallback = textHtml ? 'transparent' : '#e5e7eb'
  const mapped = {
    ...box,
    type: 'shape',
    shape,
    fill: colorValue(element.fill, fillFallback),
    stroke: colorValue(element.borderColor, 'none'),
    strokeWidth: scaleLength(element.borderWidth, context.scale.x),
    text: plainText(textHtml),
    textColor: '#111827',
    ...textMetadata,
  }
  if (textHtml) mapped.textHtml = textHtml
  const textInsets = extractTextInsets(element, context.scale, box)
  if (textHtml) {
    mapped._pptxImportMeta = buildPptxTextImportMeta(box, mapped, {
      textLength: mapped.text.length,
      ...(textInsets ? { textInsets, textInsetsUnit: 'px' } : {}),
    })
  }
  if (element.fill?.type === 'gradient') mapped.fillGradient = gradientBackground(element.fill)
  const shadow = extractShadow(element, context.scale)
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
