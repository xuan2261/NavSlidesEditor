import { normalizeTextDocument } from 'revealjs-shared/src/pptx-text-document.js'

// Rich cell edits remain one canonical body replacement in the occurrence journal.
// Never round-trip source runs, fields, equations or paragraph layout through HTML.
export function editTableCellText(cell, edit) {
  const textDocument = structuredClone(cell.textDocument)
  edit(textDocument)
  return { type: 'replaceCellText', cellId: cell.componentId,
    textDocument: normalizeTextDocument(textDocument) }
}

export function authoredTableTextId(bodyId, kind, token) {
  if (!['paragraph', 'text', 'break'].includes(kind) ||
      typeof token !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(token))
    throw new TypeError('Invalid authored table text identity')
  const id = `${bodyId}~authored:${kind}:${token}`
  if (id.length > 256) throw new TypeError('Authored table text identity exceeds its budget')
  return id
}
