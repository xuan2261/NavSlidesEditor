const { validateTextHyperlinkOverride } = require('./pptx-text-hyperlink-bindings')
// This ledger lives only for one occurrence journal replay. Retain removed IDs
// too: a later command must not resurrect one with a different parent or kind.
function assertTableOccurrenceIdentity(source, edited, identities = new Map()) {
  // Failed validation must not reserve identities in the caller's replay ledger.
  const pending = new Map()
  function visit(table, validate) {
    function identity(id, kind, parent, body, nativeIdentity, equationRoot) {
      const previous = identities.get(id) ?? pending.get(id)
      if (validate && previous && (previous.kind !== kind || previous.parent !== parent))
        throw new TypeError('Invalid authored table component identity or ownership')
      if (validate && (nativeIdentity?.value !== previous?.nativeIdentity?.value ||
          nativeIdentity?.componentId !== previous?.nativeIdentity?.componentId))
        throw new TypeError('Invalid authored table native identity')
      if (validate && !previous) {
        const rich = ['paragraph', 'text', 'break', 'field'].includes(kind)
        const structural = ['column', 'row', 'cell', 'body'].includes(kind)
        const equation = equationRoot !== undefined
        const prefix = equation ? `${equationRoot}~authored:` : rich ? `${body}~authored:` : `${parent}~authored:${kind}:`
        if ((!rich && !structural && !equation) || !id.startsWith(prefix) ||
            !/^[A-Za-z0-9._:-]{1,128}$/.test(id.slice(prefix.length)))
          throw new TypeError('Invalid authored table component identity or ownership')
      }
      if (!previous) pending.set(id, { kind, parent, nativeIdentity })
    }
    identity(table.componentId, 'table', null)
    for (const column of table.columns) identity(column.componentId, 'column', table.componentId, undefined, column.identity)
    for (const row of table.rows) {
      identity(row.componentId, 'row', table.componentId, undefined, row.identity)
      for (const cell of row.cells) {
        identity(cell.componentId, 'cell', row.componentId)
        const body = cell.textDocument.componentId
        identity(body, 'body', cell.componentId)
        for (const paragraph of cell.textDocument.paragraphs) {
          identity(paragraph.componentId, 'paragraph', body, body)
          for (const run of paragraph.runs) {
            identity(run.componentId, run.kind, paragraph.componentId, body)
            if (run.kind === 'equation') {
              const root = run.ommlDocument.root
              const visit = (node) => {
                identity(node.componentId, `omml:${node.namespaceUri}:${node.type}`,
                  node === root ? run.componentId : root.componentId, body, undefined, root.componentId)
                node.children.forEach(visit)
              }
              visit(root)
            }
          }
        }
      }
    }
  }
  const definition = { content: { tableDocument: source } }
  for (const row of edited.rows) for (const cell of row.cells)
    validateTextHyperlinkOverride(definition, cell.textDocument)
  if (!identities.size) visit(source, false)
  visit(edited, true)
  for (const [id, owner] of pending) identities.set(id, owner)
  return identities
}
module.exports = { assertTableOccurrenceIdentity }
