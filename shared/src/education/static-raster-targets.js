const { FIXED_ID_PREFIX, resolveEffectiveSlide } = require('../slide-layouts.js')
const { effectiveSlideIdentity, gameInstanceKey } = require('./effective-slide-identity.js')
const { resolveConnectorGeometry } = require('../connector-geometry.js')

// Authored IDs remain the backward-compatible key. Only repeated inherited
// fixed elements require the canonical effective-instance tuple in captures.
function staticRasterTargetId(element, effectiveSlideId) {
  if (typeof element?.id !== 'string' || !element.id.startsWith(FIXED_ID_PREFIX)) return element?.id
  if (typeof effectiveSlideId !== 'string' || !effectiveSlideId)
    throw new Error(`Missing effective slide identity for inherited capture "${element.id}"`)
  return `static-instance:${encodeURIComponent(gameInstanceKey({ effectiveSlideId, elementId: element.id }))}`
}
function resolveStaticRasterSlides(presentation) {
  const entries = []
  ;(presentation?.slides || []).forEach((parent, horizontal) => {
    let vertical = 0
    const visit = (source) => {
      const { slide } = resolveEffectiveSlide(source, presentation.layoutMasters)
      const { effectiveLines } = resolveConnectorGeometry(slide.elements || [])
      const elements = (slide.elements || []).map(
        (element) => effectiveLines.get(element.id) || element
      )
      entries.push({
        source,
        slide: { ...slide, elements },
        effectiveSlideId: effectiveSlideIdentity(slide, horizontal, vertical++),
      })
      ;(source.children || []).forEach(visit)
    }
    visit(parent)
  })
  return entries
}
function prepareStaticRasterPresentation(presentation) {
  const slides = resolveStaticRasterSlides(presentation).map(({ slide, effectiveSlideId }) => {
    const {
      children: _children,
      layoutId: _layoutId,
      layoutOverrides: _overrides,
      ...captureSlide
    } = slide
    return {
      ...captureSlide,
      id: effectiveSlideId,
      elements: (slide.elements || [])
        .filter((element) => !element.hidden)
        .map((element) => ({ ...element, id: staticRasterTargetId(element, effectiveSlideId) })),
    }
  })
  return { ...presentation, layoutMasters: [], slides }
}
module.exports = {
  staticRasterTargetId,
  resolveStaticRasterSlides,
  prepareStaticRasterPresentation,
}
