import { describe, expect, it } from 'vitest'
import fixture from './pptxtojson-2.0.2-output.fixture.js'

/**
 * Convention-drift guard.
 *
 * Pins the exact output shape of pptxtojson@2.0.2 so a future lib bump that
 * silently changes conventions (numeric gradient pos, raw 100000-scale filters,
 * px-instead-of-pt font, dropped chart grouping) breaks loudly here rather than
 * producing wrong-but-green mapper results.
 *
 * Verified against node_modules/pptxtojson/dist/index.js:
 *   - gradient stop  pos: c/1e3 + "%"   → string like "50%"
 *   - gradient angle rot: Math.round(ang/6e4) → integer OOXML degrees
 *   - filters bright/contrast/sat: parseInt(attr)/1e5 → fraction (not raw 100000)
 *   - lengths via Ru = 72/914400 (EMU→pt); line width /12700 (pt) → 2.x is pt-based
 *   - chart grouping: c:grouping/@val → e.g. 'stacked'
 */
describe('pptxtojson@2.0.2 output convention drift guard', () => {
  it('emits gradient stop positions as percent strings', () => {
    const stops = fixture.gradientShapeElement.fill.value.colors
    expect(stops.length).toBeGreaterThanOrEqual(2)
    for (const stop of stops) {
      expect(typeof stop.pos).toBe('string')
      expect(stop.pos).toMatch(/^\d+(\.\d+)?%$/)
    }
  })

  it('emits gradient angle as an integer OOXML degree (not 60000ths)', () => {
    const rot = fixture.gradientShapeElement.fill.value.rot
    expect(Number.isInteger(rot)).toBe(true)
    expect(rot).toBeGreaterThanOrEqual(0)
    expect(rot).toBeLessThan(360)
  })

  it('emits image filters as fractions, not raw 100000-scale values', () => {
    const f = fixture.imageElement.filters
    for (const key of ['brightness', 'contrast', 'saturation']) {
      expect(Number.isFinite(f[key])).toBe(true)
      // raw 0.x convention would be ~20000; a fraction is |v| <= ~2.
      expect(Math.abs(f[key])).toBeLessThanOrEqual(2)
    }
    // saturation is a multiplier with neutral 1.0 (a14:saturation/@sat / 1e5).
    expect(f.saturation).toBeGreaterThan(0)
  })

  it('emits font sizes in points (small integers), not 96-DPI px', () => {
    expect(fixture.textElement.fontSize).toBe(18)
    const cellFont = fixture.tableElement.data[0][0].fontSize
    expect(cellFont).toBe(18)
  })

  it('preserves chart grouping intent and a bar chart type', () => {
    expect(fixture.stackedChartElement.grouping).toBe('stacked')
    expect(String(fixture.stackedChartElement.chartType).toLowerCase()).toContain('bar')
    expect(fixture.areaChartElement.grouping).toBe('standard')
    expect(String(fixture.areaChartElement.chartType).toLowerCase()).toContain('area')
  })

  it('describes a rotated group whose children carry no extra rotation', () => {
    const group = fixture.rotatedGroupElement
    expect(group.rotate).not.toBe(0)
    const shapeChild = group.elements.find((el) => el.type === 'shape')
    const lineChild = group.elements.find((el) => el.x1 != null && el.y1 != null)
    expect(shapeChild.rotate).toBe(0)
    expect(lineChild.rotate ?? 0).toBe(0)
    expect(lineChild.x2).not.toBe(undefined)
  })

  it('describes an EMF image via an in-memory ref, not a network URL', () => {
    const emf = fixture.emfImageElement
    expect(emf.type).toBe('image')
    expect(String(emf.ref || emf.target || '').toLowerCase()).toMatch(/\.emf$/)
    expect(String(emf.ref || emf.target || '')).not.toMatch(/^https?:/i)
  })
})
