import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ParametricMathGridModal from './parametric-math-grid-surface-plotter-modal.jsx'
import {
  sanitizeMathExpr,
  evalRange,
  PRESETS,
} from '../data/parametric-math-grid-templates.js'

const mountModal = (overrides = {}) => {
  const onInsert = vi.fn()
  const onClose = vi.fn()
  const utils = render(
    <ParametricMathGridModal onInsert={onInsert} onClose={onClose} {...overrides} />,
  )
  return { ...utils, onInsert, onClose }
}

const insertHtml = (onInsert) => {
  fireEvent.click(screen.getByRole('button', { name: /^insert$/i }))
  return onInsert.mock.calls[onInsert.mock.calls.length - 1][0]
}

describe('ParametricMathGridSurfacePlotterModal', () => {
  it('renders all 10 source presets and does not render Lissajous', () => {
    mountModal()
    for (const preset of PRESETS) {
      expect(screen.getByText(preset.name)).toBeTruthy()
    }
    expect(screen.queryByText('Lissajous')).toBeNull()
  })

  it('Insert emits SVG (no <canvas>, no <script>)', () => {
    const { onInsert } = mountModal()
    const html = insertHtml(onInsert)
    expect(html).toContain('<svg ')
    expect(html).toContain('<polyline ')
    expect(html).not.toContain('<canvas')
    expect(html).not.toContain('<script')
  })

  it('emits a viewBox with finite numeric values', () => {
    const { onInsert } = mountModal()
    const html = insertHtml(onInsert)
    const match = html.match(/viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/)
    expect(match).toBeTruthy()
    for (let i = 1; i <= 4; i += 1) {
      expect(Number.isFinite(parseFloat(match[i]))).toBe(true)
    }
  })

  it('switching preset populates xExpr / yExpr / range / div inputs', () => {
    mountModal()
    fireEvent.click(screen.getByText('Polar'))
    expect(screen.getByLabelText('X expression').value).toBe('u*cos(v)')
    expect(screen.getByLabelText('Y expression').value).toBe('u*sin(v)')
    expect(screen.getByLabelText('u min').value).toBe('0.5')
    expect(screen.getByLabelText('v max').value).toBe('2*PI')
    expect(screen.getByLabelText('u divisions').value).toBe('8')
    expect(screen.getByLabelText('v divisions').value).toBe('32')
  })

  it('compile error shows inline message and disables Insert', () => {
    mountModal()
    const xInput = screen.getByLabelText('X expression')
    fireEvent.change(xInput, { target: { value: 'u +' } })
    expect(screen.getByRole('alert').textContent).toMatch(/invalid expression/i)
    expect(screen.getByRole('button', { name: /^insert$/i }).disabled).toBe(true)
  })

  it('empty-points (1/0) shows inline error and disables Insert', () => {
    mountModal()
    const xInput = screen.getByLabelText('X expression')
    const yInput = screen.getByLabelText('Y expression')
    fireEvent.change(xInput, { target: { value: '1/0' } })
    fireEvent.change(yInput, { target: { value: '1/0' } })
    expect(screen.getByRole('alert').textContent).toMatch(/no valid points/i)
    expect(screen.getByRole('button', { name: /^insert$/i }).disabled).toBe(true)
  })

  it('u-line toggle off removes u-polylines from emitted SVG', () => {
    const { onInsert } = mountModal()
    const before = insertHtml(onInsert)
    const beforeCount = (before.match(/<polyline /g) || []).length
    fireEvent.click(screen.getByLabelText(/show u lines/i))
    const after = insertHtml(onInsert)
    const afterCount = (after.match(/<polyline /g) || []).length
    expect(afterCount).toBeGreaterThan(0)
    expect(afterCount).toBeLessThan(beforeCount)
  })

  it('v-line toggle off removes v-polylines from emitted SVG', () => {
    const { onInsert } = mountModal()
    const before = insertHtml(onInsert)
    const beforeCount = (before.match(/<polyline /g) || []).length
    fireEvent.click(screen.getByLabelText(/show v lines/i))
    const after = insertHtml(onInsert)
    const afterCount = (after.match(/<polyline /g) || []).length
    expect(afterCount).toBeGreaterThan(0)
    expect(afterCount).toBeLessThan(beforeCount)
  })

  it('color change is reflected in stroke attribute of emitted SVG', () => {
    const { onInsert } = mountModal()
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: '#ff0000' } })
    const html = insertHtml(onInsert)
    expect(html).toMatch(/stroke="#ff0000"/i)
  })

  it('line-width change is reflected in stroke-width attribute', () => {
    const { onInsert } = mountModal()
    const lwInput = screen.getByLabelText('Line width')
    fireEvent.change(lwInput, { target: { value: '4' } })
    const html = insertHtml(onInsert)
    const match = html.match(/stroke-width="([\d.]+)"/)
    expect(match).toBeTruthy()
    expect(parseFloat(match[1])).toBeGreaterThan(0)
  })

  it('opacity change is reflected in opacity attribute', () => {
    const { onInsert } = mountModal()
    fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '0.4' } })
    const html = insertHtml(onInsert)
    expect(html).toMatch(/opacity="0\.4"/)
  })

  it('non-transparent bg is reflected in emitted style block', () => {
    const { onInsert } = mountModal()
    fireEvent.change(screen.getByLabelText('Background'), { target: { value: '#0a0a14' } })
    const html = insertHtml(onInsert)
    expect(html).toMatch(/background:#0a0a14/i)
  })

  it('rejects constructor-injection expressions (sanitizer regression)', () => {
    const { onInsert } = mountModal()
    const xInput = screen.getByLabelText('X expression')
    fireEvent.change(xInput, {
      target: { value: "constructor.constructor('alert(1)')()" },
    })
    const html = insertHtml(onInsert)
    expect(html).not.toContain('constructor')
    expect(html).not.toContain('alert')
  })

  it('sanitizer rejects each blocked token', () => {
    const blocked = [
      'constructor',
      'prototype',
      'globalThis',
      'window',
      'self',
      'eval',
      'import',
      'Function',
      '[1]',
      'a=1',
      '`x`',
      'this',
    ]
    for (const expr of blocked) {
      expect(sanitizeMathExpr(expr)).toBe('0')
    }
    expect(sanitizeMathExpr('u + sin(v)')).toBe('u + sin(v)')
    expect(sanitizeMathExpr('cos(u)*v')).toBe('cos(u)*v')
  })

  it('evalRange parses numbers and PI/E strings, falls back to 0 on bad input', () => {
    expect(evalRange(5)).toBe(5)
    expect(evalRange(-2.5)).toBe(-2.5)
    expect(evalRange('2*PI')).toBeCloseTo(2 * Math.PI, 5)
    expect(evalRange('6*PI')).toBeCloseTo(6 * Math.PI, 5)
    expect(evalRange('))(')).toBe(0)
    expect(evalRange('constructor')).toBe(0)
    expect(evalRange('')).toBe(0)
    expect(evalRange(null)).toBe(0)
  })

  it('preview does NOT use an iframe (architecture guard)', () => {
    const { container } = mountModal()
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('Insert calls onInsert then onClose', () => {
    const { onInsert, onClose } = mountModal()
    fireEvent.click(screen.getByRole('button', { name: /^insert$/i }))
    expect(onInsert).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
