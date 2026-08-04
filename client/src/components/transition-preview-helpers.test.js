import { describe, expect, it } from 'vitest'
import {
  buildTransitionPreviewHtml,
  buildTransitionPreviewPresentation,
  resolveTransitionPreviewSlides,
} from './transition-preview-helpers'

describe('transition preview helpers', () => {
  const presentation = {
    id: 'preview-deck',
    theme: 'black',
    transition: 'fade',
    transitionSpeed: 'fast',
    resolution: { width: 1280, height: 720 },
    slides: [],
  }
  const currentSlide = { elements: [] }
  const nextSlide = {
    transition: 'none',
    transitionDirection: 'left',
    transitionDuration: 900,
    elements: [],
  }

  it('builds a two-slide deck with effective destination settings', () => {
    const preview = buildTransitionPreviewPresentation({
      presentation,
      currentSlide,
      nextSlide,
    })

    expect(preview).toMatchObject({
      autoSlide: 0,
      transition: 'none',
      transitionSpeed: 'fast',
      resolution: { width: 1280, height: 720 },
    })
    expect(preview.slides[1]).toMatchObject({
      transition: 'none',
      transitionDirection: 'left',
      transitionDuration: 900,
    })
  })

  it('resolves parent, child, and horizontal Reveal-next targets', () => {
    const parent = { id: 'parent', elements: [] }
    const childA = { id: 'child-a', elements: [] }
    const childB = { id: 'child-b', elements: [] }
    const next = { id: 'next', elements: [] }
    const deck = { slides: [{ ...parent, children: [childA, childB] }, next] }

    expect(resolveTransitionPreviewSlides({
      presentation: deck,
      currentSlideIndex: 0,
    })).toMatchObject({
      currentSlide: parent,
      nextSlide: childA,
      currentAddress: '1',
      nextAddress: '1.1',
    })
    expect(resolveTransitionPreviewSlides({
      presentation: deck,
      currentSlideIndex: 0,
      verticalEdit: { parentId: 'parent', child: 0 },
    })).toMatchObject({
      currentSlide: childA,
      nextSlide: childB,
      currentAddress: '1.1',
      nextAddress: '1.2',
    })
    expect(resolveTransitionPreviewSlides({
      presentation: deck,
      currentSlideIndex: 0,
      verticalEdit: { parentId: 'parent', child: 1 },
    })).toMatchObject({
      currentSlide: childB,
      nextSlide: next,
      currentAddress: '1.2',
      nextAddress: '2',
    })
  })

  it('flattens vertical stacks so the destination override controls replay', () => {
    const parent = { id: 'parent', elements: [], children: [{ id: 'child', elements: [] }] }
    const preview = buildTransitionPreviewPresentation({
      presentation: { transition: 'slide', slides: [] },
      currentSlide: parent,
      nextSlide: parent.children[0],
      transitionOverride: 'zoom',
    })

    expect(preview.slides[0]).not.toHaveProperty('children')
    expect(preview.slides[1]).toMatchObject({ id: 'child', transition: 'zoom' })
  })

  it('uses local Reveal assets and appends a deterministic replay hook', () => {
    const { html } = buildTransitionPreviewHtml({
      presentation,
      currentSlide,
      nextSlide,
    })

    expect(html).toContain('/vendor/reveal.js/dist/reveal.css')
    expect(html).toContain('/vendor/reveal.js/dist/reveal.js')
    expect(html).toContain('Reveal.next()')
    expect(html).not.toContain('cdn.jsdelivr.net/npm/reveal.js')
  })
})
