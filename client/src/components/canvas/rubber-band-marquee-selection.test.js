import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import useCanvasRubberBandSelection from './use-canvas-rubber-band-drag-selection'

// Unit coverage for the marquee selection invariant that the Playwright spec
// cannot drive reliably (synthetic pointer drag is flaky in headless Chromium,
// per the Stream B coverage note). The behavior under test — a marquee skips
// hidden + locked elements and hits visible ones by their rotated AABB — lives
// in endRubberBand and is exercised here directly.
function setup(elements) {
  const onToggleSelectElement = vi.fn()
  const slide = { elements }
  const { result } = renderHook(() =>
    useCanvasRubberBandSelection({ slide, onToggleSelectElement })
  )
  return { ...result.current, onToggleSelectElement }
}

function dragOver(api, x1, y1, x2, y2) {
  api.startRubberBand(x1, y1)
  api.updateRubberBand(x2, y2)
  return api.endRubberBand(() => {})
}

describe('rubber-band marquee selection', () => {
  const visA = { id: 'vis-a', x: 100, y: 100, width: 120, height: 80 }
  const visB = { id: 'vis-b', x: 300, y: 100, width: 120, height: 80 }
  const locked = { id: 'locked', x: 480, y: 100, width: 120, height: 80, locked: true }
  const hidden = { id: 'hidden', x: 100, y: 260, width: 120, height: 80, hidden: true }

  it('selects visible+unlocked elements within the marquee box', () => {
    const api = setup([visA, visB])
    const hits = dragOver(api, 20, 30, 640, 380)
    expect(hits.sort()).toEqual(['vis-a', 'vis-b'])
  })

  it('excludes hidden and locked elements even when geometrically inside', () => {
    const api = setup([visA, visB, locked, hidden])
    const hits = dragOver(api, 20, 30, 640, 380)
    expect(hits).not.toContain('locked')
    expect(hits).not.toContain('hidden')
    expect(hits.sort()).toEqual(['vis-a', 'vis-b'])
  })

  it('ignores elements outside the marquee box', () => {
    const api = setup([visA, visB])
    // A small box around vis-a only.
    const hits = dragOver(api, 90, 90, 230, 190)
    expect(hits).toEqual(['vis-a'])
  })

  it('treats a click-sized (<=4px) drag as no selection', () => {
    const api = setup([visA])
    const hits = dragOver(api, 100, 100, 103, 103)
    expect(hits).toEqual([])
  })

  it('applyRubberBandSelection clears then adds each hit (additive after reset)', () => {
    const api = setup([visA, visB])
    api.applyRubberBandSelection(['vis-a', 'vis-b'])
    // first call clears (null,false), then each id added (id,true)
    expect(api.onToggleSelectElement.mock.calls[0]).toEqual([null, false])
    expect(api.onToggleSelectElement.mock.calls).toContainEqual(['vis-a', true])
    expect(api.onToggleSelectElement.mock.calls).toContainEqual(['vis-b', true])
  })

  it('applyRubberBandSelection is a no-op when nothing was hit', () => {
    const api = setup([visA])
    api.applyRubberBandSelection([])
    expect(api.onToggleSelectElement).not.toHaveBeenCalled()
  })
})
