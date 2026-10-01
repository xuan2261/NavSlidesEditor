import { describe, expect, it } from 'vitest'
import { applyGroupResize, applyGroupRotate, getGroupBounds } from './canvas-group-transform-geometry'
import { applyResize, getRotatedAABB, MIN_SIZE } from './use-canvas-resize-rotate'

describe('group transform boundaries', () => {
  it('limits one shared resize scale when a sibling reaches the slide edge', () => {
    const elements = [
      { id: 'a', x: 40, y: 200, width: 120, height: 80, rotation: 0 },
      { id: 'b', x: 820, y: 200, width: 120, height: 80, rotation: 0 },
    ]
    const batch = applyGroupResize(elements, elements[0], applyResize('e', elements[0], 100, 0), 960, 540)
    const [a, b] = batch
    expect(a.x).toBeCloseTo(40)
    expect(b.x + b.width).toBeCloseTo(960)
    expect(a.width / elements[0].width).toBeCloseTo(b.width / elements[1].width)
    expect((b.x - a.x) / (elements[1].x - elements[0].x)).toBeCloseTo(a.width / elements[0].width)
    expect(a.height).toBe(80)
    expect(b.height).toBe(80)
  })

  it('stops shrinking the whole group when its smallest member reaches MIN_SIZE', () => {
    const elements = [
      { id: 'a', x: 100, y: 100, width: 200, height: 100, rotation: 0 },
      { id: 'b', x: 400, y: 100, width: 100, height: 80, rotation: 0 },
    ]
    const [a, b] = applyGroupResize(elements, elements[0], applyResize('se', elements[0], -180, -60), 960, 540)
    expect(b.width).toBeCloseTo(MIN_SIZE)
    expect(a.width).toBeCloseTo(80)
    expect(a.width / 200).toBeCloseTo(b.width / 100)
    expect(a.height / 100).toBeCloseTo(b.height / 80)
    expect(b.height).toBeGreaterThanOrEqual(MIN_SIZE)
  })

  it('limits group rotation at the visual boundary without changing distances or the common center', () => {
    const elements = [
      { id: 'a', x: 40, y: 40, width: 100, height: 80, rotation: 0 },
      { id: 'b', x: 260, y: 40, width: 100, height: 80, rotation: 0 },
    ]
    const batch = applyGroupRotate(elements, getGroupBounds(elements), 90, 960, 540)
    const transformed = elements.map((element, index) => ({ ...element, ...batch[index] }))
    const [a, b] = transformed
    expect(a.rotation).toBeGreaterThan(0)
    expect(a.rotation).toBeLessThan(90)
    expect(b.rotation).toBeCloseTo(a.rotation)
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(220)
    expect((a.x + b.x) / 2 + 50).toBeCloseTo(200)
    expect((a.y + b.y) / 2 + 40).toBeCloseTo(80)
    for (const element of transformed) {
      const box = getRotatedAABB(element)
      expect(box.top).toBeGreaterThanOrEqual(-1e-9)
      expect(box.left).toBeGreaterThanOrEqual(-1e-9)
      expect(box.right).toBeLessThanOrEqual(960 + 1e-9)
      expect(box.bottom).toBeLessThanOrEqual(540 + 1e-9)
    }
  })
})
