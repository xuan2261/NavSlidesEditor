import { describe, it, expect } from 'vitest'
import {
  getRotationAngle,
  applyResizeAspectRatio,
  applyResize,
  clampToSlide,
  getRotatedAABB,
  MIN_SIZE,
} from './use-canvas-resize-rotate'

// Element centered at (100, 50): x=0 y=0 w=200 h=100.
const EL = { x: 0, y: 0, width: 200, height: 100 }
// Place the mouse on a ray from center at a known raw angle. The implementation
// computes atan2(dy,dx)*180/π + 90, so raw screen-angle A ⇒ atan2 = (A-90)°.
function mouseAtRawAngle(raw, radius = 100) {
  const cx = EL.x + EL.width / 2
  const cy = EL.y + EL.height / 2
  const t = ((raw - 90) * Math.PI) / 180
  return { mouseX: cx + radius * Math.cos(t), mouseY: cy + radius * Math.sin(t) }
}

describe('[cap:canvas.rotate-snap tier:deep] rotation snapping to 15° increments', () => {
  it('snaps 22° down to nearest 15° (→15)', () => {
    const { mouseX, mouseY } = mouseAtRawAngle(22)
    expect(getRotationAngle(EL, mouseX, mouseY, true)).toBe(15)
  })

  it('snaps 23° up to nearest 15° (→30)', () => {
    const { mouseX, mouseY } = mouseAtRawAngle(23)
    expect(getRotationAngle(EL, mouseX, mouseY, true)).toBe(30)
  })

  it('preserves the free angle when snap is off (22 stays 22)', () => {
    const { mouseX, mouseY } = mouseAtRawAngle(22)
    expect(getRotationAngle(EL, mouseX, mouseY, false)).toBe(22)
  })

  it('snaps the cardinal "up" direction to 0°, normalized into [0,360)', () => {
    expect(getRotationAngle(EL, 100, -50, true)).toBe(0)
  })

  it('snaps every multiple of 15 to itself across a full turn', () => {
    for (let deg = 0; deg < 360; deg += 15) {
      const { mouseX, mouseY } = mouseAtRawAngle(deg)
      expect(getRotationAngle(EL, mouseX, mouseY, true)).toBe(deg % 360)
    }
  })
})

describe('[cap:canvas.resize-aspect tier:deep] aspect-ratio preserving resize', () => {
  it('locks a 2:1 box to its ratio when width is the dominant delta', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 } // ratio 2
    const updates = applyResize('se', start, 100, 10) // → 300 x 110, width delta dominant
    applyResizeAspectRatio('se', start, updates)
    expect(updates.width).toBe(300)
    expect(updates.height).toBe(150) // 300 / 2
  })

  it('locks to ratio when height is the dominant delta', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 } // ratio 2
    const updates = applyResize('se', start, 10, 100) // → 210 x 200, height delta dominant
    applyResizeAspectRatio('se', start, updates)
    expect(updates.height).toBe(200)
    expect(updates.width).toBe(400) // 200 * 2
  })

  it('repositions the anchor for north/west handles so the opposite corner stays put', () => {
    const start = { x: 100, y: 100, width: 200, height: 100 } // ratio 2
    const updates = applyResize('nw', start, -100, -10) // grows left → 300 wide
    applyResizeAspectRatio('nw', start, updates)
    expect(updates.width).toBe(300)
    expect(updates.height).toBe(150)
    // nw keeps bottom-right fixed: x = startRight - newWidth, y = startBottom - newHeight
    expect(updates.x).toBe(300 - 300) // startEl.x+width(300) - width(300)
    expect(updates.y).toBe(200 - 150) // startEl.y+height(200) - height(150)
  })

  it('does not adjust ratio for edge (non-corner) handles', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 }
    const updates = applyResize('e', start, 80, 0) // → 280 x 100
    applyResizeAspectRatio('e', start, updates)
    expect(updates.width).toBe(280)
    expect(updates.height).toBe(100) // unchanged — free resize on an edge
  })

  it('free resize on an edge does NOT preserve aspect (contrast case)', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 }
    const free = applyResize('e', start, 80, 0)
    expect(free.width / free.height).not.toBeCloseTo(start.width / start.height)
  })

  it('respects MIN_SIZE floor under aspect lock', () => {
    const start = { x: 0, y: 0, width: 200, height: 100 }
    const updates = applyResize('se', start, -190, -10) // collapse width below MIN
    applyResizeAspectRatio('se', start, updates)
    expect(updates.width).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(updates.height).toBeGreaterThanOrEqual(MIN_SIZE)
  })
})

describe('[cap:canvas.resize-boundary tier:deep] rotated resize stays inside slide bounds', () => {
  it('shifts a rotated resize result back inside the slide visual bounds', () => {
    const start = { x: 2, y: 100, width: 120, height: 80, rotation: 45 }
    const updates = applyResize('w', start, -80, 0)

    clampToSlide(updates, start, null, 960, 540)

    const box = getRotatedAABB({ ...start, ...updates })
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(960)
    expect(box.bottom).toBeLessThanOrEqual(540)
  })

  it('shrinks an oversized rotated resize result when shifting alone cannot fit it', () => {
    const slideW = 300
    const slideH = 220
    const start = { x: 40, y: 40, width: 200, height: 120, rotation: 45 }
    const updates = applyResize('e', start, 800, 0)

    clampToSlide(updates, start, null, slideW, slideH)

    const box = getRotatedAABB({ ...start, ...updates })
    expect(box.width).toBeLessThanOrEqual(slideW)
    expect(box.height).toBeLessThanOrEqual(slideH)
    expect(box.left).toBeGreaterThanOrEqual(0)
    expect(box.top).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(slideW)
    expect(box.bottom).toBeLessThanOrEqual(slideH)
  })
})
