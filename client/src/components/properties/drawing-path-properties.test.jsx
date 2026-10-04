import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import MiscProperties from './misc-properties'
import { DrawingRenderer } from '../canvas/element-renderers/drawing-element-renderer'
import { buildSelectionUpdates } from '../../utils/element-update-fanout'
import { renderElementFallbackDataUri } from '../../utils/export-pptx-raster'

const initial = {
  id: 'drawing',
  type: 'drawing',
  width: 200,
  height: 100,
  strokeColor: '#123456',
  strokeWidth: 3,
  paths: [{ d: 'M0 0 L80 40', stroke: '#abcdef', strokeWidth: 2, opacity: 0.4 }],
}

function DrawingEditor({ locked = false }) {
  const [elements, setElements] = useState([
    { ...initial, locked },
    { ...initial, id: 'second', paths: [] },
    { ...initial, id: 'locked', locked: true },
    { id: 'text', type: 'text', content: 'Text' },
  ])
  const update = (patch) =>
    setElements((current) => {
      const updates = buildSelectionUpdates(
        current,
        current.map((item) => item.id),
        'drawing',
        patch
      )
      return current.map((item) => ({ ...item, ...updates.find((entry) => entry.id === item.id) }))
    })
  return (
    <>
      <MiscProperties element={elements[0]} onUpdate={update} />
      {elements
        .filter((item) => item.type === 'drawing')
        .map((item) => (
          <div key={item.id} data-testid={`render-${item.id}`}>
            <DrawingRenderer element={item} />
          </div>
        ))}
      <output data-testid="saved-data">{JSON.stringify(elements)}</output>
      <button onClick={() => setElements(JSON.parse(JSON.stringify(elements)))}>Reopen</button>
      <button onClick={() => update({ width: 400, height: 200 })}>Resize</button>
    </>
  )
}

const saved = () => JSON.parse(screen.getByTestId('saved-data').textContent)
const path = (id = 'drawing') => screen.getByTestId(`render-${id}`).querySelector('path')

describe('drawing paths authoring behavior', () => {
  it.each([
    '[',
    '[{"d":"M0 0 L"}]',
    '[{"d":"M0 0 A1 1 0 2 0 5 5"}]',
    '[{"d":"M0 0 L1e999 2"}]',
    '[{"d":"M0 0","strokeWidth":-2}]',
    '[{"d":"M,,0 0"}]',
    '[{"d":"M0 0 L1 1,"}]',
    '[{"d":"M0 0,,L1 1"}]',
    '[{"d":"M0 0","stroke":"#12345"}]',
    '[{"d":"M0 0","stroke":"notacolor"}]',
    '[{"d":"M0 0","opacity":2}]',
    '[{"d":"M0 0","stroke":"url(https://bad.test)"}]',
    '[{"d":"M0 0","onclick":"alert(1)"}]',
    '<script>alert(1)</script>',
  ])('keeps the last valid drawing visible and persisted for invalid draft %s', (draft) => {
    render(<DrawingEditor />)
    const control = screen.getByLabelText('Drawing path data')
    fireEvent.change(control, { target: { value: draft } })
    fireEvent.blur(control)
    expect(control.value).toBe(draft)
    expect(control.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toMatch(/JSON|path|stroke|opacity/i)
    expect(saved()[0].paths).toEqual(initial.paths)
    expect(path().getAttribute('d')).toBe('M0 0 L80 40')
    expect(path().getAttribute('opacity')).toBe('0.4')
  })

  it('commits valid vectors through type and lock gated fanout and reopens rendered strokes', () => {
    render(<DrawingEditor />)
    const paths = [
      { d: 'M5 10 C10 15 20 25 30 35 Z', stroke: '#ff0000', strokeWidth: 7, opacity: 0 },
    ]
    fireEvent.change(screen.getByLabelText('Drawing path data'), {
      target: { value: JSON.stringify(paths) },
    })
    fireEvent.click(screen.getByText('Reopen'))
    expect(saved()[0].paths).toEqual(paths)
    expect(saved()[1].paths).toEqual(paths)
    expect(saved()[2].paths).toEqual(initial.paths)
    expect(saved()[3]).not.toHaveProperty('paths')
    expect(path('second').getAttribute('stroke')).toBe('#ff0000')
    expect(path('second').getAttribute('stroke-width')).toBe('7')
    expect(path('second').getAttribute('opacity')).toBe('0')
    fireEvent.click(screen.getByText('Resize'))
    expect(screen.getByTestId('render-drawing').querySelector('svg').getAttribute('viewBox')).toBe(
      '0 0 400 200'
    )
    expect(path().getAttribute('d')).toBe(paths[0].d)
    expect(saved()[0].paths).toEqual(paths)
  })

  it('recovers an invalid draft and supports explicitly clearing paths', () => {
    render(<DrawingEditor />)
    const control = screen.getByLabelText('Drawing path data')
    fireEvent.change(control, { target: { value: 'not json' } })
    fireEvent.change(control, { target: { value: '[{"d":"m1 2 h3 v4 l-1-.5 z"}]' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(path().getAttribute('d')).toBe('m1 2 h3 v4 l-1-.5 z')
    fireEvent.change(control, { target: { value: '[]' } })
    expect(path()).toBeNull()
    expect(saved()[0].paths).toEqual([])
  })

  it('does not permit a locked drawing draft to modify its vector', () => {
    render(<DrawingEditor locked />)
    expect(screen.getByLabelText('Drawing path data').disabled).toBe(true)
    expect(saved()[0].paths).toEqual(initial.paths)
  })

  it('preserves an intentionally invisible zero-width stroke on canvas and static export', async () => {
    render(<DrawingEditor />)
    const paths = [{ d: 'M0 0 L20 10', strokeWidth: 0 }]
    fireEvent.change(screen.getByLabelText('Drawing path data'), {
      target: { value: JSON.stringify(paths) },
    })
    expect(path().getAttribute('stroke-width')).toBe('0')
    const uri = await renderElementFallbackDataUri(saved()[0])
    const svg = new DOMParser().parseFromString(atob(uri.split(',')[1]), 'image/svg+xml')
    expect(svg.querySelector('path').getAttribute('stroke-width')).toBe('0')
  })

  it('exports authored per-path stroke, width and opacity into an actual vector snapshot', async () => {
    const uri = await renderElementFallbackDataUri(initial)
    const svg = new DOMParser().parseFromString(atob(uri.split(',')[1]), 'image/svg+xml')
    const rendered = svg.querySelector('path')
    expect(rendered.getAttribute('d')).toBe('M0 0 L80 40')
    expect(rendered.getAttribute('stroke')).toBe('#abcdef')
    expect(rendered.getAttribute('stroke-width')).toBe('2')
    expect(rendered.getAttribute('opacity')).toBe('0.4')
  })
})
