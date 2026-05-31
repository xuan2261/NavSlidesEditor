import { describe, it, expect } from 'vitest'
import { applyResize, MIN_SIZE } from './use-canvas-resize-rotate'
import { applyMove, applyMoveBatch } from './use-canvas-pointer-interaction'

// Smoke floor for canvas geometry — exercises the real helper math used by
// pointer interactions.
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

describe('canvas move op smoke floor', () => {
  it('[cap:canvas.move] applies drag delta and preserves unrelated element fields', () => {
    const start = { id: 'shape-1', type: 'shape', x: 100, y: 120, width: 200, height: 100 }
    const out = { ...start, ...applyMove(start, 40, -20, 960, 540) }

    expect(out).toEqual({
      id: 'shape-1',
      type: 'shape',
      x: 140,
      y: 100,
      width: 200,
      height: 100,
    })
  })

  it('[cap:canvas.lock] keeps locked elements out of batch move updates', () => {
    const selected = [
      { id: 'free', x: 10, y: 10, width: 100, height: 80 },
      { id: 'locked', locked: true, x: 200, y: 200, width: 100, height: 80 },
    ]
    const movable = selected.filter((element) => !element.locked)

    expect(applyMoveBatch(movable, 30, 25, 960, 540)).toEqual([{ id: 'free', x: 40, y: 35 }])
  })
})
