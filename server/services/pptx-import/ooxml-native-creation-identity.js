const { attr, decodeXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')

const NAMESPACE = 'http://schemas.microsoft.com/office/drawing/2014/main'
const EXTENSION_URI = '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}'
const GUID = /^\{[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\}$/i
const attributes = (node) =>
  node.attrs.filter((item) => item.name !== 'xmlns' && !item.name.startsWith('xmlns:'))

// Immutable source provenance, not an editable property or an extension bag.
function readNativeCreationIdentity(context, fail) {
  const { source, node, components, nodes, xml } = context
  const entries = components.filter(
    (item) => item.namespaceUri === NAMESPACE && item.localName === 'creationId'
  )
  if (!entries.length) return undefined
  if (entries.length !== 1) fail(source, 'ambiguous native creation identity')
  const entry = entries[0]
  const declaration = nodes.get(entry.id)
  const nonvisualName = {
    shape: 'nvSpPr',
    group: 'nvGrpSpPr',
    picture: 'nvPicPr',
    connector: 'nvCxnSpPr',
    'graphic-frame': 'nvGraphicFramePr',
  }[source.kind]
  const nonvisual = node.children.filter(
    (item) => P_URIS.has(item.uri) && item.local === nonvisualName
  )
  const identities = nonvisual.flatMap((item) =>
    item.children.filter((child) => P_URIS.has(child.uri) && child.local === 'cNvPr')
  )
  const lists = identities.flatMap((item) =>
    item.children.filter((child) => A_URIS.has(child.uri) && child.local === 'extLst')
  )
  const wrappers = lists.flatMap((item) =>
    item.children.filter((child) => child.children.includes(declaration))
  )
  const wrapper = wrappers[0]
  const value = decodeXml(attr(declaration, 'id') ?? '')
  if (
    nonvisual.length !== 1 ||
    identities.length !== 1 ||
    lists.length !== 1 ||
    lists[0].children.length !== 1 ||
    attributes(lists[0]).length ||
    wrappers.length !== 1 ||
    !A_URIS.has(wrapper.uri) ||
    wrapper.local !== 'ext' ||
    wrapper.children.length !== 1 ||
    attributes(wrapper).length !== 1 ||
    attributes(wrapper)[0].name !== 'uri' ||
    decodeXml(attr(wrapper, 'uri') ?? '').toUpperCase() !== EXTENSION_URI ||
    declaration.children.length ||
    attributes(declaration).length !== 1 ||
    attributes(declaration)[0].name !== 'id' ||
    !GUID.test(value)
  )
    fail(source, 'unsupported/malformed native creation identity')
  for (const item of [lists[0], wrapper, declaration]) {
    if (item.selfClosing) continue
    let cursor = item.end + 1
    for (const child of item.children) {
      if (xml.slice(cursor, child.start).trim()) fail(source, 'native creation identity text')
      cursor = child.closeEnd + 1
    }
    if (xml.slice(cursor, item.closeStart).trim()) fail(source, 'native creation identity text')
  }
  return { value, componentId: entry.id }
}

module.exports = { readNativeCreationIdentity }
