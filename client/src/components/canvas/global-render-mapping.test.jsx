import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import CanvasElement from './canvas-element-wrapper'

function renderCanvasElement(element, overrides = {}) {
  return render(
    <CanvasElement
      element={element}
      isSelected={false}
      isEditing={false}
      isCropping={false}
      cropState={null}
      isDragging={false}
      editor={null}
      onPointerDown={vi.fn()}
      onClick={vi.fn()}
      onDoubleClick={vi.fn()}
      onContextMenu={vi.fn()}
      onCropHandleDown={vi.fn()}
      onCommitCrop={vi.fn()}
      onUpdateElement={vi.fn()}
      iconPaths={{}}
      {...overrides}
    />
  )
}

describe('Phase 1: canvas opacity content-layer (red-team M1)', () => {
  const textElement = {
    id: 'text-op',
    type: 'text',
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    content: '<p>Hi</p>',
    opacity: 0.5,
  }

  it('applies opacity to the element content layer, not the chrome', () => {
    renderCanvasElement(textElement, { isSelected: true })
    const wrapper = screen.getByTestId('slide-element-text-op')

    // Content layer carries opacity
    const contentLayer = wrapper.querySelector('[data-element-content]')
    expect(contentLayer).not.toBeNull()
    expect(contentLayer.style.opacity).toBe('0.5')

    // The wrapper itself must NOT dim (selection outline / handles live here)
    expect(wrapper.style.opacity).toBe('')

    // Resize handles stay fully opaque (they are siblings of the content layer)
    const handle = wrapper.querySelector('[data-testid="resize-handle-nw"]')
    expect(handle).not.toBeNull()
    expect(handle.style.opacity).toBe('')
  })

  it('applies shape opacity exactly once (0.5, not 0.25 double-applied)', () => {
    renderCanvasElement({
      id: 'shape-op',
      type: 'shape',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fill: '#ff0000',
      opacity: 0.5,
    })
    const wrapper = screen.getByTestId('slide-element-shape-op')
    const contentLayer = wrapper.querySelector('[data-element-content]')
    expect(contentLayer.style.opacity).toBe('0.5')

    // The shape's own inner wrapper must no longer carry a second opacity
    const shapeInner = contentLayer.querySelector('div')
    // shape renderer root div previously had opacity: element.opacity || 1
    expect(shapeInner.style.opacity === '' || shapeInner.style.opacity === '1').toBe(true)
  })

  it('leaves content layer at full opacity when unset', () => {
    renderCanvasElement({ ...textElement, id: 'text-noop', opacity: undefined })
    const wrapper = screen.getByTestId('slide-element-text-noop')
    const contentLayer = wrapper.querySelector('[data-element-content]')
    // unset → no dimming (empty or '1')
    expect(contentLayer.style.opacity === '' || contentLayer.style.opacity === '1').toBe(true)
  })
})

describe('Phase 1: code border-radius', () => {
  it('applies element.borderRadius to the inner code block', () => {
    renderCanvasElement({
      id: 'code-1',
      type: 'code',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      content: 'const a = 1',
      language: 'javascript',
      borderRadius: 12,
    })
    const wrapper = screen.getByTestId('slide-element-code-1')
    const pre = wrapper.querySelector('pre')
    expect(pre.style.borderRadius).toBe('12px')
  })
})

describe('Phase 1: image flip on canvas (red-team m2 — target the img)', () => {
  const imageElement = {
    id: 'img-flip',
    type: 'image',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    src: '/uploads/x.png',
    objectFit: 'contain',
  }

  it('adds scaleX(-1) to the img (not the wrapper) for flipH', () => {
    renderCanvasElement({ ...imageElement, flipH: true })
    const wrapper = screen.getByTestId('slide-element-img-flip')
    const img = wrapper.querySelector('img')
    expect(img.style.transform).toContain('scaleX(-1)')
    // wrapper transform must not carry the flip
    expect(wrapper.style.transform || '').not.toContain('scaleX(-1)')
  })

  it('adds scaleY(-1) for flipV', () => {
    renderCanvasElement({ ...imageElement, flipV: true })
    const img = screen.getByTestId('slide-element-img-flip').querySelector('img')
    expect(img.style.transform).toContain('scaleY(-1)')
  })

  it('composes flip with rotation without canceling', () => {
    renderCanvasElement({ ...imageElement, flipH: true, rotation: 30 })
    const wrapper = screen.getByTestId('slide-element-img-flip')
    const img = wrapper.querySelector('img')
    // rotation on the wrapper, flip on the img
    expect(wrapper.style.transform).toContain('rotate(30deg)')
    expect(img.style.transform).toContain('scaleX(-1)')
  })
})
