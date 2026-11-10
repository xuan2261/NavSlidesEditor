import {
  createTableRowInsertion, createTableColumnInsertion,
} from 'revealjs-shared/src/pptx-table-structure-commands.js'

export default function NativeTableStructureControls({ document, selected, dispatch, disabled }) {
  const rowId = document.rows[selected.r].componentId
  const columnId = document.columns[selected.c].componentId
  return <fieldset disabled={disabled}>
    <legend>Native table structure</legend>
    <button type="button" aria-label="Insert native table row after selected cell"
      disabled={disabled}
      onClick={() => dispatch(() => createTableRowInsertion(document, rowId, crypto.randomUUID()))}>
      Insert row after selected cell
    </button>
    <button type="button" aria-label="Delete selected native table row"
      disabled={disabled || document.rows.length === 1}
      onClick={() => dispatch({ type: 'deleteRow', rowId })}>
      Delete selected row
    </button>
    <button type="button" aria-label="Insert native table column after selected cell"
      disabled={disabled}
      onClick={() => dispatch(() => createTableColumnInsertion(document, columnId, crypto.randomUUID()))}>
      Insert column after selected cell
    </button>
    <button type="button" aria-label="Delete selected native table column"
      disabled={disabled || document.columns.length === 1}
      onClick={() => dispatch({ type: 'deleteColumn', columnId })}>
      Delete selected column
    </button>
  </fieldset>
}
