import { ColorPicker } from '../ui'
import { clampNumber, parseFiniteNumber } from '../../utils/number-input'
import FocusedAuthoringTextInput from './focused-authoring-text-input'
import { computeMixedValues } from '../../utils/selection-mixed-values'
import { ELEMENT_DEFAULTS } from '../../data/element-defaults'

const INPUT_CLASS =
  'w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs focus:outline-none focus:border-accent'

export default function TableLayoutControls({
  element,
  onUpdate,
  elements = [element],
  selectedElementIds = [element.id],
}) {
  const data = element.data || [['']]
  const columns = Math.max(1, ...data.map((row) => (row || []).length))
  const fields = ['cellPadding', 'borderWidth', 'cellBgColor', 'headerIsBold']
  const dimensionFields = [
    ...Array.from({ length: columns }, (_, index) => `colWidths${index}`),
    ...Array.from({ length: data.length }, (_, index) => `rowHeights${index}`),
  ]
  const tables = elements
    .filter((candidate) => candidate.type === 'table')
    .map((candidate) => {
      const normalized = { id: candidate.id }
      for (const field of fields)
        normalized[field] = candidate[field] ?? ELEMENT_DEFAULTS.table[field]
      for (const [key, count, extent] of [
        [
          'colWidths',
          Math.max(1, ...(candidate.data || []).map((row) => (row || []).length)),
          candidate.width,
        ],
        ['rowHeights', Math.max(1, candidate.data?.length || 0), candidate.height],
      ]) {
        for (let index = 0; index < count; index++)
          normalized[`${key}${index}`] =
            candidate[key]?.[index] ?? (extent > 0 ? extent / count : 1)
      }
      return normalized
    })
  const mixed = computeMixedValues(tables, selectedElementIds, [...fields, ...dimensionFields])
  const dimensionInput = (key, count, extent, noun) =>
    Array.from({ length: count }, (_, index) => {
      const fallback = extent > 0 ? extent / count : 1
      const value = element[key]?.[index] ?? fallback
      const label = `Table ${noun} ${index + 1} ${key === 'colWidths' ? 'width' : 'height'}`
      const isMixed = mixed[`${key}${index}`]?.isMixed
      return (
        <label key={`${key}-${index}`} className="text-[11px] text-text-muted">
          {label}
          <FocusedAuthoringTextInput
            key={`${element.id}-${key}-${index}`}
            aria-label={label}
            data-testid={`prop-table-${key === 'colWidths' ? 'column-width' : 'row-height'}-${index + 1}`}
            className={INPUT_CLASS}
            type="number"
            min="0"
            step="any"
            disabled={element.locked}
            data-mixed={isMixed ? 'true' : undefined}
            placeholder={isMixed ? 'Multiple values' : undefined}
            value={isMixed ? '' : value}
            onChange={(event) => {
              const nextValue = parseFiniteNumber(event.target.value, null)
              if (nextValue === null || nextValue <= 0) return
              const next = Array.from(
                { length: count },
                (_, position) => element[key]?.[position] ?? fallback
              )
              next[index] = nextValue
              onUpdate({ [key]: next })
            }}
          />
        </label>
      )
    })
  return (
    <div className="grid grid-cols-2 gap-2 mb-2">
      {[
        ['Table cell padding', 'cellPadding', 8],
        ['Table border width', 'borderWidth', 1],
      ].map(([label, key, fallback]) => (
        <label key={key} className="text-[11px] text-text-muted">
          {label}
          <FocusedAuthoringTextInput
            key={`${element.id}-${key}`}
            aria-label={label}
            data-testid={`prop-table-${key === 'cellPadding' ? 'padding' : 'border-width'}`}
            className={INPUT_CLASS}
            type="number"
            min="0"
            step="any"
            value={mixed[key]?.isMixed ? '' : (element[key] ?? fallback)}
            data-mixed={mixed[key]?.isMixed ? 'true' : undefined}
            placeholder={mixed[key]?.isMixed ? 'Multiple values' : undefined}
            disabled={element.locked}
            onChange={(event) => {
              const value = clampNumber(event.target.value, 0, null, null)
              if (value !== null) onUpdate({ [key]: value })
            }}
          />
        </label>
      ))}
      <label className="text-[11px] text-text-muted">
        Table cell background color
        <ColorPicker
          aria-label="Table cell background color"
          data-testid="prop-table-cell-background-color"
          className="w-full h-7 border border-border rounded cursor-pointer bg-card"
          value={element.cellBgColor || '#1e1e2e'}
          disabled={element.locked}
          data-mixed={mixed.cellBgColor?.isMixed ? 'true' : undefined}
          onChange={(event) => onUpdate({ cellBgColor: event.target.value })}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-text-secondary">
        <input
          type="checkbox"
          aria-label="Table header bold"
          data-testid="prop-table-header-bold"
          checked={element.headerIsBold ?? true}
          disabled={element.locked}
          aria-checked={mixed.headerIsBold?.isMixed ? 'mixed' : (element.headerIsBold ?? true)}
          data-mixed={mixed.headerIsBold?.isMixed ? 'true' : undefined}
          ref={(input) => {
            if (input) input.indeterminate = mixed.headerIsBold?.isMixed === true
          }}
          onChange={(event) => onUpdate({ headerIsBold: event.target.checked })}
        />
        Table header bold
      </label>
      <p className="col-span-2 text-[11px] text-text-muted">
        Column widths and row heights are relative weights within the table size.
      </p>
      {dimensionInput('colWidths', columns, element.width, 'column')}
      {dimensionInput('rowHeights', data.length, element.height, 'row')}
    </div>
  )
}
