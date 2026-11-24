import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ImageProperties from './image-properties'
import ShapeProperties from './shape-properties'

function SelectionHarness({ Component, initial }) {
  const [elements, setElements] = useState(initial)
  return <>
    <Component element={elements[0]} elements={elements}
      selectedElementIds={elements.map((element) => element.id)}
      onUpdate={(patch) => setElements((current) => current.map((element) => ({ ...element, ...patch })))} />
    <output data-testid="saved-selection">{JSON.stringify(elements)}</output>
  </>
}
const saved = () => JSON.parse(screen.getByTestId('saved-selection').textContent)

describe('July mixed property regressions', () => {
  it('shows mixed image fit and filters and can apply the primary value directly', () => {
    render(<SelectionHarness Component={ImageProperties} initial={[
      { id: 'a', type: 'image', objectFit: 'contain', filterBrightness: 100 },
      { id: 'b', type: 'image', objectFit: 'cover', filterBrightness: 50 },
    ]} />)
    const fit = screen.getByLabelText('Image object fit')
    const brightness = screen.getByLabelText('Image brightness')
    expect(fit.selectedOptions[0].textContent).toBe('Multiple values')
    expect(document.getElementById(brightness.getAttribute('aria-describedby')).textContent).toBe('Multiple values')
    fireEvent.click(screen.getByRole('button', { name: 'Apply primary image object fit to all selected elements' }))
    expect(saved().map((element) => element.objectFit)).toEqual(['contain', 'contain'])
    expect(fit.value).toBe('contain')
    fireEvent.click(screen.getByRole('button', { name: 'Apply primary image brightness to all selected elements' }))
    expect(saved().map((element) => element.filterBrightness)).toEqual([100, 100])
    expect(brightness.getAttribute('aria-describedby')).toBeNull()
  })

  it('treats omitted visual values and explicit effective defaults as equal', () => {
    render(<SelectionHarness Component={ImageProperties} initial={[
      { id: 'a', type: 'image' },
      { id: 'b', type: 'image', objectFit: 'contain', filterBrightness: 100, filterContrast: 100,
        filterGrayscale: 0, filterSaturate: 100, borderRadius: 0, borderWidth: 0, borderColor: '#000000' },
    ]} />)
    expect(screen.getByLabelText('Image object fit').value).toBe('contain')
    expect(screen.queryByText('Multiple values')).toBeNull()
  })

  it('describes mixed borders and reapplies primary image border color', () => {
    render(<SelectionHarness Component={ImageProperties} initial={[
      { id: 'a', type: 'image', borderColor: '#ff0000', borderWidth: 1 },
      { id: 'b', type: 'image', borderColor: '#0000ff', borderWidth: 3 },
    ]} />)
    expect(screen.getByLabelText('Image border width').value).toBe('')
    const color = screen.getByLabelText('Image border color')
    expect(document.getElementById(color.getAttribute('aria-describedby')).textContent).toBe('Multiple values')
    fireEvent.click(screen.getByRole('button', { name: 'Apply primary image border color to all selected elements' }))
    expect(saved().map((element) => element.borderColor)).toEqual(['#ff0000', '#ff0000'])
    expect(color.getAttribute('aria-describedby')).toBeNull()
  })

  it('visibly and accessibly describes mixed shape fills until the selection converges', () => {
    render(<SelectionHarness Component={ShapeProperties} initial={[
      { id: 'a', type: 'shape', shape: 'rect', fill: '#ff0000' },
      { id: 'b', type: 'shape', shape: 'rect', fill: '#0000ff' },
    ]} />)
    const fill = screen.getByLabelText('Shape fill color')
    expect(screen.getByText('Multiple values')).toBeTruthy()
    expect(document.getElementById(fill.getAttribute('aria-describedby')).textContent).toBe('Multiple values')
    fireEvent.click(screen.getByRole('button', { name: 'Apply primary shape fill color to all selected elements' }))
    expect(saved().map((element) => element.fill)).toEqual(['#ff0000', '#ff0000'])
    expect(screen.queryByText('Multiple values')).toBeNull()
    expect(fill.getAttribute('aria-describedby')).toBeNull()
  })
})
