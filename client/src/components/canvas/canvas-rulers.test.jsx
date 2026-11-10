import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CanvasRulers from './canvas-rulers'

describe('CanvasRulers', () => {
  it('ignores non-primary pointer presses', () => {
    const onAddGuide = vi.fn()
    const canvas = document.createElement('div')
    canvas.className = 'slide-canvas'
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0 })
    document.body.append(canvas)

    render(<CanvasRulers scale={1} onAddGuide={onAddGuide} />)
    fireEvent.pointerDown(screen.getByTestId('top-ruler'), {
      button: 2,
      pointerId: 1,
      clientX: 100,
      clientY: 0,
    })
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 100, clientY: 0 })

    expect(onAddGuide).not.toHaveBeenCalled()
    canvas.remove()
  })

  it.each([
    ['native 4:3', { slideWidth: 720, slideHeight: 540 }, 'x', 720],
    ['native wide', { slideWidth: 960, slideHeight: 405 }, 'y', 405],
    ['tall slide', { slideWidth: 540, slideHeight: 960 }, 'y', 960],
    ['default authored', {}, 'x', 960],
  ])('accepts only in-slide guide drops for a %s canvas at non-unit zoom', (_label, dimensions, axis, bound) => {
    const onAddGuide = vi.fn()
    const canvas = document.createElement('div')
    canvas.className = 'slide-canvas'
    canvas.getBoundingClientRect = () => ({ left: 100, top: 60 })
    document.body.append(canvas)
    render(<CanvasRulers scale={0.5} onAddGuide={onAddGuide} {...dimensions} />)
    const ruler = screen.getByTestId(axis === 'x' ? 'top-ruler' : 'left-ruler')

    for (const position of [0, bound, bound + 1, -1]) {
      fireEvent.pointerDown(ruler, { button: 0, pointerId: 7 })
      fireEvent.pointerUp(document, {
        pointerId: 7,
        clientX: 100 + (axis === 'x' ? position * 0.5 : 0),
        clientY: 60 + (axis === 'y' ? position * 0.5 : 0),
      })
    }

    expect(onAddGuide.mock.calls).toEqual([
      [{ axis, position: 0 }],
      [{ axis, position: bound }],
    ])
    canvas.remove()
  })
})
