import { describe, it, expect } from 'vitest'
import { applyResize, MIN_SIZE } from './use-canvas-resize-rotate'

// Smoke floor for canvas resize geometry — exercises the real applyResize box
// math. (canvas.move has no pure seam today: drag-delta is applied inside the
// pointer-interaction hook with no testable export, so it is routed to the
// Phase 6 allowlist rather than covered by a tautological test.)
describe('canvas resize op smoke floor', () => {
  it('[cap:canvas.resize] dragging the SE handle grows width and height', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 }
    const out = applyResize('se', start, 50, 30)
    expect(out.width).toBe(250)
    expect(out.height).toBe(130)
    expect(out.x).toBe(0) // SE keeps the top-left anchor fixed
    expect(out.y).toBe(0)
  })

  it('[cap:canvas.resize] dragging the NW handle moves the anchor and resizes', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 }
    const out = applyResize('nw', start, 20, 10)
    expect(out.x).toBe(120)
    expect(out.y).toBe(110)
    expect(out.width).toBe(180)
    expect(out.height).toBe(90)
  })

  it('[cap:canvas.resize] resizing never shrinks below MIN_SIZE', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 }
    const out = applyResize('se', start, -500, -500)
    expect(out.width).toBe(MIN_SIZE)
    expect(out.height).toBe(MIN_SIZE)
  })
})
