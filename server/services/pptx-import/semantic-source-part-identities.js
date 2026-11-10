const { attr, decodeXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { resolveTarget } = require('./package-store/raw-zip')
const {
  SOURCE_PART_IDENTITIES,
  validIdentityValue,
} = require('../../../shared/src/pptx-source-part-identities')
const R = [
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
]
const attributes = (node) => node.attrs.filter((item) => !/^xmlns(?::|$)/.test(item.name))
const value = (node, name) => decodeXml(attr(node, name) ?? '')

function projectSourcePartIdentities({
  inventory,
  parts,
  nodes,
  relationships,
  semantic,
  dispositions,
  fail,
}) {
  const seen = new Set()
  for (const entry of inventory.definitions) {
    const pair = Object.entries(SOURCE_PART_IDENTITIES).find(
      ([, spec]) => entry.namespaceUri === spec.namespaceUri && entry.localName === spec.localName
    )
    if (!pair) continue
    const [type, spec] = pair
    const { partUri, preconditionHash } = entry
    const reject = (detail) => fail(entry, `source part identity ${detail}`)
    if (seen.has(partUri)) reject('ambiguous declaration')
    seen.add(partUri)
    const { roots, xml } = parts.get(partUri)
    const root = roots[0]
    const theme = type === 'themeFamily'
    const namespaces = theme ? A_URIS : P_URIS
    const relationType = theme
      ? 'theme'
      : {
          sld: 'slide',
          sldLayout: 'slideLayout',
          sldMaster: 'slideMaster',
          notes: 'notesSlide',
          notesMaster: 'notesMaster',
        }[root?.local]
    if (
      roots.length !== 1 ||
      !namespaces.has(root?.uri) ||
      (theme ? root.local !== 'theme' : !relationType)
    )
      reject('wrong owner root')
    let bound = false
    for (const source of inventory.parts) {
      const sourceRoot = parts.get(source.partUri)?.roots[0]
      let matches = 0
      for (const relation of relationships(source.partUri)) {
        if (value(relation, 'TargetMode') === 'External') continue
        if (resolveTarget(source.partUri, value(relation, 'Target')) !== partUri) continue
        const allowedOwners = {
          slide: ['presentation', 'notes'],
          slideLayout: ['sld', 'sldMaster'],
          slideMaster: ['presentation', 'sldLayout'],
          theme: ['presentation', 'sld', 'sldLayout', 'sldMaster', 'notesMaster'],
          notesSlide: ['sld'],
          notesMaster: ['presentation', 'notes'],
        }[relationType]
        if (
          !P_URIS.has(sourceRoot?.uri) ||
          !allowedOwners.includes(sourceRoot.local) ||
          !R.some((uri) => value(relation, 'Type') === `${uri}/${relationType}`) ||
          !['', 'Internal'].includes(value(relation, 'TargetMode')) ||
          ++matches > 1
        )
          reject('missing/ambiguous relationship owner')
        bound = true
      }
    }
    if (!bound) reject('missing relationship owner')
    const owners = theme
      ? [root]
      : root.children.filter((node) => P_URIS.has(node.uri) && node.local === 'cSld')
    const owner = owners[0]
    if (owners.length !== 1 || (!theme && root.children[0] !== owner))
      reject('ambiguous common slide owner')
    const lists = owner.children.filter(
      (node) => namespaces.has(node.uri) && node.local === 'extLst'
    )
    const list = lists[0],
      wrapper = list?.children[0],
      declaration = nodes.get(entry.id)
    if (
      lists.length !== 1 ||
      attributes(list).length ||
      list.children.length !== 1 ||
      !namespaces.has(wrapper?.uri) ||
      wrapper.local !== 'ext' ||
      attributes(wrapper).length !== 1 ||
      attributes(wrapper)[0].name !== 'uri' ||
      value(wrapper, 'uri').toUpperCase() !== spec.extensionUri ||
      wrapper.children.length !== 1 ||
      wrapper.children[0] !== declaration ||
      declaration.children.length ||
      entry.parentDefinitionId !== null
    )
      reject('unsupported/malformed wrapper')
    const expectedAttrs = theme ? ['name', 'id', 'vid'] : ['val']
    const attrs = attributes(declaration)
    if (
      attrs.length !== expectedAttrs.length ||
      !expectedAttrs.every((name) => attrs.filter((item) => item.name === name).length === 1)
    )
      reject('unsupported/malformed attributes')
    for (const node of [list, wrapper, declaration]) {
      if (node.selfClosing) continue
      let cursor = node.end + 1
      for (const child of node.children) {
        if (xml.slice(cursor, child.start).trim()) reject('unexpected text')
        cursor = child.closeEnd + 1
      }
      if (xml.slice(cursor, node.closeStart).trim()) reject('unexpected text')
    }
    const raw = value(declaration, 'val')
    const typed = theme
      ? {
          name: value(declaration, 'name'),
          id: value(declaration, 'id'),
          vid: value(declaration, 'vid'),
        }
      : Number(raw)
    if ((!theme && !/^\+?\d+$/.test(raw)) || !validIdentityValue(type, typed))
      reject('invalid typed value')
    const ownerPath = theme ? [0] : [0, 0]
    const wrapperPath = [...ownerPath, owner.children.indexOf(list), 0]
    const path = [...wrapperPath, 0]
    if (JSON.stringify(entry.componentLocators[0].path) !== JSON.stringify(path))
      reject('missing/ambiguous locator')
    const id = `${partUri}#source-part-identity:0`
    semantic.definitions[id] = {
      id,
      kind: 'source-part-identity',
      source: { partUri, preconditionHash, componentLocator: { path: [0], preconditionHash } },
      content: {
        sourcePartIdentity: {
          type,
          value: typed,
          ownerRoot: { localName: root.local, namespaceUri: root.uri },
          namespaceUri: spec.namespaceUri,
          extensionUri: spec.extensionUri,
          componentId: entry.id,
          ownerLocator: { path: ownerPath, preconditionHash },
          wrapperLocator: { path: wrapperPath, preconditionHash },
        },
      },
      components: [{ id: entry.id, kind: 'property', locator: entry.componentLocators[0] }],
    }
    if (dispositions.has(entry.id)) reject('duplicate disposition')
    dispositions.set(entry.id, {
      definitionId: entry.id,
      partUri,
      locator: entry.componentLocators[0],
      disposition: 'semantically-mapped',
    })
  }
}
module.exports = { projectSourcePartIdentities }
