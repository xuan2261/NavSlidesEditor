// Authored components belong to their immediate table/row/cell owner. Rich
// descendants keep the existing body-scoped convention; no source IDs are copied.
function authoredTableId(parent, kind, token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(token))
    throw new TypeError('Invalid authored table identity token')
  const id = `${parent}~authored:${kind}:${token}`
  if (id.length > 256) throw new TypeError('Authored table component identity exceeds its budget')
  return id
}
function emptyCell(rowId, token, sourceCell, fallbackCell) {
  const componentId = authoredTableId(rowId, 'cell', token)
  const bodyId = authoredTableId(componentId, 'body', 'text')
  const source = sourceCell?.textDocument
  const paragraph = source?.paragraphs[0]
  const fallbackParagraph = fallbackCell?.textDocument?.paragraphs[0]
  const fontProp = (p) => p?.runs.find((run) => (run.kind === 'text' || run.kind === 'field') && run.properties?.fontLatin)?.properties
  const anyProp = (p) => p?.runs.find((run) => (run.kind === 'text' || run.kind === 'field') && run.properties)?.properties
  const sourceProperties = paragraph?.defaultRunProperties?.fontLatin
    ? paragraph.defaultRunProperties
    : (fontProp(paragraph) ?? paragraph?.defaultRunProperties ?? anyProp(paragraph) ?? paragraph?.endRunProperties ?? {})
  const fallbackProperties = fallbackParagraph?.defaultRunProperties?.fontLatin
    ? fallbackParagraph.defaultRunProperties
    : (fontProp(fallbackParagraph) ?? fallbackParagraph?.defaultRunProperties ?? anyProp(fallbackParagraph) ?? fallbackParagraph?.endRunProperties ?? {})
  const properties = {
    ...fallbackProperties,
    ...sourceProperties,
  }
  return {
    componentId, anchorCellId: componentId, merge: {}, properties: structuredClone(sourceCell.properties),
    textDocument: { schemaVersion: 1, componentId: bodyId,
      ...(source?.body ? { body: structuredClone(source.body) } : {}), paragraphs: [{
      componentId: `${bodyId}~authored:p`,
      ...(paragraph?.properties ? { properties: structuredClone(paragraph.properties) } : {}),
      ...(Object.keys(properties).length ? { defaultRunProperties: structuredClone(properties) } : {}),
      runs: [{ componentId: `${bodyId}~authored:r`, kind: 'text', text: '' }],
    }] },
  }
}
function createTableRowInsertion(table, afterRowId, token) {
  const after = table.rows.find((row) => row.componentId === afterRowId)
  if (afterRowId !== null && !after) throw new TypeError('Unknown row insertion target')
  const componentId = authoredTableId(table.componentId, 'row', token)
  const sourceRow = after ?? table.rows[0]
  const fallbackCell = sourceRow.cells.find((c) => {
    const p = c?.textDocument?.paragraphs[0]
    return p?.defaultRunProperties?.fontLatin || p?.runs.some((r) => r.properties?.fontLatin)
  }) ?? sourceRow.cells[0]
  return { type: 'insertRow', afterRowId, row: {
    componentId, heightEmu: sourceRow.heightEmu,
    cells: table.columns.map((_, index) => emptyCell(componentId, `${index}`, sourceRow.cells[index], fallbackCell)),
  } }
}
function createTableColumnInsertion(table, afterColumnId, token) {
  const after = table.columns.find((column) => column.componentId === afterColumnId)
  if (afterColumnId !== null && !after) throw new TypeError('Unknown column insertion target')
  const columnIndex = after ? table.columns.indexOf(after) : 0
  return { type: 'insertColumn', afterColumnId,
    column: { componentId: authoredTableId(table.componentId, 'column', token),
      widthEmu: (after ?? table.columns[0]).widthEmu },
    cells: table.rows.map((row) => {
      const fallbackCell = row.cells.find((c) => {
        const p = c?.textDocument?.paragraphs[0]
        return p?.defaultRunProperties?.fontLatin || p?.runs.some((r) => r.properties?.fontLatin)
      }) ?? row.cells[0]
      return emptyCell(row.componentId, token, row.cells[columnIndex], fallbackCell)
    }),
  }
}
module.exports = { createTableRowInsertion, createTableColumnInsertion }
