const { A_URIS, P_URIS, descendants } = require('./ooxml-text-run-xml')
const { textListStyleSource } = require('./ooxml-semantic-text-list-style-source')
const { listParagraphProperties } = require('./ooxml-semantic-text-list-style-properties')
const { normalizeTextListStyle } = require('../../../shared/src/pptx-text-list-style')

function readSemanticTextListStyle(context) {
  const source = textListStyleSource(context), { node } = context
  const bodies = node.children.filter((n) => P_URIS.has(n.uri) && n.local === 'txBody')
  const lists = descendants(node, (n) => n.local === 'lstStyle')
  if (bodies.length > 1 || lists.length > 1 ||
      lists.some((n) => !bodies[0]?.children.includes(n) || !A_URIS.has(n.uri)))
    source.fail(lists[0] || node, 'list style source association')
  if (!lists.length) return undefined
  const list = lists[0]
  source.attrs(list)
  source.children(list, ['defPPr', ...Array.from({ length: 9 }, (_, i) => `lvl${i + 1}pPr`)])
  const componentId = source.component(list)
  const entries = list.children.map((entry) => {
    const declaration = listParagraphProperties(entry, source)
    const level = entry.local === 'defPPr' ? undefined : Number(entry.local[3]) - 1
    const result = { componentId: source.component(entry),
      source: { part: context.source.partUri, path: source.paths.get(entry).join('.') },
      ...(level !== undefined ? { level } : {}), ...declaration }
    // Bind every accepted property node, including inventoried descendants.
    for (const child of descendants(entry, () => true)) source.component(child)
    return result
  })
  const listStyle = source.checked(list, () => normalizeTextListStyle({ schemaVersion: 1, componentId, entries }))
  return { listStyle, ...source.finishList(list) }
}

module.exports = { readSemanticTextListStyle }
