const { pictureReplacement } = require('revealjs-shared/src/pptx-picture-replacement')

// Inventory is read-only. Rebinding is a pure document rewrite, not upload authorization.
// These six receipt fields are literal in every schema; wire IDs/catalogs stay untouched.
function rewritePictureReplacementMedia(presentation, update, destinationId) {
  const document = presentation?.pptxSemantic
  const instances = {}
  for (const [id, instance] of Object.entries(document?.instances || {})) {
    let overrides
    for (const [componentId, component] of Object.entries(instance.overrides?.components || {})) {
      const source = component.picture?.replacement
      if (!source) continue
      const original = `/uploads/${source.filename}`
      const url = update(original)
      const owner = destinationId ?? source.presentationId
      if (url === original && owner === source.presentationId) continue
      if (typeof url !== 'string' || !url.startsWith('/uploads/'))
        throw new TypeError('Invalid replacement media URL')
      const replacement = pictureReplacement({ ...source, filename: url.slice('/uploads/'.length), presentationId: owner })
      overrides ??= structuredClone(instance.overrides)
      overrides.components[componentId].picture.replacement = replacement
    }
    if (overrides) instances[id] = { ...instance, overrides }
  }
  if (Object.keys(instances).length)
    presentation.pptxSemantic = { ...document, instances: { ...document.instances, ...instances } }
}
module.exports = { rewritePictureReplacementMedia }
