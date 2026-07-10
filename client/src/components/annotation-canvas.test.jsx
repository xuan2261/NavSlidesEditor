import React from 'react'
import { render, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  SVGElement.prototype.getBoundingClientRect = vi.fn(() => ({
    left: 100,
    top: 50,
    width: 400,
    height: 200,
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

  it('uses a normalized viewBox and emits normalized stroke coordinates', () => {
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

    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }))
    })
    act(() => {
      svg.dispatchEvent(new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }))
    })
    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerup', {
        clientX: 300,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }))
    })

    expect(svg.getAttribute('viewBox')).toBe('0 0 1 1')
    expect(onStrokeComplete).toHaveBeenCalledWith(expect.objectContaining({
      coordinateSpace: 'normalized',
      points: [
        { x: 0.25, y: 0.25 },
        { x: 0.5, y: 0.5 },
      ],
    }))
  })

  it('preserves highlighter type and preview opacity', () => {
    const onStrokeComplete = vi.fn()
    const { container } = render(
      <AnnotationCanvas
        tool="highlighter"
        color="#FFFF00"
        strokeWidth={3}
        strokes={[]}
        onStrokeComplete={onStrokeComplete}
      />
    )
    const svg = container.querySelector('svg')

    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }))
    })
    expect(container.querySelector('path').getAttribute('opacity')).toBe('0.3')
    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerup', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }))
    })

    expect(onStrokeComplete).toHaveBeenCalledWith(expect.objectContaining({
      type: 'highlighter',
    }))
  })

  it('emits normalized laser positions and deactivates on release', () => {
    const onLaserChange = vi.fn()
    const { container } = render(
      <AnnotationCanvas
        tool="laser"
        color="#FF0000"
        strokeWidth={3}
        strokes={[]}
        onStrokeComplete={vi.fn()}
        onLaserChange={onLaserChange}
      />
    )
    const svg = container.querySelector('svg')

    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }))
      svg.dispatchEvent(new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }))
      svg.dispatchEvent(new PointerEvent('pointerup', {
        clientX: 300,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }))
    })

    expect(onLaserChange).toHaveBeenCalledWith({ x: 0.25, y: 0.25, active: true })
    expect(onLaserChange).toHaveBeenCalledWith({ x: 0.5, y: 0.5, active: true })
    expect(onLaserChange).toHaveBeenLastCalledWith({ x: 0.5, y: 0.5, active: false })
  })

  it('does not create or complete a draft while erasing', () => {
    const onStrokeComplete = vi.fn()
    const onErase = vi.fn()
    const strokes = [
      {
        id: 'existing',
        points: [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
        color: '#FF0000',
        strokeWidth: 3,
      },
    ]
    const { container } = render(
      <AnnotationCanvas
        tool="eraser"
        color="#FF0000"
        strokeWidth={3}
        strokes={strokes}
        onStrokeComplete={onStrokeComplete}
        onErase={onErase}
      />
    )
    const svg = container.querySelector('svg')

    act(() => {
      svg.dispatchEvent(new PointerEvent('pointerdown', {
        clientX: 200,
        clientY: 100,
        pointerId: 1,
        bubbles: true,
      }))
      svg.dispatchEvent(new PointerEvent('pointermove', {
        clientX: 300,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }))
      svg.dispatchEvent(new PointerEvent('pointerup', {
        clientX: 300,
        clientY: 150,
        pointerId: 1,
        bubbles: true,
      }))
    })

    expect(container.querySelectorAll('path')).toHaveLength(1)
    expect(onStrokeComplete).not.toHaveBeenCalled()
    expect(onErase).not.toHaveBeenCalled()
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
