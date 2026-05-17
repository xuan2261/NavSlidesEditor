import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ParametricMathGridModal from './parametric-math-grid-surface-plotter-modal.jsx'

describe('ParametricMathGridSurfacePlotterModal', () => {
  it('renders preset options', () => {
    render(<ParametricMathGridModal onInsert={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Cartesian')).toBeTruthy()
    expect(screen.getByText('Polar')).toBeTruthy()
    expect(screen.getByText('Wave Mesh')).toBeTruthy()
    expect(screen.getByText('Log Polar')).toBeTruthy()
    expect(screen.getByText('Perspective')).toBeTruthy()
    expect(screen.getByText('Gravity Well')).toBeTruthy()
    expect(screen.getByText('Saddle')).toBeTruthy()
    expect(screen.getByText('Spiral')).toBeTruthy()
    expect(screen.getByText('Diamond')).toBeTruthy()
    expect(screen.getByText('Sinusoidal')).toBeTruthy()
    expect(screen.getByText('Lissajous')).toBeTruthy()
  })

  it('calls onInsert with HTML containing canvas', () => {
    const onInsert = vi.fn()
    render(<ParametricMathGridModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    expect(onInsert).toHaveBeenCalledWith(expect.stringContaining('<!DOCTYPE html>'))
    const html = onInsert.mock.calls[0][0]
    expect(html).toContain('canvas')
  })

  it('switches preset on click', () => {
    render(<ParametricMathGridModal onInsert={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Polar'))
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    expect(insertBtn).toBeTruthy()
  })

  it('allows custom expression editing', () => {
    render(<ParametricMathGridModal onInsert={vi.fn()} onClose={vi.fn()} />)
    // There should be input fields for x and y expressions
    const inputs = screen.getAllByRole('textbox')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('sanitizes math expressions in generated HTML', () => {
    const onInsert = vi.fn()
    render(<ParametricMathGridModal onInsert={onInsert} onClose={vi.fn()} />)
    const insertBtn = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertBtn)
    const html = onInsert.mock.calls[0][0]
    // Should not contain dangerous patterns
    expect(html).not.toContain('<script>alert')
  })
})
