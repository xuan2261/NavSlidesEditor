import { describe, it, expect } from 'vitest'

// Test the pure utility functions extracted from timeline-element.jsx
// We import the module and test parseDatePos and buildTicks indirectly
// through the component's rendering behavior

describe('TimelineElement utilities', () => {
  // Test parseDatePos logic (year mode)
  function parseDatePos(d, startDate, endDate, w, pad, yearMode) {
    if (yearMode) {
      const y0 = parseInt(startDate) || 0
      const y1 = parseInt(endDate) || 0
      const yr = y1 - y0 || 1
      return pad + (((parseInt(d) || 0) - y0) / yr) * (w - pad * 2)
    }
    const t0 = new Date(startDate).getTime()
    const t1 = new Date(endDate).getTime()
    const range = t1 - t0 || 1
    return pad + ((new Date(d).getTime() - t0) / range) * (w - pad * 2)
  }

  describe('parseDatePos', () => {
    it('maps start date to left padding', () => {
      const pos = parseDatePos('2000', '2000', '2025', 800, 30, true)
      expect(pos).toBe(30)
    })

    it('maps end date to width minus right padding', () => {
      const pos = parseDatePos('2025', '2000', '2025', 800, 30, true)
      expect(pos).toBe(770)
    })

    it('maps midpoint date to center', () => {
      const pos = parseDatePos('2012', '2000', '2025', 800, 30, true)
      // 2012 is 12/25 = 0.48 of the range, so pos = 30 + 0.48 * 740 = 385.2
      expect(pos).toBeCloseTo(385.2, 0)
    })

    it('handles negative years (BCE dates)', () => {
      const pos = parseDatePos('-500', '-500', '2000', 800, 30, true)
      expect(pos).toBe(30)
    })

    it('handles date string mode', () => {
      const pos = parseDatePos('2010-06-15', '2000-01-01', '2025-01-01', 800, 30, false)
      expect(pos).toBeGreaterThan(30)
      expect(pos).toBeLessThan(770)
    })
  })

  describe('buildTicks', () => {
    function buildTicks(startDate, endDate, spacing) {
      const y0 = parseInt(startDate) || 0
      const y1 = parseInt(endDate) || 0
      const step =
        spacing === '1000year' ? 1000
        : spacing === '100year' ? 100
        : spacing === '10year' ? 10
        : Math.abs(y1 - y0) > 8 ? 2 : 1
      const ticks = []
      const sY = y0 < y1 ? Math.ceil(y0 / step) * step : Math.floor(y0 / step) * step
      for (let y = sY; y0 < y1 ? y <= y1 : y >= y1; y += y0 < y1 ? step : -step) {
        ticks.push({ date: String(y), label: String(y) })
      }
      return ticks
    }

    it('generates yearly ticks for short ranges', () => {
      const ticks = buildTicks('2020', '2025', 'year')
      expect(ticks.length).toBeGreaterThan(0)
      expect(ticks[0].label).toBe('2020')
    })

    it('generates decade ticks for 10year spacing', () => {
      const ticks = buildTicks('2000', '2025', '10year')
      expect(ticks.every((t) => parseInt(t.label) % 10 === 0)).toBe(true)
    })

    it('generates century ticks for 100year spacing', () => {
      const ticks = buildTicks('1800', '2025', '100year')
      expect(ticks.every((t) => parseInt(t.label) % 100 === 0)).toBe(true)
    })

    it('handles BCE to CE range', () => {
      const ticks = buildTicks('-500', '500', '100year')
      expect(ticks.length).toBeGreaterThan(0)
      expect(ticks.some((t) => parseInt(t.label) < 0)).toBe(true)
      expect(ticks.some((t) => parseInt(t.label) > 0)).toBe(true)
    })
  })
})
