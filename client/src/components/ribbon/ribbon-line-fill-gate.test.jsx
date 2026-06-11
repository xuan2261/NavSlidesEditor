import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import FormatTabContent from './ribbon-format-tab-element-position-size-rotation-controls'

function sectionLabels(container) {
  return Array.from(container.querySelectorAll('[data-ribbon-section-label]')).map(
    (n) => n.textContent
  )
}

describe('Phase 2: ribbon Fill gate for line', () => {
  const lineEl = { id: 'l1', type: 'line', x: 0, y: 0, width: 200, height: 4, stroke: '#000' }
  const shapeEl = { id: 's1', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 100, fill: '#f00' }

  it('does NOT render a Fill section for a line element', () => {
    const { container } = render(
      <FormatTabContent selectedElement={lineEl} onUpdateElement={vi.fn()} />
    )
    expect(sectionLabels(container)).not.toContain('Fill')
    // stroke still present for line
    expect(sectionLabels(container)).toContain('Stroke')
  })

  it('renders a Fill section for a shape element', () => {
    const { container } = render(
      <FormatTabContent selectedElement={shapeEl} onUpdateElement={vi.fn()} />
    )
    expect(sectionLabels(container)).toContain('Fill')
  })
})
