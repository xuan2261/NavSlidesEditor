import { describe, expect, it } from 'vitest'
import colorUtils from './utils-color.js'

const { arrowMarker, colorValue, gradientBackground, normalizeGradientStops, svgAttr } = colorUtils

describe('pptx mapper color utilities', () => {
  it('normalizes PPTX color values and fallback cases', () => {
    expect(colorValue('#123456')).toBe('#123456')
    expect(colorValue({ type: 'color', value: '#abcdef' })).toBe('#abcdef')
    expect(colorValue({ color: '#fedcba' })).toBe('#fedcba')
    expect(colorValue({ type: 'none' })).toBe('none')
    expect(colorValue({ type: 'gradient' })).toBe('gradient')
    expect(colorValue({ type: 'pattern' })).toBe('transparent')
    expect(colorValue(null, '#fff')).toBe('#fff')
  })

  it('normalizes gradient stops and CSS background output', () => {
    const fill = {
      value: {
        rot: 45,
        colors: [
          { pos: 0, color: '#000000' },
          { pos: 50, value: '#777777' },
          { pos: 100, color: '#ffffff' },
        ],
      },
    }
    expect(normalizeGradientStops(fill)).toEqual([
      { offset: 0, color: '#000000' },
      { offset: 0.5, color: '#777777' },
      { offset: 1, color: '#ffffff' },
    ])
    expect(gradientBackground(fill).gradient).toBe(
      'linear-gradient(45deg, #000000 0%, #777777 50%, #ffffff 100%)'
    )
  })

  it('escapes SVG attributes and normalizes arrow markers', () => {
    expect(svgAttr('<path d="a&b">')).toBe('&lt;path d=&quot;a&amp;b&quot;&gt;')
    expect(arrowMarker('triangle')).toBe('arrow')
    expect(arrowMarker('oval')).toBe('circle')
    expect(arrowMarker('diamond')).toBe('diamond')
    expect(arrowMarker('none')).toBe('none')
  })
})
