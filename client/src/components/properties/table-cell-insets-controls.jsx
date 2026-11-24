import { resolveTableInsets } from 'revealjs-shared'
import { clampNumber } from '../../utils/number-input'
import FocusedAuthoringTextInput from './focused-authoring-text-input'

export default function TableCellInsetsControls({ value, fallback, cell, onChange }) {
  const insets = resolveTableInsets(value, fallback)
  return ['top', 'right', 'bottom', 'left'].map((side) => (
    <label key={side} className="text-[11px] text-text-muted">
      Cell {side} inset
      <FocusedAuthoringTextInput
        aria-label={`Selected cell row ${cell.row + 1} column ${cell.col + 1} ${side} inset`}
        className="w-full bg-card border border-border text-text-primary px-2 py-1.5 rounded-sm text-xs focus:outline-none focus:border-accent"
        type="number"
        min="0"
        step="any"
        value={insets[side]}
        onChange={(event) => {
          const next = clampNumber(event.target.value, 0, null, null)
          if (next !== null) onChange({ ...insets, [side]: next })
        }}
      />
    </label>
  ))
}
