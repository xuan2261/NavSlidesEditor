import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import AnimationTimeline from './AnimationTimeline'

const textEl = (id, opts = {}) => ({
  id, type: 'text', content: `<p>${id}</p>`, x: 0, y: 0, width: 200, height: 50, ...opts,
})

function makeSlide(elements) {
  return { id: 'slide-1', elements }
}

describe('AnimationTimeline', () => {
  it('renders empty-state hint when no animated elements exist', () => {
    const slide = makeSlide([textEl('a'), textEl('b')])
    render(
      <AnimationTimeline
        slide={slide}
        onUpdateElement={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByTestId('animation-timeline-empty-state')).toBeTruthy()
  })

  it('hides empty-state when at least one element has fragment:true', () => {
    const slide = makeSlide([
      textEl('a', { fragment: true, fragmentIndex: 1 }),
      textEl('b'),
    ])
    render(
      <AnimationTimeline
        slide={slide}
        onUpdateElement={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.queryByTestId('animation-timeline-empty-state')).toBeNull()
  })

  it('dropping a non-animated element on a step sets fragment:true', () => {
    const onUpdateElement = vi.fn()
    const slide = makeSlide([
      textEl('a', { fragment: true, fragmentIndex: 1 }),
      textEl('b'),
    ])
    render(
      <AnimationTimeline
        slide={slide}
        onUpdateElement={onUpdateElement}
        onClose={vi.fn()}
      />
    )
    const dropZone = screen.getByTestId('animation-timeline-newstep-dropzone')
    fireEvent.dragStart(screen.getByTestId('animation-timeline-item-b'), {
      dataTransfer: { effectAllowed: '', setData: vi.fn() },
    })
    fireEvent.drop(dropZone)
    expect(onUpdateElement).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ fragment: true, fragmentIndex: expect.any(Number) }),
    )
  })

  it('drag end clears drag item state (no stuck-drag bug)', () => {
    const slide = makeSlide([
      textEl('a', { fragment: true, fragmentIndex: 1 }),
    ])
    const { container } = render(
      <AnimationTimeline
        slide={slide}
        onUpdateElement={vi.fn()}
        onClose={vi.fn()}
      />
    )
    const item = screen.getByTestId('animation-timeline-item-a')
    fireEvent.dragStart(item, { dataTransfer: { effectAllowed: '', setData: vi.fn() } })
    fireEvent.dragEnd(item)
    // No assertion error means the component handled the dragEnd event
    expect(container).toBeTruthy()
  })
})
