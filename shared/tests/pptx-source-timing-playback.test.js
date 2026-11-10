import { describe, expect, it } from 'vitest'
import { createSourceTimingPlayback } from '../src/pptx-timing-playback'

const node = (order, trigger, extra = {}) => ({ order, trigger, status: 'ready',
  targetInstanceId: `target${order}`, effect: 'fade-in', delayMs: 0, durationMs: 100, ...extra })

describe('source-bound browser timing schedule', () => {
  it('runs withPrevious concurrently and afterPrevious after the previous completion, not another click', () => {
    const plan = createSourceTimingPlayback([
      node(1, 'onClick', { delayMs: 20, durationMs: 200 }),
      node(2, 'withPrevious', { delayMs: 50, durationMs: 300 }),
      node(3, 'afterPrevious', { delayMs: 10 }),
      node(4, 'onClick'),
    ], 7)
    expect(plan.steps).toEqual([
      { index: 8, events: [
        { targetInstanceId: 'target1', effect: 'fade-in', atMs: 20, durationMs: 200 },
        { targetInstanceId: 'target2', effect: 'fade-in', atMs: 70, durationMs: 300 },
        { targetInstanceId: 'target3', effect: 'fade-in', atMs: 380, durationMs: 100 },
      ] },
      { index: 9, events: [{ targetInstanceId: 'target4', effect: 'fade-in', atMs: 0, durationMs: 100 }] },
    ])
  })
  it('keeps repeated effects on one target separate and derives its entrance initial state once', () => {
    const plan = createSourceTimingPlayback([
      node(1, 'withPrevious', { targetInstanceId: 'shape', effect: 'appear', durationMs: 0 }),
      node(2, 'onClick', { targetInstanceId: 'shape', effect: 'fade-out' }),
      node(3, 'onClick', { targetInstanceId: 'shape' }),
    ])
    expect(plan.initial).toEqual([{ targetInstanceId: 'shape', visible: false, opacity: 0 }])
    expect(plan.steps.map(step => step.index)).toEqual([null, 1, 2])
    expect(plan.steps.map(step => step.events[0].effect)).toEqual(['appear', 'fade-out', 'fade-in'])
  })
  it('retains a removed-target click boundary and its dependency duration without executing that target', () => {
    const plan = createSourceTimingPlayback([
      node(1, 'onClick', { status: 'unresolved', reason: 'missing-target', durationMs: 250 }),
      node(2, 'afterPrevious', { delayMs: 20 }),
    ])
    expect(plan.initial).toEqual([{ targetInstanceId: 'target2', visible: false, opacity: 0 }])
    expect(plan.steps).toEqual([{ index: 1, events: [
      { targetInstanceId: 'target2', effect: 'fade-in', atMs: 270, durationMs: 100 },
    ] }])
  })
  it('measures shared-source sibling delays from one event base and detaches explicitly edited rows', () => {
    const sourceGroupLocator = { path: [0, 1, 0], preconditionHash: 'a'.repeat(64) }
    const plan = createSourceTimingPlayback([
      node(1, 'onClick', { sourceGroupLocator, definitionId: 'timing', delayMs: 50 }),
      node(2, 'withPrevious', { sourceGroupLocator, definitionId: 'timing', groupedWithPrevious: true, delayMs: 70 }),
      node(3, 'withPrevious', { sourceGroupLocator, definitionId: 'timing', groupedWithPrevious: true, delayMs: 30, triggerOverridden: true }),
    ])
    expect(plan.steps).toEqual([{ index: 1, events: [
      { targetInstanceId: 'target1', effect: 'fade-in', atMs: 50, durationMs: 100 },
      { targetInstanceId: 'target2', effect: 'fade-in', atMs: 70, durationMs: 100 },
      { targetInstanceId: 'target3', effect: 'fade-in', atMs: 100, durationMs: 100 },
    ] }])
  })
  it('starts a following afterPrevious group only after every parallel source child completes', () => {
    const sourceGroupLocator = { path: [0, 1, 0], preconditionHash: 'a'.repeat(64) }
    const plan = createSourceTimingPlayback([
      node(1, 'onClick', { sourceGroupLocator, definitionId: 'timing', delayMs: 50, durationMs: 400 }),
      node(2, 'withPrevious', { sourceGroupLocator, definitionId: 'timing', groupedWithPrevious: true, delayMs: 70 }),
      node(3, 'afterPrevious', { delayMs: 20 }),
    ])
    expect(plan.steps[0].events).toEqual([
      { targetInstanceId: 'target1', effect: 'fade-in', atMs: 50, durationMs: 400 },
      { targetInstanceId: 'target2', effect: 'fade-in', atMs: 70, durationMs: 100 },
      { targetInstanceId: 'target3', effect: 'fade-in', atMs: 470, durationMs: 100 },
    ])
  })
})
