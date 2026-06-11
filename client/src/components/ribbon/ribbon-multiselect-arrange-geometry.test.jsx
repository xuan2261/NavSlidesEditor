import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'
import { computeMultiZOrderStep } from '../../utils/z-order-step'

// (a) Whole-selection arrange parity: the EditorPage wires the ribbon arrange
// buttons to a multi-aware action (computeMultiZOrderStep) instead of moving only
// the primary. We assert the pure action moves ALL selected ids, mirroring the
// keyboard path. The wiring itself is verified at EditorPage; here we lock the
// contract the ribbon must call.
describe('ribbon arrange — whole-selection parity (pure contract)', () => {
  it('computeMultiZOrderStep moves every selected element forward, not just primary', () => {
    const els = [
      { id: 'A', zIndex: 1 },
      { id: 'B', zIndex: 2 },
      { id: 'C', zIndex: 3 },
      { id: 'D', zIndex: 4 },
    ]
    // Select A,B,C (bottom three). Forward should lift all three above where they
    // were; D (the only non-selected on top) ends below at least one.
    const out = computeMultiZOrderStep(els, ['A', 'B', 'C'], 'forward')
    const z = Object.fromEntries(out.map((e) => [e.id, e.zIndex]))
    // All three selected ended up above the unselected D.
    expect(z.A).toBeGreaterThan(z.D)
    expect(z.B).toBeGreaterThan(z.D)
    expect(z.C).toBeGreaterThan(z.D)
  })
})

// (b) Geometry mixed/indeterminate state, mirroring the Properties panel.
const elements = [
  { id: 'el-1', type: 'text', x: 100, y: 50, width: 300, height: 150, rotation: 0 },
  { id: 'el-2', type: 'text', x: 999, y: 50, width: 300, height: 150, rotation: 45 },
]

describe('FormatTabContent — geometry mixed state on multi-select', () => {
  it('blanks X when the selection diverges on X', () => {
    render(
      <FormatTabContent
        selectedElement={elements[0]}
        elements={elements}
        selectedElementIds={['el-1', 'el-2']}
        onUpdateElement={() => {}}
      />
    )
    // divergent X (100 vs 999) → blank value
    expect(screen.getByLabelText('X position').value).toBe('')
    // uniform W (300 vs 300) → shows the shared value
    expect(screen.getByLabelText('Width').value).toBe('300')
    // divergent rotation (0 vs 45) → blank
    expect(screen.getByLabelText('Rotation degrees').value).toBe('')
    // uniform Y (50 vs 50) → shared value
    expect(screen.getByLabelText('Y position').value).toBe('50')
  })

  it('single-select shows concrete values (never blank)', () => {
    render(
      <FormatTabContent
        selectedElement={elements[0]}
        elements={elements}
        selectedElementIds={['el-1']}
        onUpdateElement={() => {}}
      />
    )
    expect(screen.getByLabelText('X position').value).toBe('100')
    expect(screen.getByLabelText('Width').value).toBe('300')
  })

  it('editing a blanked (mixed) field still fans the value via onUpdateElement', () => {
    const onUpdateElement = vi.fn()
    render(
      <FormatTabContent
        selectedElement={elements[0]}
        elements={elements}
        selectedElementIds={['el-1', 'el-2']}
        onUpdateElement={onUpdateElement}
      />
    )
    fireEvent.change(screen.getByLabelText('X position'), { target: { value: '20' } })
    expect(onUpdateElement).toHaveBeenCalledWith({ x: 20 })
  })
})
