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
})
