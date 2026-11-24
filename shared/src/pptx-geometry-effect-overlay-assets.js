const { semanticStyle } = require('./pptx-semantic-records.js')
const { materializeGeometry } = require('./pptx-geometry-style-resolution.js')
const {
  overlayBlips,
  validateSourceOverlayBindings,
} = require('./pptx-geometry-effect-overlay-bindings.js')

function fail() {
  throw new TypeError('Invalid source overlay blip binding identity')
}
function geometryEffectFillAssets(document, geometry) {
  const assets = {}
  overlayBlips(geometry?.style?.effects, (blip) => {
    const binding = semanticStyle(document, blip.bindingId) ?? document.styles?.[blip.bindingId]
    if (binding?.kind !== 'geometry-blip-binding' || binding.origin !== 'source') fail()
    // Derived render inputs must not alias immutable canonical source records.
    assets[blip.bindingId] = structuredClone(binding.payload.asset)
  })
  return assets
}
function geometryEffectOverlayCompatibilityElement(document, element, geometry) {
  if (!element.pptxInstanceId) return element
  const { pptxEffectFillAssets: _stale, ...regenerated } = element
  const assets = geometryEffectFillAssets(
    document,
    arguments.length >= 3 ? geometry : materializeGeometry(document, element.pptxInstanceId)
  )
  return Object.keys(assets).length ? { ...regenerated, pptxEffectFillAssets: assets } : regenerated
}
module.exports = {
  validateSourceOverlayBindings,
  geometryEffectFillAssets,
  geometryEffectOverlayCompatibilityElement,
}
