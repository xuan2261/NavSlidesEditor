const { createHash } = require('node:crypto')
const { A_URIS, decodeXml } = require('./ooxml-text-run-xml')
const { PptxImportError } = require('./diagnostics')

function tableSource(context) {
  const { source, node, xml, components, nodes } = context
  const paths = new Map(), consumed = new Set(), bindings = []
  function walk(entry, path) {
    paths.set(entry, path)
    entry.children.forEach((child, i) => walk(child, [...path, i]))
  }
  walk(node, source.componentLocators[0].path)
  function fail(entry, detail) {
    const owner = components.find((item) => nodes.get(item.id) === entry) || source
    const error = new PptxImportError(`Semantic table admission ${detail}: ${source.partUri}#${paths.get(entry)?.join('.')}`, { status: 422 })
    error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
    error.sourceLocation = { partUri: source.partUri, definitionId: owner.id,
      path: paths.get(entry) || source.componentLocators[0].path, localName: entry.local }
    throw error
  }
  if (createHash('sha256').update(xml).digest('hex') !== source.preconditionHash ||
      nodes.get(source.id) !== node) fail(node, 'stale source')
  function attrs(entry, allowed = []) {
    const values = {}
    for (const attribute of entry.attrs) {
      if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue
      if (!allowed.includes(attribute.name) || Object.hasOwn(values, attribute.name))
        fail(entry, `unsupported/duplicate attribute ${attribute.name}`)
      const value = decodeXml(attribute.value)
      if (value === null) fail(entry, 'invalid attribute entity')
      values[attribute.name] = value
    }
    return values
  }
  function container(entry) {
    if (entry.selfClosing) return
    let cursor = entry.end + 1
    for (const child of entry.children) {
      if (xml.slice(cursor, child.start).trim()) fail(entry, 'unexpected text')
      cursor = child.closeEnd + 1
    }
    if (xml.slice(cursor, entry.closeStart).trim()) fail(entry, 'unexpected text')
  }
  function children(entry, allowed = [], repeated = [], namespaces = A_URIS) {
    container(entry)
    const seen = new Set()
    for (const child of entry.children) {
      if (!namespaces.has(child.uri) || !allowed.includes(child.local))
        fail(child, 'unsupported child or namespace')
      if (seen.has(child.local) && !repeated.includes(child.local)) fail(child, 'duplicate child')
      seen.add(child.local)
    }
  }
  function required(entry, local) {
    const found = entry.children.find((child) => A_URIS.has(child.uri) && child.local === local)
    if (!found) fail(entry, `missing ${local}`)
    return found
  }
  function number(entry, value, min = -2147483648, max = 2147483647) {
    if (!/^-?\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)) ||
        Number(value) < min || Number(value) > max) fail(entry, 'invalid integer')
    return Number(value)
  }
  function boolean(entry, value) {
    if (!['1', '0', 'true', 'false'].includes(value)) fail(entry, 'invalid boolean')
    return value === '1' || value === 'true'
  }
  function bind(entry, kind, parentId, componentKind, consume = true) {
    const matches = components.filter((item) => nodes.get(item.id) === entry)
    if (matches.length !== 1) fail(entry, 'missing/ambiguous source component')
    const item = matches[0], locator = item.componentLocators?.[0]
    if (item.kind !== kind || item.parentDefinitionId !== parentId ||
        item.partUri !== source.partUri || item.preconditionHash !== source.preconditionHash ||
        item.namespaceUri !== entry.uri || item.localName !== entry.local ||
        locator?.preconditionHash !== source.preconditionHash ||
        JSON.stringify(locator.path) !== JSON.stringify(paths.get(entry)) || consume && consumed.has(item.id))
      fail(entry, 'wrong-owner or stale source component')
    if (!consume) return item.id
    consumed.add(item.id)
    bindings.push({ id: item.id, kind: componentKind, locator })
    return item.id
  }
  function component(entry, kind) {
    const path = paths.get(entry)
    const id = `${source.partUri}#table-${entry.local}:${path.join('.')}`
    if (bindings.some((item) => item.id === id)) fail(entry, 'duplicate generated component')
    bindings.push({ id, kind, locator: { path, preconditionHash: source.preconditionHash } })
    return id
  }
  const verify = (entry, kind, parentId, componentKind) => bind(entry, kind, parentId, componentKind, false)
  const bound = () => ({ components: bindings, mappedDefinitionIds: [...consumed] })
  function finish() {
    for (const entry of components)
      if (!consumed.has(entry.id)) fail(nodes.get(entry.id) || node, 'unmapped required source component')
    return { components: bindings, mappedDefinitionIds: [...consumed] }
  }
  function checked(entry, fn) {
    try { return fn() } catch (error) {
      if (error.code === 'PPTX_SEMANTIC_ADMISSION_FAILED') throw error
      const target = error.componentId && bindings.find((b) => b.id === error.componentId)
      fail(target ? [...paths.keys()].find((n) => JSON.stringify(paths.get(n)) === JSON.stringify(target.locator.path)) : entry, error.message)
    }
  }
  return { ...context, fail, attrs, children, required, number, boolean, bind, verify, component, bound, finish, checked }
}
module.exports = { tableSource }
