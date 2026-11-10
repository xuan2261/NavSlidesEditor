const { createHash } = require('node:crypto')
const { parseXml, P_URIS, decodeXml } = require('./ooxml-text-run-xml')
const { tableSource } = require('./ooxml-semantic-table-source')
const { PptxImportError } = require('./diagnostics')

// Use the existing strict attribute/container/numeric boundary. Bindings stay in
// the caller's source inventory, not a parallel source authority map.
function textListStyleSource(context) {
  const { source, node, xml, components, nodes } = context
  const path = source.componentLocators?.[0]?.path
  function invalid(detail) {
    const error = new PptxImportError(`Semantic list style admission ${detail}: ${source.partUri}`, { status: 422 })
    error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
    error.sourceLocation = { partUri: source.partUri, definitionId: source.id,
      path: Array.isArray(path) ? path : [], localName: node?.local }
    throw error
  }
  if (!Array.isArray(path) || !path.length || !path.every((n) => Number.isSafeInteger(n) && n >= 0) ||
      source.componentLocators.length !== 1 || source.kind !== 'shape' ||
      !P_URIS.has(source.namespaceUri) || source.localName !== 'sp' ||
      source.namespaceUri !== node.uri || node.local !== source.localName ||
      source.componentLocators[0].preconditionHash !== source.preconditionHash ||
      nodes.get(source.id) !== node || createHash('sha256').update(xml).digest('hex') !== source.preconditionHash)
    invalid('wrong-owner or stale source')
  let actual = { children: parseXml(xml) }
  for (const i of path) actual = actual?.children[i]
  if (!actual || JSON.stringify(actual) !== JSON.stringify(node)) invalid('source locator or XML association')
  const nonvisual = node.children.filter((n) => P_URIS.has(n.uri) && n.local === 'nvSpPr')
  const identity = nonvisual.flatMap((n) => n.children.filter((c) => P_URIS.has(c.uri) && c.local === 'cNvPr'))
  const ids = identity.flatMap((n) => n.attrs.filter((a) => a.name === 'id'))
  if (nonvisual.length !== 1 || identity.length !== 1 || ids.length !== 1 ||
      decodeXml(ids[0].value) !== source.nativeId ||
      source.id !== `${source.partUri}#shape:${source.nativeId}`) invalid('wrong native source owner')
  const boundary = tableSource(context), paths = new Map(), bindings = [], consumed = new Set()
  for (const key of ['attrs', 'children', 'required', 'number', 'boolean', 'checked']) {
    const method = boundary[key]
    boundary[key] = (...args) => {
      try { return method(...args) } catch (error) {
        error.message = error.message.replace('Semantic table admission', 'Semantic list style admission')
        throw error
      }
    }
  }
  function walk(entry, at) {
    paths.set(entry, at)
    entry.children.forEach((child, i) => walk(child, [...at, i]))
  }
  walk(node, path)
  const fail = (entry, detail) => {
    try { boundary.fail(entry, detail) } catch (error) {
      error.message = error.message.replace('Semantic table admission', 'Semantic list style admission')
      throw error
    }
  }
  function component(entry) {
    const at = paths.get(entry), matches = components.filter((item) => nodes.get(item.id) === entry)
    if (matches.length > 1) fail(entry, 'ambiguous source component')
    let id
    if (matches.length) {
      const item = matches[0], locator = item.componentLocators?.[0]
      if (item.partUri !== source.partUri || item.preconditionHash !== source.preconditionHash ||
          item.namespaceUri !== entry.uri || item.localName !== entry.local || item.nativeId !== null ||
          item.componentLocators.length !== 1 || locator.preconditionHash !== source.preconditionHash ||
          JSON.stringify(locator.path) !== JSON.stringify(at)) fail(entry, 'wrong-owner or stale component')
      let owner = components.find((p) => p.id === item.parentDefinitionId)
      const seen = new Set([item.id])
      while (owner) {
        if (seen.has(owner.id)) fail(entry, 'component parent cycle')
        seen.add(owner.id)
        owner = components.find((p) => p.id === owner.parentDefinitionId)
      }
      const parent = components.find((p) => seen.has(p.id) && p.parentDefinitionId === source.id)
      if (item.parentDefinitionId !== source.id && !parent) fail(entry, 'wrong component owner')
      id = item.id
      consumed.add(id)
    } else id = `${source.partUri}#list-style:${at.join('.')}`
    if (bindings.some((b) => b.id === id) ||
        components.some((item) => item.id === id && nodes.get(item.id) !== entry))
      fail(entry, 'duplicate component')
    bindings.push({ id, kind: 'property', locator: { path: at, preconditionHash: source.preconditionHash } })
    return id
  }
  return { ...boundary, fail, paths, component,
    finishList(list) {
      const under = (entry) => {
        const at = paths.get(entry), prefix = paths.get(list)
        return at && prefix.every((n, i) => at[i] === n)
      }
      for (const item of components)
        if (under(nodes.get(item.id)) && !consumed.has(item.id)) fail(nodes.get(item.id), 'unmapped source component')
      return { components: bindings, mappedDefinitionIds: [...consumed] }
    } }
}

module.exports = { textListStyleSource }
