import { describe, expect, it } from 'vitest'
import {
  advanceAnimationPreviewStep,
  buildAnimationPreviewPresentation,
  getAnimationPreviewSteps,
  rewindAnimationPreviewStep,
} from './animation-preview-helpers'

describe('animation preview helpers', () => {
  it('maps preview steps from unique sorted fragment indices', () => {
    const slide = {
      id: 'slide-1',
      elements: [
        { id: 'a', fragment: false },
        { id: 'b', fragment: true, fragmentIndex: 3 },
        { id: 'c', fragment: true, fragmentIndex: 1 },
        { id: 'd', fragment: true, fragmentIndex: 3 },
      ],
    }

    expect(getAnimationPreviewSteps(slide)).toEqual([0, 1, 3])
  })

  it('keeps authored sparse labels while omitting hidden fragments and grouping shared orders', () => {
    const slide = {
      elements: [
        { id: 'hidden', hidden: true, fragment: true, fragmentIndex: 1 },
        { id: 'later-a', fragment: true, fragmentIndex: 5 },
        { id: 'first', fragment: true, fragmentIndex: 2 },
        { id: 'later-b', fragment: true, fragmentIndex: 5 },
      ],
    }

    expect(getAnimationPreviewSteps(slide)).toEqual([0, 2, 5])
  })

  it('includes effective master groups after applying hidden-element overrides and patches', () => {
    const element = (id, fragmentIndex, hidden = false) => ({
      id,
      type: 'shape',
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      fragment: true,
      fragmentIndex,
      hidden,
    })
    const masters = [
      {
        id: 'master',
        name: 'Master',
        placeholders: [],
        fixedElements: [element('hidden', 1, true), element('excluded', 3), element('shown', 4)],
      },
    ]
    const slide = {
      layoutId: 'master',
      elements: [element('owned', 5)],
      layoutOverrides: {
        hiddenElementIds: ['excluded'],
        elementPatches: { shown: { fragmentIndex: 2 } },
      },
    }
    const original = structuredClone({ slide, masters })

    expect(getAnimationPreviewSteps(slide, masters)).toEqual([0, 2, 5])
    expect({ slide, masters }).toEqual(original)
  })

  it('advances and rewinds through sparse preview steps without inventing indices', () => {
    const steps = [0, 1, 3]

    expect(advanceAnimationPreviewStep(steps, 0)).toBe(1)
    expect(advanceAnimationPreviewStep(steps, 1)).toBe(2)
    expect(advanceAnimationPreviewStep(steps, 2)).toBe(2)

    expect(rewindAnimationPreviewStep(steps, 2)).toBe(1)
    expect(rewindAnimationPreviewStep(steps, 1)).toBe(0)
    expect(rewindAnimationPreviewStep(steps, 0)).toBe(0)
  })

  it('builds a preview presentation with only the active slide', () => {
    const presentation = {
      id: 'pres-1',
      title: 'Quarterly Review',
      theme: 'night',
      resolution: { width: 1280, height: 720 },
      presenterTools: { slideMenu: true, chalkboard: true },
      slides: [
        { id: 'slide-a', elements: [{ id: 'a', type: 'text', content: '<p>First</p>' }] },
        {
          id: 'slide-b',
          elements: [{ id: 'b', type: 'text', content: '<p>Second</p>' }],
          children: [{ id: 'child-1', elements: [] }],
        },
      ],
    }

    expect(buildAnimationPreviewPresentation(presentation, 1)).toEqual({
      ...presentation,
      presenterTools: null,
      slides: [
        {
          id: 'slide-b',
          elements: [{ id: 'b', type: 'text', content: '<p>Second</p>' }],
          children: [],
        },
      ],
    })
  })
})
