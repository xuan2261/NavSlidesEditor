import { describe, expect, it } from 'vitest'
import baseUtils from './utils-base.js'

const { baseElement, extractShadow, placeholder, scaleLength, shapeName, warning } = baseUtils

describe('pptx mapper base utilities', () => {
  it('maps base element geometry, rotation, opacity, and z-index', () => {
    const element = baseElement(
      { left: 10, top: 20, width: 30, height: 40, rotate: 15, opacity: 0.5 },
      { x: 2, y: 3 },
      7
    )
    expect(element).toMatchObject({
      x: 20,
      y: 60,
      width: 60,
      height: 120,
      rotation: 15,
      opacity: 0.5,
      zIndex: 7,
    })
    expect(element.id).toMatch(/[0-9a-f-]{36}/)
  })

  it('normalizes common PPTX shape names', () => {
    expect(shapeName('ellipse')).toBe('circle')
    expect(shapeName('rightTriangle')).toBe('triangle')
    expect(shapeName('straightConnector1')).toBe('line')
    expect(shapeName('roundedRect')).toBe('rounded-rect')
    expect(shapeName('star5')).toBe('star')
    expect(shapeName('unknown')).toBe('rect')
  })

  it('extracts shadows and creates locked placeholders with warnings', () => {
    // 72-DPI canvas: pt → px at scale 1 is identity (no 96/72 inflation).
    expect(extractShadow({ shadow: { h: 1, v: 2, blur: 3, color: '#111111' } })).toEqual({
      shadowX: 1,
      shadowY: 2,
      shadowBlur: 3,
      shadowColor: '#111111',
    })

    const warnings = []
    warning(warnings, 0, 'manual', 'Manual warning')
    const el = placeholder({ left: 1, top: 2, width: 3, height: 4 }, { x: 1, y: 1 }, 2, 1, warnings, 'missing', 'Missing')
    expect(warnings).toEqual([
      { slideIndex: 0, type: 'manual', message: 'Manual warning' },
      { slideIndex: 1, type: 'missing', message: 'Missing' },
    ])
    expect(el).toMatchObject({ type: 'shape', locked: true, importPlaceholderType: 'missing', text: 'Missing' })
  })

  it('scales point lengths by their box axis without 96-DPI inflation', () => {
    // Border/shadow lengths follow the box scale (1pt → 1px at scale 1),
    // matching geometry; the old PT_TO_PX factor bloated a 2pt border to 2.7px.
    expect(scaleLength(2, 1)).toBe(2)
    expect(scaleLength(2, 0.5)).toBe(1)
    expect(scaleLength(3, 2)).toBe(6)
    expect(scaleLength(0, 1, 1)).toBe(1)
    expect(scaleLength(undefined, 1.5, 2)).toBe(2)
  })

  it('scales shadow offsets and blur by their axes', () => {
    const result = extractShadow(
      { shadow: { h: 3, v: 3, blur: 6, color: '#000000' } },
      { x: 4 / 3, y: 2 }
    )

    expect(result).toMatchObject({
      shadowX: 4,
      shadowY: 6,
      shadowBlur: 8,
      shadowColor: '#000000',
    })
  })
})
