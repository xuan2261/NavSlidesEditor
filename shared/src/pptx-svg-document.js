const { normalizeGeometryDocument } = require('./pptx-geometry-document')
const { cloneFamilyData } = require('./pptx-family-operations-data')
const { PARAMETERS, normalizePrimitive, primitiveGeometry } = require('./pptx-vector-primitives')

const fail = (detail) => { throw new TypeError(`Invalid PPTX SVG: ${detail}`) }
const safePartUri = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 1024 &&
  !/[\\:#?]/.test(value) &&
  ![...value].some((c) => c.charCodeAt(0) <= 32 || c.charCodeAt(0) === 127) &&
  !/%(?:2f|5c|2e)/i.test(value) &&
  !value.split('/').some((segment) => !segment || segment === '.' || segment === '..')
function fields(value, allowed, required = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key)) ||
      required.some((key) => !Object.hasOwn(value, key))) fail('record fields')
}
function source(value, root = false) {
  fields(value, root
    ? ['partUri', 'preconditionHash', 'byteLength', 'path']
    : ['partUri', 'preconditionHash', 'path', 'attribute', 'element', 'ordinal'],
  root ? ['partUri', 'preconditionHash', 'byteLength', 'path']
    : ['partUri', 'preconditionHash', 'path', 'ordinal'])
  if (!safePartUri(value.partUri) || !/^[a-f0-9]{64}$/.test(value.preconditionHash) ||
      !Array.isArray(value.path) || !value.path.length ||
      value.path.some((index) => !Number.isSafeInteger(index) || index < 0)) fail('source locator')
  if (root) {
    if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > 1048576)
      fail('source byte length')
  } else if (!Number.isSafeInteger(value.ordinal) || value.ordinal < 0 ||
      !(value.attribute === 'd' && value.element === undefined ||
        value.attribute === undefined && Object.hasOwn(PARAMETERS, value.element))) {
    fail('component source role')
  }
  return value
}
function normalizeSvgDocument(input) {
  input = cloneFamilyData(input)
  fields(input, ['schemaVersion', 'componentId', 'source', 'viewBox', 'paths', 'preserveAspectRatio'],
    ['schemaVersion', 'componentId', 'source', 'viewBox', 'paths'])
  if (input.schemaVersion !== 1 || typeof input.componentId !== 'string' ||
      !input.componentId || input.componentId.length > 1024) fail('identity')
  const svgSource = source(input.source, true)
  fields(input.viewBox, ['x', 'y', 'width', 'height'], ['x', 'y', 'width', 'height'])
  const { x, y, width, height } = input.viewBox
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0 ||
      [x, y, width, height].some((value) => Math.abs(value) > 1e12)) fail('viewBox')
  if (input.preserveAspectRatio !== undefined && (typeof input.preserveAspectRatio !== 'string' ||
      !/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(input.preserveAspectRatio))) fail('viewport alignment')
  if (!Array.isArray(input.paths) || input.paths.length < 1 || input.paths.length > 256)
    fail('path budget')
  const ids = new Set([input.componentId]), locations = new Set()
  const paths = input.paths.map((item) => {
    fields(item, ['componentId', 'source', 'geometry', 'primitive', 'transform'], ['componentId', 'source', 'geometry'])
    if (typeof item.componentId !== 'string' || !item.componentId || item.componentId.length > 1024 ||
        ids.has(item.componentId)) fail('path identity')
    ids.add(item.componentId)
    const location = source(item.source)
    if (location.partUri !== svgSource.partUri || location.preconditionHash !== svgSource.preconditionHash ||
        location.path.length <= svgSource.path.length ||
        !svgSource.path.every((index, at) => location.path[at] === index)) fail('path source owner')
    const sourceKey = `${location.partUri}:${location.path.join('.')}`
    if (locations.has(sourceKey)) fail('duplicate path source')
    locations.add(sourceKey)
    const geometry = normalizeGeometryDocument(item.geometry)
    const primitive = item.primitive === undefined ? undefined : normalizePrimitive(item.primitive)
    if (primitive && (primitive.kind !== location.element ||
        JSON.stringify(primitiveGeometry(geometry, primitive)) !== JSON.stringify(geometry)))
      fail('primitive geometry authority')
    if (item.transform !== undefined && (!Array.isArray(item.transform) || item.transform.length !== 6 ||
        item.transform.some((number) => !Number.isFinite(number) || Math.abs(number) > 1e12))) fail('transform')
    return { componentId: item.componentId, source: { ...location, path: [...location.path] }, geometry,
      ...(primitive ? { primitive } : {}), ...(item.transform ? { transform: [...item.transform] } : {}) }
  })
  return { schemaVersion: 1, componentId: input.componentId,
    source: { ...svgSource, path: [...svgSource.path] },
    ...(input.preserveAspectRatio === undefined ? {} : { preserveAspectRatio: input.preserveAspectRatio }),
    viewBox: { x, y, width, height }, paths }
}
module.exports = { normalizeSvgDocument }
