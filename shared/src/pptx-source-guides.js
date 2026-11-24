const { isGeometryStyleColor } = require('./pptx-geometry-style-records')
const { isGeometryColorTransform } = require('./pptx-geometry-color')

// MS-PPTX 2.2.11. These are immutable authoring aids, not slide paint or editable occurrences.
const GUIDE_NAMESPACE = 'http://schemas.microsoft.com/office/powerpoint/2012/main'
const GUIDE_OWNERS = Object.freeze([
  ['presentation', 'sldGuideLst', '{EFAFB233-063F-42B5-8137-9DF3F51BA10A}'],
  ['presentation', 'notesGuideLst', '{2D200454-40CA-4A62-9FC3-DE9A4176ACB9}'],
  ['sldLayout', 'sldGuideLst', '{DCECCB84-F9BA-43D5-87BE-67443E8EF086}'],
  ['sldMaster', 'sldGuideLst', '{27BBF7A9-308A-43DC-89C8-2F10F3537804}'],
  ['handoutMaster', 'sldGuideLst', '{56416CCD-93CA-4268-BC5B-53C4BB910035}'],
  ['notesMaster', 'sldGuideLst', '{620B2872-D7B9-4A21-9093-7833F8D536E1}'],
].map(Object.freeze))
const P = new Set(['http://schemas.openxmlformats.org/presentationml/2006/main',
  'http://purl.oclc.org/ooxml/presentationml/main'])
const keys = (v, required, optional = []) => v && typeof v === 'object' && !Array.isArray(v) &&
  required.every((key) => Object.hasOwn(v, key)) && Object.keys(v).every((key) => required.includes(key) || optional.includes(key))
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const integer = (v, min, max) => Number.isSafeInteger(v) && v >= min && v <= max

function validateSourceGuideList(definition) {
  const record = definition.content.sourceGuideList
  if (definition.kind !== 'source-guide-list' && record === undefined) return
  const fail = (reason) => {
    throw new TypeError(`Invalid source guide list: ${reason}`)
  }
  const source = definition.source, path = definition.components.find((c) => c.id === record?.componentId)?.locator.path
  if (definition.kind !== 'source-guide-list' || definition.origin === 'project' ||
    !keys(definition.content, ['sourceGuideList']) ||
    !keys(source, ['partUri', 'preconditionHash', 'componentLocator']) ||
    !same(source.componentLocator.path, path) ||
    !keys(record, ['ownerRoot', 'localName', 'namespaceUri', 'extensionUri', 'componentId', 'wrapperLocator', 'guides'], ['extensionList']) ||
    !keys(record.ownerRoot, ['localName', 'namespaceUri']) || !P.has(record.ownerRoot.namespaceUri) ||
    record.namespaceUri !== GUIDE_NAMESPACE ||
    !GUIDE_OWNERS.some(([owner, local, uri]) => owner === record.ownerRoot.localName && local === record.localName && uri === record.extensionUri) ||
    (record.ownerRoot.localName === 'presentation' && source.partUri !== 'ppt/presentation.xml') ||
    !path || path.length !== 4 || path[0] !== 0 || path[3] !== 0 ||
    definition.id !== `${source.partUri}#source-guide-list:${path.join('.')}` ||
    !keys(record.wrapperLocator, ['path', 'preconditionHash']) ||
    !same(record.wrapperLocator.path, path.slice(0, -1)) || record.wrapperLocator.preconditionHash !== source.preconditionHash ||
    !Array.isArray(record.guides)) fail('invalid guide list definition structure, locators or owner root')
  const expected = new Set([path.join('.')])
  const bound = (entry, at, check) =>
    keys(entry, ['source', 'value']) && keys(entry.source, ['partUri', 'preconditionHash', 'componentLocator']) &&
    entry.source.partUri === source.partUri && entry.source.preconditionHash === source.preconditionHash &&
    keys(entry.source.componentLocator, ['path', 'preconditionHash']) &&
    entry.source.componentLocator.preconditionHash === source.preconditionHash &&
    same(entry.source.componentLocator.path, at) && check(entry.value)
  const emptyExtension = (entry, at) => {
    expected.add(at.join('.'))
    return bound(entry, at, (v) => keys(v, []))
  }
  const ids = new Set()
  for (const [index, entry] of record.guides.entries()) {
    const at = [...path, index], value = entry?.value
    expected.add(at.join('.'))
    expected.add([...at, 0].join('.'))
    if (!bound(entry, at, (v) => keys(v, ['id', 'color'], ['name', 'orient', 'pos', 'userDrawn', 'extensionList'])) ||
      !integer(value.id, 0, 4294967295) || ids.has(value.id) ||
      (Object.hasOwn(value, 'name') && typeof value.name !== 'string') ||
      (Object.hasOwn(value, 'orient') && !['horz', 'vert'].includes(value.orient)) ||
      (Object.hasOwn(value, 'pos') && !integer(value.pos, -2147483648, 2147483647)) ||
      (Object.hasOwn(value, 'userDrawn') && typeof value.userDrawn !== 'boolean') ||
      !bound(value.color, [...at, 0, 0], (color) => isGeometryStyleColor(color, (transform, ordinal) =>
        bound(transform, [...at, 0, 0, ordinal], isGeometryColorTransform))) ||
      (Object.hasOwn(value, 'extensionList') && !emptyExtension(value.extensionList, [...at, 1]))) fail(`invalid guide entry at index ${index}`)
    ids.add(value.id)
  }
  if (Object.hasOwn(record, 'extensionList') && !emptyExtension(record.extensionList, [...path, record.guides.length])) fail('invalid guide list trailing extensionList')
  if (definition.components.length !== expected.size) fail('component count mismatch against expected unknown-extension locators')
  for (const component of definition.components) {
    const locator = component.locator.path.join('.')
    if (!keys(component, ['id', 'kind', 'locator']) || component.kind !== 'property' ||
      !expected.delete(locator) || component.id !== `${source.partUri}#unknown-extension:${locator}`) fail(`invalid or unmatched component definition: ${locator}`)
  }
}
module.exports = { GUIDE_NAMESPACE, GUIDE_OWNERS, validateSourceGuideList }
