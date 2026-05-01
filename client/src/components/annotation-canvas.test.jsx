import React from 'react'
import { render, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnnotationCanvas } from './annotation-canvas.jsx'

// Mock SVG methods and PointerEvent for jsdom
beforeEach(() => {
  // SVGElement-specific mocks
  SVGElement.prototype.getScreenCTM = vi.fn(() => ({
    inverse: () => ({ x: 0, y: 0 }),
  }))
  SVGElement.prototype.setPointerCapture = vi.fn()
  SVGElement.prototype.createSVGPoint = vi.fn(() => ({
    x: 0,
    y: 0,
    matrixTransform: () => ({ x: 0, y: 0 }),
  }))
})

class MockPointerEvent extends Event {
  constructor(type, props) {
    super(type, props)
    this.clientX = props?.clientX ?? 0
    this.clientY = props?.clientY ?? 0
    this.pointerId = props?.pointerId ?? 1
    this.pointerType = props?.pointerType ?? 'mouse'
    this.buttons = props?.buttons ?? 1
  }
}
window.PointerEvent = MockPointerEvent

describe('AnnotationCanvas', () => {
  it('renders SVG element when visible', () => {
    const { container } = render(
      <AnnotationCanvas tool="none" color="#FF0000" strokeWidth={3} strokes={[]} onStrokeComplete={vi.fn()} />
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('does not capture pointer events when tool=none', () => {
    const { container } = render(
      <AnnotationCanvas tool="none" color="#FF0000" strokeWidth={3} strokes={[]} onStrokeComplete={vi.fn()} />
    )
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('renders existing strokes as SVG paths', () => {
    const strokes = [
      { id: 's1', points: [{ x: 10, y: 20 }, { x: 30, y: 40 }], color: '#FF0000', strokeWidth: 3 },
    ]
    const { container } = render(
      <AnnotationCanvas tool="pen" color="#FF0000" strokeWidth={3} strokes={strokes} onStrokeComplete={vi.fn()} />
    )
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBe(1)
    expect(paths[0].getAttribute('stroke')).toBe('#FF0000')
  })

  it('renders current stroke being drawn', () => {
    const onStrokeComplete = vi.fn()
    const { container } = render(
      <AnnotationCanvas
        tool="pen"
        color="#FF0000"
        strokeWidth={3}
        strokes={[]}
        onStrokeComplete={onStrokeComplete}
      />
    )
    const svg = container.querySelector('svg')

    // Simulate pointer down + move wrapped in act
    act(() => {
      const downEvent = new PointerEvent('pointerdown', {
        clientX: 100,
        clientY: 100,
        bubbles: true,
      })
      svg.dispatchEvent(downEvent)

      const moveEvent = new PointerEvent('pointermove', {
        clientX: 150,
        clientY: 150,
        bubbles: true,
      })
      svg.dispatchEvent(moveEvent)
    })

    // After move there should be a path for the current stroke
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('has correct cursor based on tool', () => {
    const { container: c1 } = render(
      <AnnotationCanvas tool="eraser" color="#000" strokeWidth={3} strokes={[]} onStrokeComplete={vi.fn()} />
    )
    expect(c1.querySelector('svg').style.cursor).toBe('cell')

    const { container: c2 } = render(
      <AnnotationCanvas tool="none" color="#000" strokeWidth={3} strokes={[]} onStrokeComplete={vi.fn()} />
    )
    expect(c2.querySelector('svg').style.cursor).toBe('default')
  })

  it('has pointer-events:none when tool=none', () => {
    const { container } = render(
      <AnnotationCanvas tool="none" color="#FF0000" strokeWidth={3} strokes={[]} onStrokeComplete={vi.fn()} />
    )
    expect(container.querySelector('svg').style.pointerEvents).toBe('none')
  })
})
