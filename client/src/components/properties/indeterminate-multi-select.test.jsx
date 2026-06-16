import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CommonElementControls from './common-element-controls'
import ShapeProperties from './shape-properties'

const noop = vi.fn()

describe('Phase 3: CommonElementControls geometry indeterminate', () => {
  const a = { id: 'a', type: 'shape', x: 10, y: 20, width: 100, height: 50, rotation: 0 }
  const b = { id: 'b', type: 'shape', x: 999, y: 20, width: 100, height: 50, rotation: 0 }

  function renderControls(element, extra = {}) {
    return render(
      <CommonElementControls
        element={element}
        onUpdate={noop}
        onBringForward={noop}
        onSendBackward={noop}
        onDelete={noop}
        {...extra}
      />
    )
  }

  it('[cap:flow.multiselect tier:deep depth:behavior] blanks X when selection differs on x, keeps Y (shared)', () => {
    renderControls(a, { elements: [a, b], selectedElementIds: ['a', 'b'] })
    const x = screen.getByTestId('prop-x')
    const y = screen.getByTestId('prop-y')
    expect(x.value).toBe('')
    expect(x.getAttribute('placeholder')).toBe('—')
    // Y is identical across selection → concrete value
    expect(y.value).toBe('20')
  })

  it('shows concrete values for single selection (no false mixed)', () => {
    renderControls(a, { elements: [a, b], selectedElementIds: ['a'] })
    expect(screen.getByTestId('prop-x').value).toBe('10')
  })

  it('defaults to concrete values when no selection props passed', () => {
    renderControls(a)
    expect(screen.getByTestId('prop-x').value).toBe('10')
  })

  it('[cap:flow.multiselect tier:deep depth:behavior] editing a blanked (mixed) X still calls onUpdate (write path intact)', () => {
    const onUpdate = vi.fn()
    renderControls(a, { elements: [a, b], selectedElementIds: ['a', 'b'], onUpdate })
    fireEvent.change(screen.getByTestId('prop-x'), { target: { value: '55' } })
    expect(onUpdate).toHaveBeenCalledWith({ x: 55 })
  })
})

describe('Phase 3: ShapeProperties opacity + color indeterminate', () => {
  const a = { id: 'a', type: 'shape', shape: 'rect', opacity: 1, fill: '#ff0000', stroke: '#000000' }
  const b = { id: 'b', type: 'shape', shape: 'rect', opacity: 0.5, fill: '#00ff00', stroke: '#000000' }

  function renderShape(element, extra = {}) {
    return render(<ShapeProperties element={element} onUpdate={noop} {...extra} />)
  }

  it('[cap:element.shape depth:behavior] marks opacity slider mixed when selection differs', () => {
    renderShape(a, { elements: [a, b], selectedElementIds: ['a', 'b'] })
    expect(screen.getByTestId('prop-shape-opacity').getAttribute('data-mixed')).toBe('true')
  })

  it('[cap:element.shape depth:behavior] marks fill mixed but NOT stroke (stroke shared)', () => {
    renderShape(a, { elements: [a, b], selectedElementIds: ['a', 'b'] })
    expect(screen.getByTestId('prop-shape-fill').getAttribute('data-mixed')).toBe('true')
    expect(screen.getByTestId('prop-shape-stroke').getAttribute('data-mixed')).not.toBe('true')
  })

  it('no mixed flags for single selection', () => {
    renderShape(a, { elements: [a, b], selectedElementIds: ['a'] })
    expect(screen.getByTestId('prop-shape-opacity').getAttribute('data-mixed')).not.toBe('true')
    expect(screen.getByTestId('prop-shape-fill').getAttribute('data-mixed')).not.toBe('true')
  })

  it('[cap:flow.multiselect tier:deep depth:behavior] editing a mixed opacity still writes through onUpdate', () => {
    const onUpdate = vi.fn()
    renderShape(a, { elements: [a, b], selectedElementIds: ['a', 'b'], onUpdate })
    fireEvent.change(screen.getByTestId('prop-shape-opacity'), { target: { value: '40' } })
    expect(onUpdate).toHaveBeenCalledWith({ opacity: 0.4 })
  })
})
