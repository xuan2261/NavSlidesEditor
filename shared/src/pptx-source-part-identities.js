// Nonvisual source provenance only; never an editable occurrence or export authority.
const SOURCE_PART_IDENTITIES = Object.freeze({
  commonSlideCreationId: Object.freeze({
    localName: 'creationId',
    namespaceUri: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
    extensionUri: '{BB962C8B-B14F-4D97-AF65-F5344CB8AC3E}',
  }),
  themeFamily: Object.freeze({
    localName: 'themeFamily',
    namespaceUri: 'http://schemas.microsoft.com/office/thememl/2012/main',
    extensionUri: '{05A4C25C-085E-4340-85A3-A5531E510DB2}',
  }),
})
const P = new Set([
  'http://schemas.openxmlformats.org/presentationml/2006/main',
  'http://purl.oclc.org/ooxml/presentationml/main',
])
const A = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/main',
  'http://purl.oclc.org/ooxml/drawingml/main',
])
const GUID = /^\{[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\}$/i
const keys = (value, expected) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function validIdentityValue(type, value) {
  return type === 'commonSlideCreationId'
    ? Number.isSafeInteger(value) && value >= 0 && value <= 4294967295
    : type === 'themeFamily' &&
        keys(value, ['name', 'id', 'vid']) &&
        typeof value.name === 'string' &&
        typeof value.id === 'string' &&
        GUID.test(value.id) &&
        typeof value.vid === 'string' &&
        GUID.test(value.vid)
}

function validateSourcePartIdentity(definition) {
  const entry = definition.content.sourcePartIdentity
  if (definition.kind !== 'source-part-identity' && entry === undefined) return
  const fail = () => {
    throw new TypeError('Invalid source part identity')
  }
  const spec =
    entry && Object.hasOwn(SOURCE_PART_IDENTITIES, entry.type) && SOURCE_PART_IDENTITIES[entry.type]
  const theme = entry?.type === 'themeFamily'
  const component = definition.components[0]
  const path = component?.locator.path
  const hash = definition.source.preconditionHash
  if (
    definition.kind !== 'source-part-identity' ||
    !keys(definition.content, ['sourcePartIdentity']) ||
    !keys(definition.source, ['partUri', 'preconditionHash', 'componentLocator']) ||
    definition.id !== `${definition.source.partUri}#source-part-identity:0` ||
    !same(definition.source.componentLocator.path, [0]) ||
    !spec ||
    !keys(entry, [
      'type',
      'value',
      'ownerRoot',
      'namespaceUri',
      'extensionUri',
      'componentId',
      'ownerLocator',
      'wrapperLocator',
    ]) ||
    !validIdentityValue(entry.type, entry.value) ||
    entry.namespaceUri !== spec.namespaceUri ||
    entry.extensionUri !== spec.extensionUri ||
    !keys(entry.ownerRoot, ['localName', 'namespaceUri']) ||
    (theme
      ? !A.has(entry.ownerRoot.namespaceUri) || entry.ownerRoot.localName !== 'theme'
      : !P.has(entry.ownerRoot.namespaceUri) ||
        !['sld', 'sldLayout', 'sldMaster', 'notes', 'notesMaster'].includes(
          entry.ownerRoot.localName
        )) ||
    definition.components.length !== 1 ||
    !keys(component, ['id', 'kind', 'locator']) ||
    component.kind !== 'property' ||
    entry.componentId !== component.id ||
    !path ||
    path.length !== (theme ? 4 : 5) ||
    path[0] !== 0 ||
    (!theme && path[1] !== 0) ||
    path.at(-1) !== 0 ||
    component.id !== `${definition.source.partUri}#unknown-extension:${path.join('.')}` ||
    !keys(entry.ownerLocator, ['path', 'preconditionHash']) ||
    !same(entry.ownerLocator.path, theme ? [0] : [0, 0]) ||
    entry.ownerLocator.preconditionHash !== hash ||
    !keys(entry.wrapperLocator, ['path', 'preconditionHash']) ||
    !same(entry.wrapperLocator.path, path.slice(0, -1)) ||
    entry.wrapperLocator.preconditionHash !== hash
  )
    fail()
}
module.exports = { SOURCE_PART_IDENTITIES, validIdentityValue, validateSourcePartIdentity }
