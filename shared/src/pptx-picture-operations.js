const { cloneTextData } = require('./pptx-text-document')
const { fields, validatePictureOverride, materializePicture } = require('./pptx-picture-document')
const { pictureReplacement, occurrencePictureReplacement, pictureAsset,
  samePictureReplacement } = require('./pptx-picture-replacement')
const { semanticDefinition, semanticInstance, replaceSemanticRecords } = require('./pptx-semantic-records')
const PICTURE_EDIT = 'picture.edit'
const PICTURE_LEGACY_FIELDS = ['cropData', 'crop', 'imageW', 'imageH', 'imageOffsetX', 'imageOffsetY',
  'opacity', 'objectFit', 'filterBrightness', 'filterContrast', 'filterGrayscale', 'filterSaturate',
  'filterSepia', 'filterBlur', 'borderWidth', 'borderColor', 'borderRadius', 'flipH', 'flipV',
  'shadowBlur', 'shadowX', 'shadowY', 'shadowColor']
function pictureOperationAvailable(document, instanceId) {
  let instance = semanticInstance(document, instanceId)
  if (!semanticDefinition(document, instance?.definitionId)?.content.pictureDocument) return false
  while (instance) {
    if (instance.overrides.locked || instance.lineage?.tombstone || instance.lineage?.paintOnly)
      return false
    instance = semanticInstance(document, instance.parentInstanceId)
  }
  return true
}
function editPictureOccurrence(document, instanceId, componentId, intent) {
  const command = cloneTextData(intent)
  const instance = semanticInstance(document, instanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  if (!pictureOperationAvailable(document, instanceId) ||
      definition.content.pictureDocument.componentId !== componentId)
    throw new TypeError('Unavailable or foreign picture operation')
  const source = definition.content.pictureDocument
  const components = { ...instance.overrides.components }
  const patch = { ...components[componentId]?.picture }
  if (command?.type === 'reset') {
    fields(command, ['type'], ['type'])
    if (patch.replacement) components[componentId] = { picture: { replacement: patch.replacement } }
    else delete components[componentId]
  } else {
    if (['replace', 'restore-source'].includes(command?.type)) {
      const keys = command.type === 'replace'
        ? ['type', 'replacement', 'expectedReplacement'] : ['type', 'expectedReplacement']
      fields(command, keys, keys)
      if (command.expectedReplacement !== null) pictureReplacement(command.expectedReplacement)
      if (!samePictureReplacement(occurrencePictureReplacement(definition, instance), command.expectedReplacement))
        throw new TypeError('Stale picture replacement')
      if (command.type === 'replace') patch.replacement = pictureReplacement(command.replacement)
      else delete patch.replacement
    } else if (command?.type === 'reset-crop') {
      fields(command, ['type'], ['type'])
      delete patch.srcRect
    } else if (command?.type === 'crop') {
      fields(command, ['type', 'edge', 'value'], ['type', 'edge', 'value'])
      if (!['l', 't', 'r', 'b'].includes(command.edge)) throw new TypeError('Invalid picture crop edge')
      patch.srcRect = { ...patch.srcRect, [command.edge]: command.value }
      if (command.value === source.srcRect?.[command.edge]) delete patch.srcRect[command.edge]
      if (!Object.keys(patch.srcRect).length) delete patch.srcRect
    } else if (command?.type === 'alpha') {
      fields(command, ['type', 'stages'], ['type', 'stages'])
      patch.alpha = command.stages
      if (JSON.stringify(patch.alpha) === JSON.stringify(source.alpha)) delete patch.alpha
    } else if (command?.type === 'filters') {
      fields(command, ['type', 'stages'], ['type', 'stages'])
      patch.filters = command.stages
      if (JSON.stringify(patch.filters) === JSON.stringify(source.filters ?? [])) delete patch.filters
    } else throw new TypeError('Unsupported picture command')
    const override = { picture: patch }
    validatePictureOverride(definition, componentId, override)
    if (Object.keys(patch).length) components[componentId] = override
    else delete components[componentId]
  }
  const overrides = { ...instance.overrides }
  if (Object.keys(components).length) overrides.components = components
  else delete overrides.components
  return replaceSemanticRecords(document, { instances: { [instanceId]: { ...instance, overrides } } })
}
function applyPicturePresentationOperation(input, intent) {
  const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation')
  const operation = cloneTextData(intent)
  fields(operation, ['type', 'instanceId', 'componentId', 'command'],
    ['type', 'instanceId', 'componentId', 'command'])
  if (operation.type !== PICTURE_EDIT) throw new TypeError('Invalid picture operation')
  const presentation = normalizeSemanticPresentation(input)
  if (operation.command.type === 'replace' &&
      operation.command.replacement?.presentationId !== presentation.id)
    throw new TypeError('Foreign picture upload scope')
  const document = presentation.pptxSemantic
  let found = false
  function check(slides, ancestorLocked = false) {
    for (const slide of slides) {
      const locked = ancestorLocked || slide.locked
      for (const element of slide.elements || []) if (element.pptxInstanceId === operation.instanceId) {
        if (found || locked || element.locked) throw new TypeError('Locked or ambiguous picture target')
        found = true
      }
      check(slide.children || [], locked)
    }
  }
  check(presentation.slides)
  if (!found) throw new TypeError('Missing picture target')
  const next = editPictureOccurrence(document, operation.instanceId, operation.componentId, operation.command)
  const instance = semanticInstance(next, operation.instanceId)
  const asset = pictureAsset(semanticDefinition(next, instance.definitionId), instance)
  const project = (slides) => slides.map((slide) => ({
    ...slide,
    elements: (slide.elements || []).map((element) => element.pptxInstanceId === instance.id
      ? { ...element, src: asset.src } : element),
    ...(slide.children ? { children: project(slide.children) } : {}),
  }))
  return normalizeSemanticPresentation({ ...presentation, slides: project(presentation.slides), pptxSemantic: next })
}
function pictureCompatibilityElement(document, element) {
  const instance = semanticInstance(document, element.pptxInstanceId)
  const definition = semanticDefinition(document, instance?.definitionId)
  if (!definition?.content.pictureDocument) return element
  const asset = pictureAsset(definition, instance)
  if (element.type !== 'image' || element.src !== asset.src)
    throw new TypeError('Picture media projection binding mismatch')
  const { materializeGeometry } = require('./pptx-geometry-style-resolution')
  const { deriveGeometryPaths } = require('./pptx-geometry-document')
  const { instanceWorldTransform } = require('./pptx-semantic-groups')
  const { presetShadowNeedsInkBounds } = require('./pptx-geometry-preset-shadow')
  const geometry = materializeGeometry(document, instance.id)
  const fill = geometry?.style?.fill
  if (!geometry || geometry.width <= 0 || geometry.height <= 0 ||
      presetShadowNeedsInkBounds(geometry.style?.effects) ||
      (fill && !(Object.keys(fill).length === 1 && fill.color?.kind === 'none')) ||
      deriveGeometryPaths(geometry).paths.some((path) =>
        path.fill !== undefined && !['norm', 'none'].includes(path.fill)))
    throw new TypeError('Unsupported picture geometry/effects')
  const result = { ...element }
  for (const key of PICTURE_LEGACY_FIELDS)
    delete result[key]
  if (result._pptxImportMeta) {
    result._pptxImportMeta = { ...result._pptxImportMeta }
    for (const key of ['sourceCrop', 'cropData', 'sourceBox']) delete result._pptxImportMeta[key]
  }
  return { ...result, pptxPicture: materializePicture(definition, instance),
    pptxPictureGeometry: geometry, pptxPictureAsset: asset,
    pptxOccurrenceMatrix: instanceWorldTransform(document, instance.id) }
}
module.exports = { PICTURE_EDIT, PICTURE_LEGACY_FIELDS, pictureOperationAvailable, editPictureOccurrence,
  applyPicturePresentationOperation, pictureCompatibilityElement }
