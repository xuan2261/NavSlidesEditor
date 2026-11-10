import { useState } from 'react'
import { applyTableOperation } from 'revealjs-shared/src/pptx-table-operations.js'
import { TABLE_CELL_DEFAULTS } from 'revealjs-shared/src/pptx-table-properties.js'
import NativeTableStructureControls from './native-table-structure-controls'
import NativeTableRichCellProperties from './native-table-rich-cell-properties'

export default function NativeTableProperties({ element, slideLocked, onSemanticOperation, selectedElementIds }) {
  const document = element.tableDocument
  const [selectedId, setSelectedId] = useState(null)
  const [rowSpan, setRowSpan] = useState(1)
  const [columnSpan, setColumnSpan] = useState(1)
  const [error, setError] = useState('')
  const selected = document.rows.flatMap((row, r) => row.cells.map((cell, c) => ({ cell, r, c })))
    .find(({ cell }) => cell.componentId === selectedId && cell.anchorCellId === cell.componentId)
    || { cell: document.rows[0].cells[0], r: 0, c: 0 }
  const disabled = Boolean(element.locked || slideLocked || !element.pptxInstanceId || !onSemanticOperation || (selectedElementIds && selectedElementIds.length > 1))
  const dispatch = (intent) => {
    if (disabled) return
    try {
      const command = typeof intent === 'function' ? intent() : intent
      applyTableOperation(document, command)
      onSemanticOperation({ type: 'table.edit', instanceId: element.pptxInstanceId,
        componentId: document.componentId, command })
      setError('')
    } catch (cause) { setError(cause.message) }
  }
  const size = (value, command) => {
    if (value === '') return
    dispatch({ ...command, [command.type === 'setRowHeight' ? 'heightEmu' : 'widthEmu']: Number(value) })
  }
  const cellProperties = (properties) => dispatch({
    type: 'setCellProperties', cellId: selected.cell.componentId, properties,
  })
  const rgb = (value, current, apply) => {
    if (!value) return
    if (!/^[0-9a-f]{6}$/i.test(value)) { setError('Enter six hexadecimal RGB digits.'); return }
    if (current?.kind === 'srgb' && current.value.toUpperCase() === value.toUpperCase()) return
    apply({ kind: 'srgb', value: value.toUpperCase() })
  }
  const properties = selected.cell.properties
  return <section aria-label="Native table properties">
    {error && <div role="alert">{error}</div>}
    {!onSemanticOperation && <p role="status">Native table command dispatch is unavailable.</p>}
    <fieldset disabled={disabled} aria-label="Native table properties">
      <legend>Native dimensions</legend>
      {document.rows.map((row, r) => <label key={row.componentId}>
        Row {r + 1} height (EMU)
        <input aria-label={`Row ${r + 1} height (EMU)`} type="number" min="0" step="1"
          value={row.heightEmu} onChange={(event) => size(event.target.value,
            { type: 'setRowHeight', rowId: row.componentId })} />
      </label>)}
      {document.columns.map((column, c) => <label key={column.componentId}>
        Column {c + 1} width (EMU)
        <input aria-label={`Column ${c + 1} width (EMU)`} type="number" min="0" step="1"
          value={column.widthEmu} onChange={(event) => size(event.target.value,
            { type: 'setColumnWidth', columnId: column.componentId })} />
      </label>)}
      <label>Selected cell
        <select aria-label="Selected native table cell" value={selected.cell.componentId}
          onChange={(event) => setSelectedId(event.target.value)}>
          {document.rows.flatMap((row, r) => row.cells.map((cell, c) =>
            cell.anchorCellId !== cell.componentId ? null : <option key={cell.componentId}
              value={cell.componentId}>Cell {r + 1},{c + 1}</option>))}
        </select>
      </label>
      <NativeTableStructureControls document={document} selected={selected} dispatch={dispatch} disabled={disabled} />
      <fieldset>
        <legend>Selected cell style</legend>
        {['Left', 'Right', 'Top', 'Bottom'].map((side) => <label key={side}>
          {side} inset (EMU)
          <input aria-label={`Cell ${side.toLowerCase()} inset (EMU)`} type="number" min="0" step="1"
            value={properties[`margin${side}Emu`] ?? TABLE_CELL_DEFAULTS[`margin${side}Emu`]}
            onChange={(event) => event.target.value !== '' &&
              cellProperties({ [`margin${side}Emu`]: Number(event.target.value) })} />
        </label>)}
        <label>Fill RGB
          <input key={`${selected.cell.componentId}:fill:${JSON.stringify(properties.fill)}`}
            aria-label="Cell fill RGB" placeholder="RRGGBB" maxLength="6"
            defaultValue={properties.fill?.color.kind === 'srgb' ? properties.fill.color.value : ''}
            onBlur={(event) => rgb(event.target.value, properties.fill?.color,
              (color) => cellProperties({ fill: { color } }))} />
        </label>
        <button type="button" onClick={() => cellProperties({ fill: { color: { kind: 'none' } } })}>
          Remove cell fill
        </button>
        {['left', 'right', 'top', 'bottom'].map((side) => {
          const border = properties.borders?.[side] ?? {}
          const change = (patch) => cellProperties({ borders: { [side]: { ...border, ...patch } } })
          return <fieldset key={`${selected.cell.componentId}:${side}`}>
            <legend>{side} border</legend>
            <label>RGB
              <input key={JSON.stringify(border.color)} aria-label={`Cell ${side} border RGB`}
                placeholder="RRGGBB" maxLength="6"
                defaultValue={border.color?.kind === 'srgb' ? border.color.value : ''}
                onBlur={(event) => rgb(event.target.value, border.color, (color) => change({ color }))} />
            </label>
            <label>Width (EMU)
              <input aria-label={`Cell ${side} border width (EMU)`} type="number" min="0" step="1"
                value={border.width ?? ''} onChange={(event) => event.target.value !== '' &&
                  change({ width: Number(event.target.value) })} />
            </label>
            <button type="button" onClick={() => change({ color: { kind: 'none' } })}>
              Remove {side} border
            </button>
          </fieldset>
        })}
      </fieldset>
      <label>Merge row span<input aria-label="Merge row span" type="number" min="1" step="1"
        value={rowSpan} onChange={(event) => setRowSpan(Number(event.target.value))} /></label>
      <label>Merge column span<input aria-label="Merge column span" type="number" min="1" step="1"
        value={columnSpan} onChange={(event) => setColumnSpan(Number(event.target.value))} /></label>
      <button type="button" onClick={() => dispatch({ type: 'mergeCells', startRow: selected.r,
        startColumn: selected.c, rowSpan, columnSpan })}>Merge selected rectangle</button>
      <button type="button" disabled={!selected.cell.merge.gridSpan && !selected.cell.merge.rowSpan}
        onClick={() => dispatch({ type: 'unmergeCell', cellId: selected.cell.componentId })}>
        Unmerge selected cell
      </button>
      {document.rows.map((row, r) => row.cells.map((cell, c) =>
        cell.anchorCellId !== cell.componentId ? null : <NativeTableRichCellProperties
          key={cell.componentId} cell={cell} row={r} column={c} dispatch={dispatch} disabled={disabled} />))}
    </fieldset>
  </section>
}
