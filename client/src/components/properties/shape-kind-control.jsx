import { SHAPES } from 'revealjs-shared'
import { Select } from '../ui'
import { computeMixedValues } from '../../utils/selection-mixed-values'

const SHAPE_KINDS = SHAPES.filter((shape) => shape.id !== 'line')

export default function ShapeKindControl({ element, elements, selectedElementIds, onUpdate }) {
  if (element.type !== 'shape') return null
  const shapes = (elements || [element])
    .filter((item) => item.type === 'shape')
    .map((item) => ({ ...item, shape: item.shape || 'rect' }))
  const mixed = computeMixedValues(shapes, selectedElementIds || [element.id], ['shape']).shape
    .isMixed
  return (
    <label className="flex flex-col gap-1 mb-2.5">
      <span className="text-[11px] text-text-muted">Shape kind</span>
      <Select
        data-testid="prop-shape-kind"
        aria-label="Shape kind"
        data-mixed={mixed ? 'true' : undefined}
        disabled={element.locked === true}
        className="w-full bg-card border border-border text-text-primary px-2.5 py-1.5 rounded-sm text-xs"
        value={mixed ? '' : element.shape || 'rect'}
        onChange={(event) => onUpdate({ shape: event.target.value })}
      >
        {mixed && (
          <option value="" disabled>
            Multiple values
          </option>
        )}
        {SHAPE_KINDS.map((shape) => (
          <option key={shape.id} value={shape.id}>
            {shape.name}
          </option>
        ))}
      </Select>
    </label>
  )
}
