const { MC } = require('../../../shared/src/pptx-transition-xml')
const { readTransitionDocument } = require('../../../shared/src/pptx-transition-document')
function readSemanticTransition({ source, node, xml, roots }) {
  const path = source.componentLocators[0].path
  const slide = roots[0]
  if (roots.length !== 1 || !['http://schemas.openxmlformats.org/presentationml/2006/main',
    'http://purl.oclc.org/ooxml/presentationml/main'].includes(slide?.uri) || slide.local !== 'sld')
    throw new TypeError('Invalid PPTX transition: source slide root')
  let current = roots[path[0]], root = node, rootPath = path
  for (let depth = 1; depth < path.length; depth += 1) {
    if (current.uri === MC && current.local === 'AlternateContent') {
      root = current; rootPath = path.slice(0, depth); break
    }
    current = current.children[path[depth]]
  }
  if (rootPath.length !== 2 || (root === node && path.length !== 2))
    throw new TypeError('Invalid PPTX transition: source placement')
  const namespaces = Object.create(null)
  for (const prefix in root.namespaces) namespaces[prefix] = root.namespaces[prefix]
  const result = { schemaVersion: 1, xml: xml.slice(root.start, root.closeEnd + 1), namespaces,
    locator: { path: [...rootPath], preconditionHash: source.preconditionHash } }
  const parsed = readTransitionDocument(result)
  if (!parsed.transitionPaths.some(item => JSON.stringify(item) === JSON.stringify(path)))
    throw new TypeError('Invalid PPTX transition: source root binding')
  return result
}
function projectSourceTransitions({ inventory, parts, nodes, semantic, dispositions, fail }) {
  const seen = new Map()
  for (const source of inventory.definitions.filter(item => item.kind === 'transition')) {
    const part = parts.get(source.partUri)
    let document
    try {
      document = readSemanticTransition({ source, node: nodes.get(source.id), xml: part.xml, roots: part.roots })
    } catch (error) { fail(source, error.message) }
    const key = `${source.partUri}#${JSON.stringify(document.locator.path)}`
    const owner = seen.get(key)
    if (!owner) {
      seen.set(key, source.id)
      semantic.definitions[source.id] = {
        id: source.id, kind: 'opaque',
        source: { partUri: source.partUri, preconditionHash: source.preconditionHash,
          componentLocator: source.componentLocators[0] },
        content: { transitionDocument: document },
        components: readTransitionDocument(document).transitionPaths.map(path => ({
          id: `${source.partUri}#transition:${path.join('.')}`, kind: 'property',
          locator: { path, preconditionHash: source.preconditionHash },
        })),
      }
    }
    if (dispositions.has(source.id)) fail(source, 'ambiguous transition disposition')
    dispositions.set(source.id, { definitionId: source.id, partUri: source.partUri,
      locator: source.componentLocators[0], disposition: 'semantically-mapped' })
  }
}
module.exports = { readSemanticTransition, projectSourceTransitions }
