const { createHash } = require('node:crypto')
const { parseXml, decodeXml, A_URIS } = require('./ooxml-text-run-xml')
const { PptxImportError } = require('./diagnostics')

// Per-call state only: inventory hashes/locators remain the source authority.
function smartArtSource(context) {
  const inventory = context.inventory
  const definitions = inventory.definitions
  const components = [], consumed = new Set(), loaded = new Map()
  function fail(partUri, node, path, detail, definitionId = context.source.id) {
    const error = new PptxImportError(`Semantic SmartArt source ${detail}: ${partUri}#${path.join('.')}`, { status: 422 })
    error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
    error.sourceLocation = { partUri, definitionId, path, localName: node?.local }
    throw error
  }
  async function load(partUri) {
    if (loaded.has(partUri)) return loaded.get(partUri)
    const missing = (detail) => fail(partUri, null, [], detail)
    const file = context.zip.file(partUri)
    if (!file) missing('missing relationship-bound part')
    const xml = await file.async('string'), hash = createHash('sha256').update(xml).digest('hex')
    const hashes = new Set([
      ...definitions.filter((d) => d.partUri === partUri).map((d) => d.preconditionHash),
      ...(inventory.parts || []).filter((p) => p.partUri === partUri).map((p) => p.preconditionHash),
    ])
    if (hashes.size !== 1 || !hashes.has(hash)) missing('stale/uninventoried source')
    let roots
    try { roots = parseXml(xml) } catch (error) { missing(error.message) }
    if (roots.length !== 1 || xml.slice(0, roots[0].start).replace(/<\?xml[^?]*\?>/, '').trim() ||
        xml.slice(roots[0].closeEnd + 1).trim()) missing('invalid XML document')
    const paths = new Map(), byPath = new Map()
    function walk(node, path, depth) {
      if (depth > 256 || paths.size >= 10000000) missing('XML budget')
      paths.set(node, path); byPath.set(path.join('.'), node)
      const names = new Set()
      for (const attribute of node.attrs) {
        const [prefix, local] = attribute.name.split(':')
        const uri = local ? node.namespaces[prefix] : ''
        const key = local && prefix !== 'xmlns' ? `${uri}|${local}` : attribute.name
        if (names.has(key) || (local && !uri && !['xml', 'xmlns'].includes(prefix)) || decodeXml(attribute.value) === null)
          fail(partUri, node, path, 'invalid/duplicate XML attribute')
        names.add(key)
      }
      node.children.forEach((child, index) => walk(child, [...path, index], depth + 1))
    }
    walk(roots[0], [0], 0)
    const partDefinitions = definitions.filter((d) => d.partUri === partUri)
    const nodes = new Map(partDefinitions.map((d) => [d.id, byPath.get(d.componentLocators?.[0]?.path.join('.'))]))
    const s = {
      xml, roots, hash, partUri, nodes, definitions: partDefinitions, components: partDefinitions,
      source: { id: context.source.id, partUri, preconditionHash: hash },
    }
    s.location = (node) => ({ partUri, preconditionHash: hash, path: paths.get(node) })
    s.fail = (node, detail) => {
      const owner = partDefinitions.find((d) => nodes.get(d.id) === node)
      fail(partUri, node, paths.get(node) || [], detail, owner?.id)
    }
    s.attrs = (node, allowed = []) => {
      const result = {}
      for (const item of node.attrs) {
        if (item.name === 'xmlns' || item.name.startsWith('xmlns:')) continue
        if (!allowed.includes(item.name) || Object.hasOwn(result, item.name)) s.fail(node, `unsupported/duplicate attribute ${item.name}`)
        const value = decodeXml(item.value)
        if (value === null) s.fail(node, 'attribute entity')
        result[item.name] = value
      }
      return result
    }
    s.children = (node, allowed = [], repeated = [], uris = A_URIS) => {
      const seen = new Set()
      for (const child of node.children) {
        if (!uris.has(child.uri) || !allowed.includes(child.local)) s.fail(child, 'unsupported child/namespace')
        if (seen.has(child.local) && !repeated.includes(child.local)) s.fail(child, 'duplicate child')
        seen.add(child.local)
      }
      if (!node.selfClosing) {
        let cursor = node.end + 1
        for (const child of node.children) {
          if (xml.slice(cursor, child.start).trim()) s.fail(node, 'unexpected text')
          cursor = child.closeEnd + 1
        }
        if (xml.slice(cursor, node.closeStart).trim()) s.fail(node, 'unexpected text')
      }
    }
    s.required = (node, local, uris = A_URIS) => {
      const children = node.children.filter((c) => c.local === local && uris.has(c.uri))
      if (children.length !== 1) s.fail(node, `missing/duplicate ${local}`)
      return children[0]
    }
    s.bind = (node, kind, parentId, componentKind) => {
      const matches = partDefinitions.filter((d) => nodes.get(d.id) === node)
      const d = matches[0], path = paths.get(node)
      if (matches.length !== 1 || consumed.has(d.id) || d.kind !== kind ||
          d.parentDefinitionId !== parentId || d.preconditionHash !== hash ||
          d.namespaceUri !== node.uri || d.localName !== node.local ||
          d.componentLocators[0].preconditionHash !== hash) s.fail(node, 'ambiguous/stale component binding')
      consumed.add(d.id)
      components.push({ id: d.id, kind: componentKind, partUri, locator: { path, preconditionHash: hash } })
      return d.id
    }
    s.component = (node, kind) => {
      const path = paths.get(node), id = `${partUri}#smartart-${node.local}:${path.join('.')}`
      if (components.some((c) => c.id === id)) s.fail(node, 'duplicate generated component')
      components.push({ id, kind, partUri, locator: { path, preconditionHash: hash } })
      return id
    }
    s.number = (node, value, min = -2147483648, max = 2147483647) => {
      if (!/^-?\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) ||
          Number(value) < min || Number(value) > max) s.fail(node, 'invalid integer')
      return Number(value)
    }
    s.boolean = (node, value) => {
      if (!['0', '1', 'false', 'true'].includes(value)) s.fail(node, 'invalid boolean')
      return value === '1' || value === 'true'
    }
    s.checked = (node, callback) => {
      try { return callback() } catch (error) {
        if (error.code === 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
        const component = components.find((c) => c.id === error.componentId)
        s.fail(component?.partUri === partUri ? byPath.get(component.locator.path.join('.')) : node, error.message)
      }
    }
    s.finish = () => {
      for (const d of partDefinitions)
        if (!consumed.has(d.id)) s.fail(nodes.get(d.id) || roots[0], 'unmapped required source component')
    }
    loaded.set(partUri, s)
    return s
  }
  return { load, components, consumed }
}
module.exports = { smartArtSource }
