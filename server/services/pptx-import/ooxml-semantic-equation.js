const { createHash } = require('node:crypto')
const { parseXml, decodeXml, textContent } = require('./ooxml-text-run-xml')
const { PptxImportError } = require('./diagnostics')
const { normalizeOmmlDocument, OMML_LIMITS } = require('../../../shared/src/pptx-omml-document')
const { token, XML } = require('../../../shared/src/pptx-omml-document-grammar')

// Payload reader, not a shape dispatcher or renderer. The caller selects one
// inventoried oMath/oMathPara subtree and supplies its descendant definitions.
function readSemanticEquation(context) {
  const { source, node, xml, components, nodes } = context
  const rootPath = source.componentLocators?.[0]?.path
  const paths = new Map(), owners = new Map(), consumed = new Set(), bindings = []
  const byId = new Map(), treeNodes = new Map()
  function fail(entry, detail) {
    const error = new PptxImportError(`Semantic OMML admission ${detail}: ${source.partUri}`, { status: 422 })
    error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
    error.sourceLocation = { partUri: source.partUri,
      definitionId: owners.get(entry)?.id || source.id,
      path: paths.get(entry) || rootPath || [], localName: entry?.local || source.localName }
    throw error
  }
  if (!Array.isArray(rootPath) || !rootPath.length || rootPath.some((n) => !Number.isSafeInteger(n) || n < 0) ||
      source.kind !== 'math-component' || nodes.get(source.id) !== node ||
      createHash('sha256').update(xml).digest('hex') !== source.preconditionHash)
    fail(node, 'wrong root owner or stale source')
  for (const item of [source, ...components]) {
    const entry = nodes.get(item.id)
    if (!entry || owners.has(entry) || byId.has(item.id)) fail(entry, 'missing/ambiguous source component')
    owners.set(entry, item)
    byId.set(item.id, item)
  }
  let roots
  try { roots = parseXml(xml) } catch { fail(node, 'invalid source XML') }
  let actual = { children: roots }
  for (const index of rootPath) actual = actual?.children[index]
  if (!actual || actual.start !== node.start) fail(node, 'wrong root locator')
  let count = 0
  function read(entry, original, path, parentOwner, depth) {
    paths.set(original, path)
    if (++count > OMML_LIMITS.maxNodes || depth > OMML_LIMITS.maxDepth) fail(original, 'tree budget')
    if (!original || original.start !== entry.start || original.end !== entry.end ||
        original.closeEnd !== entry.closeEnd || original.raw !== entry.raw ||
        original.uri !== entry.uri || original.local !== entry.local ||
        original.children.length !== entry.children.length) fail(original, 'stale XML node')
    const item = owners.get(original)
    let id, nextOwner = parentOwner
    if (item) {
      const locator = item.componentLocators?.[0]
      if (item.partUri !== source.partUri || item.preconditionHash !== source.preconditionHash ||
          item.namespaceUri !== entry.uri || item.localName !== entry.local ||
          item.componentLocators.length !== 1 || locator?.preconditionHash !== source.preconditionHash ||
          JSON.stringify(locator.path) !== JSON.stringify(path) ||
          (original !== node && item.parentDefinitionId !== parentOwner))
        fail(original, 'wrong-owner or stale source component')
      if (item.kind !== 'math-component') fail(original, 'unsupported required source component')
      id = item.id
      nextOwner = id
      consumed.add(id)
    } else {
      // Every math node must have an inventory identity. Word/DrawingML run
      // formatting does not have one; give it an exact path-bound local identity.
      if (token({ namespaceUri: entry.uri, type: entry.local }).startsWith('m:'))
        fail(original, 'missing required math component')
      id = `${source.partUri}#omml-${entry.local}:${path.join('.')}`
    }
    if (treeNodes.has(id)) fail(original, 'duplicate component identity')
    treeNodes.set(id, original)
    bindings.push({ id, kind: 'property', locator: { path: [...path], preconditionHash: source.preconditionHash } })
    const attributes = entry.attrs.filter((attr) => attr.name !== 'xmlns' && !attr.name.startsWith('xmlns:'))
      .map((attr) => {
        const parts = attr.name.split(':')
        const name = parts.at(-1), namespaceUri = parts.length === 1 ? '' :
          parts[0] === 'xml' ? XML : entry.namespaces[parts[0]]
        if (parts[0] === 'xml' && entry.namespaces.xml && entry.namespaces.xml !== XML)
          fail(original, 'invalid XML namespace')
        const value = decodeXml(attr.value)
        if (parts.length > 2 || namespaceUri === undefined || value === null) fail(original, 'invalid attribute namespace/entity')
        return { namespaceUri, name, value }
      })
    const isText = token({ namespaceUri: entry.uri, type: entry.local }) === 'm:t'
    if (!isText && !entry.selfClosing) {
      let cursor = entry.end + 1
      for (const child of entry.children) {
        if (xml.slice(cursor, child.start).trim()) fail(original, 'unexpected mixed content')
        cursor = child.closeEnd + 1
      }
      if (xml.slice(cursor, entry.closeStart).trim()) fail(original, 'unexpected mixed content')
    }
    let text
    if (isText) {
      try { text = textContent(xml, entry) } catch { fail(original, 'invalid math text') }
    }
    return { componentId: id, namespaceUri: entry.uri, type: entry.local, attributes,
      children: entry.children.map((child, index) => read(child, original.children[index], [...path, index], nextOwner, depth + 1)),
      ...(isText ? { text } : {}) }
  }
  const tree = read(actual, node, rootPath, source.parentDefinitionId, 0)
  let ommlDocument
  try { ommlDocument = normalizeOmmlDocument({ schemaVersion: 1, root: tree }) }
  catch (error) { fail(treeNodes.get(error.componentId) || node, error.message) }
  if (consumed.size !== byId.size) fail(node, 'unmapped required source component')
  return { ommlDocument, components: bindings, mappedDefinitionIds: [...consumed] }
}
module.exports = { readSemanticEquation }
