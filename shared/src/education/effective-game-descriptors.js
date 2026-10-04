const { resolveEffectiveSlide } = require('../slide-layouts.js')
const { normalizeGameConfig } = require('./normalize-game-config.js')
const { validateGameConfig } = require('./game-schema.js')
const { throwInvalid } = require('./game-validation-utils.js')
const { effectiveSlideIdentity, gameInstanceKey } = require('./effective-slide-identity.js')
function collectEffectiveGameDescriptors(presentation) {
  const descriptors = []
  const tuples = new Set()
  for (const [index, parent] of (presentation?.slides || []).entries()) {
    for (const [vertical, source] of [parent, ...(parent?.children || [])].entries()) {
      const slide = resolveEffectiveSlide(source, presentation.layoutMasters).slide
      const effectiveSlideId = effectiveSlideIdentity(slide, index, vertical)
      const elements = (slide.elements || [])
        .filter((element) => !element.hidden)
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      for (const element of elements) {
        if (element.type !== 'game') continue
        if (typeof element.id !== 'string' || !element.id.trim())
          throwInvalid([{ path: ['elementId'], message: 'Provide a stable game element ID' }])
        const tuple = gameInstanceKey({ effectiveSlideId, elementId: element.id })
        if (tuples.has(tuple))
          throwInvalid([
            { path: ['elementId'], message: `Duplicate effective game tuple: ${tuple}` },
          ])
        tuples.add(tuple)
        const config = normalizeGameConfig(element)
        throwInvalid(
          validateGameConfig(element.gameType, config).errors,
          `${effectiveSlideId}/${element.id} configuration`
        )
        descriptors.push({
          effectiveSlideId,
          elementId: element.id,
          gameType: element.gameType,
          config,
        })
      }
    }
  }
  return descriptors
}
module.exports = { collectEffectiveGameDescriptors }
