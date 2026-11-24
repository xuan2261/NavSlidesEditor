// Typed source declarations only; these do not confer native export authority.
const { isGeometryStyleColor } = require('./pptx-geometry-style-records')
const { isGeometryColorTransform } = require('./pptx-geometry-color')
const PRESENTATION_PROPERTIES = Object.freeze({
  discardImageEditData: Object.freeze({
    namespaceUri: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
    extensionUri: '{E76CE94A-603C-4142-B9EB-6D1370010A27}',
    type: 'boolean',
  }),
  defaultImageDpi: Object.freeze({
    namespaceUri: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
    extensionUri: '{D31A062A-798A-4329-ABDD-BBA856620510}',
    type: 'unsignedInt',
  }),
  chartTrackingRefBased: Object.freeze({
    namespaceUri: 'http://schemas.microsoft.com/office/powerpoint/2012/main',
    extensionUri: '{FD5EFAAD-0ECE-453E-9831-46B23BE46B34}',
    type: 'boolean',
  }),
})
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const keys = (value, expected) =>
  value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key))

function validatePresentationProperties(definition) {
  const properties = definition.content.presentationProperties
  const colorMru = definition.content.colorMru
  if (definition.kind !== 'presentation-properties' && properties === undefined && colorMru === undefined) return
  const fail = () => { throw new TypeError('Invalid source presentation properties') }
  if (
    definition.kind !== 'presentation-properties' ||
    definition.origin === 'project' ||
    !keys(definition.content, colorMru === undefined ? ['presentationProperties'] : ['presentationProperties', 'colorMru']) ||
    !properties || typeof properties !== 'object' || Array.isArray(properties) ||
    (!Object.keys(properties).length && colorMru === undefined) ||
    definition.source.nativeId !== undefined ||
    definition.id !== `${definition.source.partUri}#presentation-properties:0` ||
    !same(definition.source.componentLocator.path, [0]) ||
    definition.components.length !== Object.keys(properties).length + (colorMru === undefined ? 0 : 1)
  ) fail()
  const used = new Set()
  if (colorMru !== undefined) {
    const component = definition.components.find((item) => item.id === colorMru?.componentId)
    const bound = (entry, path, check) =>
      keys(entry, ['source', 'value']) &&
      keys(entry.source, ['partUri', 'preconditionHash', 'componentLocator']) &&
      entry.source.partUri === definition.source.partUri &&
      entry.source.preconditionHash === definition.source.preconditionHash &&
      keys(entry.source.componentLocator, ['path', 'preconditionHash']) &&
      entry.source.componentLocator.preconditionHash === definition.source.preconditionHash &&
      same(entry.source.componentLocator.path, path) && check(entry.value)
    if (
      !keys(colorMru, ['componentId', 'colors']) ||
      colorMru.componentId !== `${definition.source.partUri}#color-mru:0.0` ||
      !component || component.kind !== 'property' || component.partUri !== undefined ||
      !same(component.locator.path, [0, 0]) ||
      !Array.isArray(colorMru.colors) ||
      !colorMru.colors.every((entry, index) => bound(entry, [0, 0, index], (color) =>
        isGeometryStyleColor(color, (transform, ordinal) =>
          bound(transform, [0, 0, index, ordinal], isGeometryColorTransform))))
    ) fail()
    used.add(component.id)
  }
  for (const [name, entry] of Object.entries(properties)) {
    const spec = Object.hasOwn(PRESENTATION_PROPERTIES, name) && PRESENTATION_PROPERTIES[name]
    const component = definition.components.find((item) => item.id === entry?.componentId)
    const path = component?.locator.path
    if (
      !spec || !keys(entry, ['value', 'namespaceUri', 'extensionUri', 'componentId', 'wrapperLocator']) ||
      entry.namespaceUri !== spec.namespaceUri || entry.extensionUri !== spec.extensionUri ||
      (spec.type === 'boolean'
        ? typeof entry.value !== 'boolean'
        : !Number.isSafeInteger(entry.value) || entry.value < 0 || entry.value > 4294967295) ||
      !component || component.kind !== 'property' || component.partUri !== undefined ||
      used.has(component.id) || !path || path.length !== 4 ||
      path[0] !== 0 || path[1] !== (colorMru === undefined ? 0 : 1) || path[3] !== 0 ||
      component.id !== `${definition.source.partUri}#unknown-extension:${path.join('.')}` ||
      !keys(entry.wrapperLocator, ['path', 'preconditionHash']) ||
      !same(entry.wrapperLocator.path, path.slice(0, -1)) ||
      entry.wrapperLocator.preconditionHash !== definition.source.preconditionHash
    ) fail()
    used.add(component.id)
  }
}
module.exports = { PRESENTATION_PROPERTIES, validatePresentationProperties }
