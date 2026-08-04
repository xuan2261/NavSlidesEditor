import { describe, expect, it } from 'vitest'
import {
  normalizeTransitionDuration,
  normalizeTransitionSpeed,
  resolveEffectiveTransition,
} from '../src/transition-settings.js'
import { generateRevealHTML } from '../src/htmlGenerator.js'

describe('transition settings', () => {
  it('uses the destination slide override, including none', () => {
    expect(resolveEffectiveTransition({
      presentation: { transition: 'fade', transitionSpeed: 'fast' },
      currentSlide: { transition: 'zoom' },
      nextSlide: { transition: 'none', transitionDirection: 'left', transitionDuration: 12000 },
    })).toMatchObject({
      transition: 'none',
      direction: 'left',
      duration: 10000,
      speed: 'fast',
    })
  })

  it('falls back to the presentation transition and then slide', () => {
    expect(resolveEffectiveTransition({ presentation: { transition: 'convex' }, nextSlide: {} }).transition)
      .toBe('convex')
    expect(resolveEffectiveTransition({ presentation: {}, nextSlide: {} }).transition).toBe('slide')
    expect(resolveEffectiveTransition({ presentation: { transition: 'invalid' }, nextSlide: {} }).transition)
      .toBe('slide')
  })

  it('clamps durations and rejects invalid speeds', () => {
    expect(normalizeTransitionDuration(-2)).toBe(0)
    expect(normalizeTransitionDuration(20000)).toBe(10000)
    expect(normalizeTransitionDuration('')).toBeNull()
    expect(normalizeTransitionSpeed('fast')).toBe('fast')
    expect(normalizeTransitionSpeed('unsafe')).toBe('default')
  })

  it('emits a validated transition speed in Reveal configuration', () => {
    const html = generateRevealHTML({
      transition: 'fade',
      transitionSpeed: 'slow',
      slides: [{ elements: [] }, { transition: 'slide', transitionDirection: 'right', transitionDuration: 800, elements: [] }],
    })
    expect(html).toContain("transitionSpeed: 'slow'")
    expect(html).toContain('data-transition-direction="right"')
    expect(html).toContain('data-transition-duration="800"')
    expect(generateRevealHTML({ transitionSpeed: 'not-valid', slides: [{ elements: [] }] }))
      .toContain("transitionSpeed: 'default'")
  })
})
