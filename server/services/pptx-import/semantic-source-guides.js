const { attr, decodeXml, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { resolveTarget } = require('./package-store/raw-zip')
const { readColorSource } = require('./ooxml-color-source')
const { GUIDE_NAMESPACE, GUIDE_OWNERS } = require('../../../shared/src/pptx-source-guides')
const R = ['http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships']
const attributes = (node) => node.attrs.filter((item) => !/^xmlns(?::|$)/.test(item.name))
const raw = (node, name) => decodeXml(attr(node, name) ?? '')

function projectSourceGuideLists({ inventory, parts, nodes, relationships, semantic, dispositions, fail }) {
  const byNode = new Map(inventory.definitions.map((entry) => [nodes.get(entry.id), entry]))
  const seen = new Set()
  const mappedIds = new Set()
  for (const source of inventory.definitions) {
    if (source.namespaceUri !== GUIDE_NAMESPACE || !['sldGuideLst', 'notesGuideLst'].includes(source.localName)) continue
    const { partUri, preconditionHash } = source, { roots, xml } = parts.get(partUri)
    const root = roots[0], declaration = nodes.get(source.id)
    const reject = (detail) => fail(source, `source guide list ${detail}`)
    const spec = GUIDE_OWNERS.find(([owner, local]) => root?.local === owner && source.localName === local)
    if (!spec || roots.length !== 1 || !P_URIS.has(root.uri)) reject('wrong owner root')
    const key = `${partUri}:${source.localName}`
    if (seen.has(key)) reject('duplicate declaration')
    seen.add(key)
    if (root.local === 'presentation') {
      if (partUri !== 'ppt/presentation.xml') reject('wrong presentation owner')
    } else {
      const relationType = { sldLayout: 'slideLayout', sldMaster: 'slideMaster', notesMaster: 'notesMaster', handoutMaster: 'handoutMaster' }[root.local]
      const allowedOwners = { slideLayout: ['sld', 'sldMaster'], slideMaster: ['presentation', 'sldLayout'],
        notesMaster: ['presentation', 'notes'], handoutMaster: ['presentation'] }[relationType]
      let bound = false
      for (const owner of inventory.parts) {
        const ownerRoot = parts.get(owner.partUri)?.roots[0]
        let matches = 0
        for (const relation of relationships(owner.partUri)) {
          if (raw(relation, 'TargetMode') === 'External' || resolveTarget(owner.partUri, raw(relation, 'Target')) !== partUri) continue
          if (!P_URIS.has(ownerRoot?.uri) || !allowedOwners.includes(ownerRoot.local) ||
            !R.some((uri) => raw(relation, 'Type') === `${uri}/${relationType}`) ||
            !['', 'Internal'].includes(raw(relation, 'TargetMode')) || ++matches > 1) reject('missing/ambiguous relationship owner')
          bound = true
        }
      }
      if (!bound) reject('missing relationship owner')
    }
    const path = source.componentLocators[0].path
    const list = root.children[path[1]], wrapper = list?.children[path[2]]
    if (path.length !== 4 || path[0] !== 0 || path[3] !== 0 ||
      root.children.filter((n) => n.local === 'extLst').length !== 1 || list !== root.children.at(-1) ||
      !P_URIS.has(list?.uri) || list.local !== 'extLst' || attributes(list).length ||
      !P_URIS.has(wrapper?.uri) || wrapper.local !== 'ext' ||
      attributes(wrapper).length !== 1 || attributes(wrapper)[0].name !== 'uri' ||
      raw(wrapper, 'uri').toUpperCase() !== spec[2] || wrapper.children.length !== 1 || wrapper.children[0] !== declaration ||
      source.parentDefinitionId !== null) reject('unsupported/malformed wrapper')
    const locations = new Map(), consumed = new Set()
    const locate = (node, at) => { locations.set(node, at); node.children.forEach((child, i) => locate(child, [...at, i])) }
    locate(declaration, path)
    const text = (node) => {
      if (node.selfClosing) return
      let cursor = node.end + 1
      for (const child of node.children) {
        if (xml.slice(cursor, child.start).trim()) reject('unexpected text')
        cursor = child.closeEnd + 1
      }
      if (xml.slice(cursor, node.closeStart).trim()) reject('unexpected text')
    }
    text(list); text(wrapper)
    const check = (node, allowed = [], children = [], uris = new Set([GUIDE_NAMESPACE])) => {
      if (!node || !uris.has(node.uri) || new Set(node.attrs.map((a) => a.name)).size !== node.attrs.length ||
        attributes(node).some((a) => !allowed.includes(a.name)) ||
        node.children.some((n) => !uris.has(n.uri) || !children.includes(n.local))) reject('unsupported/malformed declaration')
      text(node)
      consumed.add(node)
    }
    const wrap = (node, value) => ({ source: { partUri, preconditionHash,
      componentLocator: { path: locations.get(node), preconditionHash } }, value })
    const number = (node, key, min = -2147483648, max = 2147483647) => {
      const value = raw(node, key), parsed = Number(value)
      if (!/^[+-]?\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) reject('invalid numeric value')
      return wrap(node, parsed)
    }
    const emptyExtension = (node) => {
      check(node)
      if (node.local !== 'extLst') reject('wrong extension list')
      return wrap(node, {})
    }
    const colorSource = { check: (node, allowed, children) => check(node, allowed, children, A_URIS), number, raw, wrap, fail: reject }
    check(declaration, [], ['guide', 'extLst'])
    const guides = [], ids = new Set()
    let extensionList
    for (const node of declaration.children) {
      if (extensionList) reject('misordered declaration')
      if (node.local === 'extLst') { extensionList = emptyExtension(node); continue }
      check(node, ['id', 'name', 'orient', 'pos', 'userDrawn'], ['clr', 'extLst'])
      const color = node.children[0], extension = node.children[1]
      if (color?.local !== 'clr' || node.children.length > 2 || (extension && extension.local !== 'extLst')) reject('missing/misordered color')
      check(color, [], ['srgbClr', 'scrgbClr', 'hslClr', 'prstClr', 'schemeClr', 'sysClr'], new Set([GUIDE_NAMESPACE, ...A_URIS]))
      // CT_Color has exactly one DrawingML color child, rather than a guide child.
      if (color.children.length !== 1) reject('missing/ambiguous color')
      const value = { id: number(node, 'id', 0, 4294967295).value,
        color: readColorSource(color.children[0], colorSource) }
      if (ids.has(value.id)) reject('duplicate guide id')
      ids.add(value.id)
      for (const name of ['name', 'orient', 'pos', 'userDrawn']) {
        if (!node.attrs.some((attribute) => attribute.name === name)) continue
        const native = raw(node, name)
        if (name === 'orient' && !['horz', 'vert'].includes(native)) reject('invalid orientation')
        if (name === 'userDrawn' && !['true', 'false', '1', '0'].includes(native)) reject('invalid boolean')
        value[name] = name === 'pos' ? number(node, name).value : name === 'userDrawn' ? ['true', '1'].includes(native) : native
      }
      if (extension) value.extensionList = emptyExtension(extension)
      guides.push(wrap(node, value))
    }
    const mapped = [...consumed].map((node) => byNode.get(node)).filter(Boolean)
    const components = mapped.map((entry) => ({ id: entry.id, kind: 'property', locator: entry.componentLocators[0] }))
    const id = `${partUri}#source-guide-list:${path.join('.')}`
    semantic.definitions[id] = { id, kind: 'source-guide-list',
      source: { partUri, preconditionHash, componentLocator: { path, preconditionHash } },
      content: { sourceGuideList: { ownerRoot: { localName: root.local, namespaceUri: root.uri },
        localName: declaration.local, namespaceUri: GUIDE_NAMESPACE, extensionUri: spec[2], componentId: source.id,
        wrapperLocator: { path: path.slice(0, -1), preconditionHash }, guides,
        ...(extensionList ? { extensionList } : {}) } }, components }
    for (const entry of mapped) {
      if (dispositions.has(entry.id)) reject('duplicate disposition')
      dispositions.set(entry.id, { definitionId: entry.id, partUri, locator: entry.componentLocators[0], disposition: 'semantically-mapped' })
      mappedIds.add(entry.id)
    }
  }
  return mappedIds
}
module.exports = { projectSourceGuideLists }
