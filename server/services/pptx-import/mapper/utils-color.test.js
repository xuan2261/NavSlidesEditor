import { describe, expect, it } from 'vitest'
import colorUtils from './utils-color.js'

const { arrowMarker, colorValue, sanitizeCssColor, gradientBackground, normalizeGradientStops, svgAttr } = colorUtils

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

  it('T4.5 rejects CSS expression injection in colors', () => {
    expect(sanitizeCssColor('red; expression(alert(1))')).toBe('red')
    expect(sanitizeCssColor('expression(alert(1))')).toBe('transparent')
    expect(colorValue('red; expression(alert(1))')).toBe('red')
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
    // OOXML 45° (clockwise from East) → CSS 135° (clockwise from North): +90 offset.
    expect(gradientBackground(fill).gradient).toBe(
      'linear-gradient(135deg, #000000 0%, #777777 50%, #ffffff 100%)'
    )
  })

  it('parses pptxtojson@2.0.2 percent-string stop positions', () => {
    // 2.0.2 emits gsLst pos as `c/1e3 + "%"` → string like "50%". The old
    // Number("50%") = NaN collapsed every stop to offset 0 (solid color).
    const fill = {
      value: {
        rot: 0,
        colors: [
          { pos: '0%', color: '#ffffff' },
          { pos: '50%', color: '#888888' },
          { pos: '100%', color: '#000000' },
        ],
      },
    }
    expect(normalizeGradientStops(fill).map((s) => s.offset)).toEqual([0, 0.5, 1])
  })

  it('accepts numeric, fractional, and percent-string stop positions equivalently', () => {
    const make = (pos) => normalizeGradientStops({ colors: [{ pos: 0, color: '#000' }, { pos, color: '#fff' }] })[1].offset
    expect(make('50%')).toBe(0.5)
    expect(make(50)).toBe(0.5)
    expect(make(0.5)).toBe(0.5)
  })

  it('distributes stops evenly when positions are missing or empty', () => {
    // 2.0.2 emits pos:"" when the source omits it; fall back to even spread.
    const fill = { colors: [{ pos: '', color: '#000' }, { pos: '', color: '#888' }, { pos: '', color: '#fff' }] }
    expect(normalizeGradientStops(fill).map((s) => s.offset)).toEqual([0, 0.5, 1])
  })

  it('converts OOXML gradient angles to CSS at the agreed and chosen anchors', () => {
    const css = (rot) => gradientBackground({ value: { rot, colors: [{ pos: '0%', color: '#000' }, { pos: '100%', color: '#fff' }] } }).angle
    // Agreed anchors (both candidate formulas concur):
    expect(css(0)).toBe(90)
    expect(css(180)).toBe(270)
    // Divergent anchors — pinned to the chosen (θ+90) direction-vector mapping:
    expect(css(90)).toBe(180)
    expect(css(270)).toBe(0)
  })

  it('escapes SVG attributes and normalizes arrow markers', () => {
    expect(svgAttr('<path d="a&b">')).toBe('&lt;path d=&quot;a&amp;b&quot;&gt;')
    expect(arrowMarker('triangle')).toBe('arrow')
    expect(arrowMarker('oval')).toBe('circle')
    expect(arrowMarker('diamond')).toBe('diamond')
    expect(arrowMarker('none')).toBe('none')
  })
})
