const { FAILURE_TYPES } = require('./constants')

function isMeaningfulElement(element) {
  if (!element || typeof element !== 'object') return false
  const type = String(element.type || '').trim()
  if (type) return true
  if (String(element.content || element.text || '').trim()) return true
  if (Array.isArray(element.elements)) return element.elements.some(isMeaningfulElement)
  return false
}

function inspectParserOutputUsability(output) {
  const slides = Array.isArray(output?.slides) ? output.slides : []
  if (slides.length === 0) {
    return { usable: false, reason: 'no-slides', slideCount: 0, meaningfulElementCount: 0 }
  }
  const meaningfulElementCount = slides.reduce(
    (count, slide) =>
      count + (Array.isArray(slide?.elements) ? slide.elements.filter(isMeaningfulElement).length : 0),
    0
  )
  return {
    usable: meaningfulElementCount > 0,
    reason: meaningfulElementCount > 0 ? null : 'all-slides-empty',
    slideCount: slides.length,
    meaningfulElementCount,
  }
}

function assertUsableParserOutput(output) {
  const inspection = inspectParserOutputUsability(output)
  if (inspection.usable) return inspection
  const err = new Error(
    inspection.reason === 'no-slides'
      ? 'PPTX parser returned no slides'
      : 'PPTX parser returned only empty slides'
  )
  err.type = FAILURE_TYPES.outputEmpty
  err.code = inspection.reason
  err.details = inspection
  throw err
}

module.exports = {
  assertUsableParserOutput,
  inspectParserOutputUsability,
  isMeaningfulElement,
}
