const { CANVAS_SIZE } = require('./constants')

const RAW_UNIT_RE = /\b-?\d+(?:\.\d+)?\s*(?:pt|in|cm|mm)\b/i
const DANGEROUS_CSS_RE = /url\s*\(|expression\s*\(|javascript:|@import\b|\bimport\s*\(|behavior\s*:|binding\s*:/i
const DANGEROUS_URL_RE = /^\s*(?:javascript|vbscript|data):/i
const LENGTH_FIELDS = new Set([
  'x', 'y', 'left', 'top', 'width', 'height',
  'borderWidth', 'strokeWidth',
  'shadowX', 'shadowY', 'shadowBlur',
  'fontSize', 'letterSpacing',
  'colWidths', 'rowHeights',
])

function assertResolutionInvariant(presentation, expected = CANVAS_SIZE) {
  const actual = presentation?.resolution || {}
  if (actual.width !== expected.width || actual.height !== expected.height) {
    throw new Error(`PPTX acceptance failed: resolution must be ${expected.width}x${expected.height}, got ${actual.width}x${actual.height}`)
  }
}

function assertTextFontSizeWithinTolerance(element, sourcePtFontSize, tolerancePx = 1) {
  const expectedPx = Number(sourcePtFontSize) * (96 / 72)
  const actualPx = Number(element?.fontSize)
  if (!Number.isFinite(expectedPx) || !Number.isFinite(actualPx) || Math.abs(actualPx - expectedPx) > tolerancePx) {
    throw new Error(`PPTX acceptance failed: fontSize ${actualPx} is not within ${tolerancePx}px of ${expectedPx}`)
  }
}

function flattenNumericLeaves(value) {
  if (Array.isArray(value)) return value.flatMap(flattenNumericLeaves)
  return [value]
}

function assertFiniteLengthFields(presentation) {
  for (const [slideIndex, slide] of (presentation?.slides || []).entries()) {
    for (const [elementIndex, element] of (slide.elements || []).entries()) {
      for (const [key, value] of Object.entries(element || {})) {
        if (!LENGTH_FIELDS.has(key)) continue
        for (const leaf of flattenNumericLeaves(value)) {
          if (leaf == null) continue
          if (!Number.isFinite(Number(leaf))) {
            throw new Error(`PPTX acceptance failed: ${key} is not finite on slide ${slideIndex + 1}, element ${elementIndex + 1}`)
          }
          if (typeof leaf === 'string' && RAW_UNIT_RE.test(leaf)) {
            throw new Error(`PPTX acceptance failed: raw unit in ${key} on slide ${slideIndex + 1}, element ${elementIndex + 1}`)
          }
        }
      }

      const insets = element?._pptxImportMeta?.textInsets
      if (insets) {
        for (const [side, value] of Object.entries(insets)) {
          if (value == null) continue
          if (!Number.isFinite(Number(value))) {
            throw new Error(`PPTX acceptance failed: textInsets.${side} is not finite on slide ${slideIndex + 1}, element ${elementIndex + 1}`)
          }
        }
      }
    }
  }
}

function richHtmlStrings(presentation) {
  const strings = []
  for (const slide of presentation?.slides || []) {
    if (slide.notes) strings.push(slide.notes)
    for (const element of slide.elements || []) {
      if (element.content) strings.push(element.content)
      if (element.textHtml) strings.push(element.textHtml)
    }
  }
  return strings
}

function styleAttributeValues(html) {
  const styles = []
  String(html || '').replace(/\sstyle=(["'])(.*?)\1/gi, (_match, _quote, style) => {
    styles.push(style)
    return _match
  })
  return styles
}

function urlAttributeValues(html) {
  const urls = []
  String(html || '').replace(/\s(?:href|src|xlink:href)=(["'])(.*?)\1/gi, (_match, _quote, value) => {
    urls.push(value)
    return _match
  })
  return urls
}

function assertNoRawUnits(presentation) {
  for (const html of richHtmlStrings(presentation)) {
    for (const style of styleAttributeValues(html)) {
      if (RAW_UNIT_RE.test(style)) {
        throw new Error('PPTX acceptance failed: raw CSS length unit remains in rich HTML')
      }
      if (DANGEROUS_CSS_RE.test(style)) {
        throw new Error('PPTX acceptance failed: dangerous CSS token remains in rich HTML')
      }
    }
    for (const url of urlAttributeValues(html)) {
      if (DANGEROUS_URL_RE.test(url)) {
        throw new Error('PPTX acceptance failed: dangerous URL attribute remains in rich HTML')
      }
    }
  }
}

function sourceElementsBySlide(sourceOutput) {
  return (sourceOutput?.slides || []).map((slide) => {
    const elements = []
    const flatten = (element) => {
      if (element?.type === 'group' && Array.isArray(element.elements)) {
        for (const child of element.elements) flatten(child)
        return
      }
      elements.push(element)
    }
    for (const element of slide.elements || []) flatten(element)
    return elements
  })
}

function firstSourceFontPt(element) {
  const direct = Number(element?.fontSz ?? element?.fontSize)
  if (Number.isFinite(direct) && direct > 0) return direct
  return null
}

function assertSourceFontSizesWithinTolerance(sourceOutput, presentation, tolerancePx = 1) {
  const sourceSlides = sourceElementsBySlide(sourceOutput)
  const navSlides = presentation?.slides || []
  for (const [slideIndex, sourceElements] of sourceSlides.entries()) {
    const navElements = navSlides[slideIndex]?.elements || []
    let navCursor = 0
    for (const sourceElement of sourceElements) {
      const sourceFontPt = firstSourceFontPt(sourceElement)
      if (sourceFontPt == null) continue
      const navElement = navElements.slice(navCursor).find((candidate) =>
        ['text', 'shape'].includes(candidate?.type) && candidate.fontSize != null)
      if (!navElement) continue
      navCursor = navElements.indexOf(navElement) + 1
      try {
        assertTextFontSizeWithinTolerance(navElement, sourceFontPt, tolerancePx)
      } catch (error) {
        throw new Error(`${error.message} on slide ${slideIndex + 1}`)
      }
    }
  }
}

function assertPresentationAcceptance(presentation, expectedSize = CANVAS_SIZE, sourceOutput = null) {
  assertResolutionInvariant(presentation, expectedSize)
  assertFiniteLengthFields(presentation)
  assertNoRawUnits(presentation)
  if (sourceOutput) assertSourceFontSizesWithinTolerance(sourceOutput, presentation)
}

module.exports = {
  assertFiniteLengthFields,
  assertNoRawUnits,
  assertPresentationAcceptance,
  assertResolutionInvariant,
  assertSourceFontSizesWithinTolerance,
  assertTextFontSizeWithinTolerance,
}
