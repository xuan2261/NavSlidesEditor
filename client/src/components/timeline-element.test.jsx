import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimelineExpandedDetails } from './timeline-expanded-details'
import { buildTicks, getTimelineItems, getTimelineRange, parseDatePos } from './timeline-element-utils'

// Test the pure utility functions extracted from timeline-element.jsx
// We import the module and test parseDatePos and buildTicks indirectly
// through the component's rendering behavior

describe('TimelineElement utilities', () => {
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

  describe('getTimelineRange', () => {
    it('prefers plan schema range fields', () => {
      expect(getTimelineRange({ timelineStart: '1990', timelineEnd: '2020' })).toEqual({
        startDate: '1990',
        endDate: '2020',
      })
    })

    it('falls back to legacy range fields and defaults', () => {
      expect(getTimelineRange({ startDate: '2001', endDate: '2010' })).toEqual({
        startDate: '2001',
        endDate: '2010',
      })
      expect(getTimelineRange({})).toEqual({ startDate: '2000', endDate: '2025' })
    })
  })

  describe('getTimelineItems', () => {
    it('normalizes plan and legacy event fields', () => {
      const items = getTimelineItems({
        connectorOffset: 12,
        events: [
          {
            id: 'evt-1',
            title: 'Launch',
            imageUrl: '/uploads/a.png',
            details: 'Long detail',
            date: '2010',
          },
        ],
      })

      expect(items[0]).toMatchObject({
        id: 'evt-1',
        label: 'Launch',
        image: '/uploads/a.png',
        detailedDescription: 'Long detail',
        connectorLength: 12,
      })
    })
  })
})

describe('TimelineExpandedDetails', () => {
  it('renders expanded details and closes on click', () => {
    const onClose = vi.fn()
    render(
      <TimelineExpandedDetails
        item={{ label: 'Launch', date: '2010', description: 'Short', detailedDescription: 'Long detail' }}
        textColor="#fff"
        fontSize={12}
        dateLabel={(date) => `Year ${date}`}
        onClose={onClose}
      />
    )

    expect(screen.getByText('Launch')).toBeTruthy()
    expect(screen.getByText('Year 2010')).toBeTruthy()
    expect(screen.getByText('Long detail')).toBeTruthy()
    fireEvent.click(screen.getByTestId('timeline-expanded'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
