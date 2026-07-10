import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnnotationToolbar } from './annotation-toolbar.jsx'

describe('AnnotationToolbar', () => {
  it('renders when visible=true', () => {
    const { container } = render(
      <AnnotationToolbar
        tool="none"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={true}
      />
    )
    expect(container.querySelector('.annotation-toolbar')).not.toBeNull()
  })

  it('does not render when visible=false', () => {
    const { container } = render(
      <AnnotationToolbar
        tool="none"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={false}
      />
    )
    expect(container.querySelector('.annotation-toolbar')).toBeNull()
  })

  it('shows tool buttons (pen, laser, highlighter, eraser)', () => {
    const { container } = render(
      <AnnotationToolbar
        tool="none"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={true}
      />
    )
    const buttons = container.querySelectorAll('button')
    const labels = Array.from(buttons).map((b) => b.textContent)
    expect(labels).toContain('Pen')
    expect(labels).toContain('Laser')
    expect(labels).toContain('Highlight')
    expect(labels).toContain('Eraser')
    expect(labels).toContain('Select')
  })

  it('highlights active tool', () => {
    const { container: c1 } = render(
      <AnnotationToolbar
        tool="pen"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={true}
      />
    )
    const penBtn1 = Array.from(c1.querySelectorAll('button')).find((b) => b.textContent === 'Pen')
    expect(penBtn1.style.backgroundColor).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.2\)/)
    expect(penBtn1.getAttribute('aria-label')).toBe('Pen')
    expect(penBtn1.getAttribute('aria-pressed')).toBe('true')

    const { container: c2 } = render(
      <AnnotationToolbar
        tool="none"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={true}
      />
    )
    const selectBtn = Array.from(c2.querySelectorAll('button')).find((b) => b.textContent === 'Select')
    expect(selectBtn.style.backgroundColor).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.2\)/)
    expect(selectBtn.getAttribute('aria-pressed')).toBe('true')
    expect(Array.from(c2.querySelectorAll('button')).find((b) => b.textContent === 'Pen')
      .getAttribute('aria-pressed')).toBe('false')
  })

  it('shows color picker when pen tool selected', () => {
    const { container } = render(
      <AnnotationToolbar
        tool="pen"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={true}
      />
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(6)
  })

  it('calls onToolChange when tool button clicked', () => {
    const onToolChange = vi.fn()
    const { container } = render(
      <AnnotationToolbar
        tool="none"
        color="#FF0000"
        onToolChange={onToolChange}
        onColorChange={vi.fn()}
        onClear={vi.fn()}
        visible={true}
      />
    )
    const penBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Pen')
    fireEvent.click(penBtn)
    expect(onToolChange).toHaveBeenCalledWith('pen')
  })

  it('calls onColorChange when color swatch clicked', () => {
    const onColorChange = vi.fn()
    const { container } = render(
      <AnnotationToolbar
        tool="pen"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={onColorChange}
        onClear={vi.fn()}
        visible={true}
      />
    )
    const colorBtns = container.querySelectorAll('button')
    const firstColorBtn = colorBtns[5]
    expect(firstColorBtn.getAttribute('aria-label')).toBeTruthy()
    fireEvent.click(firstColorBtn)
    expect(onColorChange).toHaveBeenCalled()
  })

  it('calls onClear when clear button clicked', () => {
    const onClear = vi.fn()
    const { container } = render(
      <AnnotationToolbar
        tool="pen"
        color="#FF0000"
        onToolChange={vi.fn()}
        onColorChange={vi.fn()}
        onClear={onClear}
        visible={true}
      />
    )
    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Clear')
    fireEvent.click(clearBtn)
    expect(onClear).toHaveBeenCalled()
  })
})
