import { describe, expect, it } from 'vitest'
import { SHAPES, shapeSvgString } from '../src/shapeUtils.js'

describe('shapeUtils', () => {
  it('exposes the documented shape catalog', () => {
    expect(SHAPES.map((shape) => shape.id)).toEqual([
      'rect',
      'rounded-rect',
      'circle',
      'triangle',
      'diamond',
      'arrow-right',
      'star',
      'line',
      'hexagon',
      'pentagon',
      'cloud',
      'cylinder',
      'parallelogram',
      'trapezoid',
      'bracket',
    ])
  })

  it('renders configurable SVG geometry, text, border radius, and dashed lines', () => {
    const rounded = shapeSvgString({
      shape: 'rect',
      width: 120,
      height: 80,
      fill: '#111111',
      stroke: '#eeeeee',
      strokeWidth: 4,
      borderRadius: 12,
      text: 'Label',
      fontSize: 18,
    })
    expect(rounded).toContain('<rect x="2" y="2" width="116" height="76" rx="12"')
    expect(rounded).toContain('fill="#111111"')
    expect(rounded).toContain('stroke="#eeeeee"')
    expect(rounded).toContain('font-size="18"')
    expect(rounded).toContain('>Label</text>')

    const line = shapeSvgString({
      shape: 'line',
      width: 100,
      height: 20,
      fill: '#ff0000',
      strokeWidth: 5,
      dashArray: '4 2',
    })
    expect(line).toContain('<line')
    expect(line).toContain('stroke-dasharray="4 2"')
  })

  it('escapes shape text content to prevent markup injection', () => {
    const escaped = shapeSvgString({
      shape: 'rect',
      width: 120,
      height: 80,
      text: '<script>alert(1)</script>',
    })
    expect(escaped).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(escaped).not.toContain('<script>alert(1)</script>')
  })
})
