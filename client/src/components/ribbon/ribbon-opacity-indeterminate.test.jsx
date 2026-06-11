import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'

const a = { id: 'a', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 100, opacity: 1 }
const b = { id: 'b', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 100, opacity: 0.5 }

describe('Phase 3: ribbon opacity indeterminate', () => {
  it('marks opacity slider mixed + shows — when selection differs', () => {
    render(
      <FormatTabContent
        selectedElement={a}
        onUpdateElement={vi.fn()}
        elements={[a, b]}
        selectedElementIds={['a', 'b']}
      />
    )
    const slider = screen.getByLabelText('Opacity')
    expect(slider.getAttribute('data-mixed')).toBe('true')
  })

  it('does not mark mixed for single selection', () => {
    render(
      <FormatTabContent
        selectedElement={a}
        onUpdateElement={vi.fn()}
        elements={[a, b]}
        selectedElementIds={['a']}
      />
    )
    expect(screen.getByLabelText('Opacity').getAttribute('data-mixed')).not.toBe('true')
  })
})
