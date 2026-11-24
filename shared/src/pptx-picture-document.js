// Picture source declarations are immutable. Native percentages are 1/1000%.
const { blipParameters } = require('./pptx-geometry-blip')
const { cloneTextData } = require('./pptx-text-document')
const { safePartUri } = require('./pptx-semantic-family-documents')
const { pictureReplacement } = require('./pptx-picture-replacement')
const fail = (detail) => { throw new TypeError(`Invalid PPTX picture: ${detail}`) }
function fields(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) fail('record fields')
}
function nativeInteger(value, min = -2147483648, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail('native integer')
}
function alphaStages(stages) {
  if (!Array.isArray(stages) || stages.length > 64) fail('alpha stage budget')
  for (const stage of stages) {
    fields(stage, ['kind', 'amt'], ['kind'])
    if (stage.kind !== 'alphaModFix') fail('unsupported alpha effect')
    if (Object.hasOwn(stage, 'amt')) nativeInteger(stage.amt, 0)
  }
}
function pictureFilters(filters) {
  if (!Array.isArray(filters) || filters.length > 64) fail('filter stage budget')
  for (const stage of filters) {
    if (stage.kind === 'inv') {
      fields(stage, ['kind'], ['kind'])
    } else if (stage.kind === 'lum') {
      fields(stage, ['kind', 'bright', 'contrast'], ['kind'])
      if (Object.hasOwn(stage, 'bright')) nativeInteger(stage.bright, -100000, 100000)
      if (Object.hasOwn(stage, 'contrast')) nativeInteger(stage.contrast, -100000, 100000)
    } else {
      fail('unsupported color filter')
    }
  }
}
function pictureParameters(input) {
  const value = cloneTextData(input)
  fields(value, ['schemaVersion', 'componentId', 'mediaBinding', 'alpha', 'filters', 'cstate',
    'dpi', 'rotWithShape', 'srcRect', 'tile', 'stretch', 'useLocalDpi'],
  ['schemaVersion', 'componentId', 'mediaBinding', 'alpha'])
  if (value.schemaVersion !== 1 || typeof value.componentId !== 'string' ||
      !value.componentId || value.componentId.length > 1024) fail('source component')
  const { schemaVersion: _version, componentId, mediaBinding, alpha, filters, cstate, useLocalDpi, ...placement } = value
  fields(mediaBinding, ['partUri', 'relationshipId', 'sha256'], ['partUri', 'relationshipId', 'sha256'])
  if (!safePartUri(mediaBinding.partUri) || !mediaBinding.partUri.startsWith('ppt/media/') ||
      typeof mediaBinding.relationshipId !== 'string' || !mediaBinding.relationshipId ||
      mediaBinding.relationshipId.length > 1024 || !/^[a-f0-9]{64}$/.test(mediaBinding.sha256))
    fail('media binding')
  if (cstate !== undefined && !['none', 'email', 'screen', 'print', 'hqprint'].includes(cstate))
    fail('compression state')
  if (useLocalDpi !== undefined) {
    fields(useLocalDpi, ['componentId', 'value'], ['componentId'])
    if (typeof useLocalDpi.componentId !== 'string' || !useLocalDpi.componentId ||
        useLocalDpi.componentId.length > 1024 ||
        (Object.hasOwn(useLocalDpi, 'value') && typeof useLocalDpi.value !== 'boolean'))
      fail('local compression declaration')
  }
  if (Object.hasOwn(value, 'srcRect')) fields(value.srcRect, ['l', 't', 'r', 'b'])
  blipParameters({ bindingId: componentId, ...placement })
  alphaStages(alpha)
  if (filters !== undefined) pictureFilters(filters)
  return value
}
function validatePictureDefinition(definition) {
  const input = definition.content.pictureDocument
  if (input === undefined) return
  if (definition.kind !== 'image' || definition.origin === 'project') fail('source definition')
  const picture = pictureParameters(input), media = definition.content.media
  const component = definition.components.find((item) => item.id === picture.componentId)
  const root = definition.source.componentLocator?.path
  if (!component || component.kind !== 'property' || !component.locator.path ||
      component.locator.preconditionHash !== definition.source.preconditionHash ||
      !root || component.locator.path.length !== root.length + 1 ||
      root.some((index, at) => component.locator.path[at] !== index))
    fail('source locator')
  if (picture.useLocalDpi) {
    const declaration = definition.components.find((item) => item.id === picture.useLocalDpi.componentId)
    const expected = [...component.locator.path, 0, picture.alpha.length + (picture.filters?.length ?? 0), 0, 0]
    if (!declaration || declaration.kind !== 'property' ||
        declaration.locator.preconditionHash !== definition.source.preconditionHash ||
        JSON.stringify(declaration.locator.path) !== JSON.stringify(expected))
      fail('local compression source locator')
  }
  fields(media, ['partUri', 'relationshipId', 'sha256', 'src', 'width', 'height'],
    ['partUri', 'relationshipId', 'sha256', 'src', 'width', 'height'])
  if (Object.keys(picture.mediaBinding).some((key) => picture.mediaBinding[key] !== media[key]))
    fail('foreign media binding')
  if (typeof media.src !== 'string' || !/^\/uploads\/[a-zA-Z0-9/_-]+\.(png|jpg|gif|webp|bmp)$/.test(media.src) ||
      media.src.includes('//')) fail('source upload')
  nativeInteger(media.width, 1)
  nativeInteger(media.height, 1)
}
function validatePictureOverride(definition, componentId, override) {
  const source = definition.content.pictureDocument
  if (!source) {
    if (override?.picture !== undefined) fail('missing source picture')
    return false
  }
  if (componentId !== source.componentId) {
    if (override?.picture !== undefined) fail('foreign picture component')
    return false
  }
  fields(override, ['picture'], ['picture'])
  fields(override.picture, ['srcRect', 'alpha', 'filters', 'replacement'])
  const patch = override.picture
  if (Object.hasOwn(patch, 'replacement')) pictureReplacement(patch.replacement)
  if (Object.hasOwn(patch, 'srcRect')) {
    fields(patch.srcRect, ['l', 't', 'r', 'b'])
    for (const value of Object.values(patch.srcRect)) if (value !== null) nativeInteger(value)
  }
  if (Object.hasOwn(patch, 'alpha')) alphaStages(patch.alpha)
  if (Object.hasOwn(patch, 'filters')) pictureFilters(patch.filters)
  materializePicture(definition, { definitionId: definition.id, overrides: { components: { [componentId]: override } } })
  return true
}
function materializePicture(definition, instance) {
  if (instance.definitionId !== definition.id) fail('occurrence binding')
  const source = definition.content.pictureDocument
  const patch = instance.overrides.components?.[source.componentId]?.picture
  const effective = { ...source }
  if (patch?.srcRect) {
    effective.srcRect = { ...source.srcRect }
    for (const [key, value] of Object.entries(patch.srcRect)) {
      if (value === null) delete effective.srcRect[key]
      else effective.srcRect[key] = value
    }
  }
  if (patch?.alpha) effective.alpha = patch.alpha
  if (patch?.filters) effective.filters = patch.filters
  return pictureParameters(effective)
}
module.exports = {
  fields, nativeInteger, alphaStages, pictureParameters, validatePictureDefinition,
  validatePictureOverride, materializePicture, pictureFilters,
}
