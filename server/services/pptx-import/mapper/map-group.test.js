import { describe, expect, it } from 'vitest'
import groupMapper from './map-group.js'
import geometry from '../geometry.js'

const { flattenGroupElement } = groupMapper
const { applyToPoint, rotateAround } = geometry

function context() {
  return {
    scale: { x: 1, y: 1 },
    zIndex: 7,
    slideIndex: 0,
    warnings: [],
    stats: { shapeCount: 0 },
  }
}

// Echoes the group-transformed child geometry so tests can assert on the exact
// box/rotation the mapper hands downstream (the wrapper rotates around center).
const echoChild = async (child, childContext) => [{
  type: child.type,
  left: child.left,
  top: child.top,
  width: child.width,
  height: child.height,
  rotate: child.rotate,
  ...(child.x1 != null ? { x1: child.x1, y1: child.y1, x2: child.x2, y2: child.y2 } : {}),
  zIndex: childContext.zIndex,
}]

describe('pptx group mapper', () => {
  it('flattens children with parent offsets and shared context', async () => {
    const ctx = context()
    const group = {
      type: 'group',
      left: 10,
      top: 20,
      width: 100,
      height: 80,
      elements: [{ type: 'shape', left: 5, top: 6, width: 30, height: 20 }],
    }

    const result = await flattenGroupElement(group, ctx, async (child, childContext) => {
      childContext.stats.shapeCount += 1
      return [{ type: child.type, x: child.left, y: child.top, zIndex: childContext.zIndex }]
    })

    expect(result).toEqual([{ type: 'shape', x: 15, y: 26, zIndex: 7 }])
    expect(ctx.stats.shapeCount).toBe(1)
    expect(ctx.zIndex).toBe(7)
  })

  it('locks groups that exceed the depth limit', async () => {
    const ctx = context()
    const result = await flattenGroupElement({ type: 'group', elements: [] }, ctx, async () => [], 11)

    expect(result[0].importPlaceholderType).toBe('grouped-complex')
    expect(ctx.warnings[0]).toMatchObject({ type: 'group-depth-exceeded' })
  })

  it('preserves a grouped shape size and rotates it once about its rotated center', async () => {
    const group = {
      type: 'group',
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      rotate: 30,
      elements: [{ type: 'shape', shapType: 'rect', left: 0, top: 0, width: 100, height: 100, rotate: 0 }],
    }
    const [child] = await flattenGroupElement(group, context(), echoChild)

    // Intrinsic size preserved — NOT the rotated AABB (~136.6) the old code emitted.
    expect(child.width).toBeCloseTo(100, 3)
    expect(child.height).toBeCloseTo(100, 3)
    // Center sits at the group-rotated position of the child's local center.
    const expected = applyToPoint(rotateAround(30, 100, 100), 50, 50)
    expect(child.left + child.width / 2).toBeCloseTo(expected.x, 3)
    expect(child.top + child.height / 2).toBeCloseTo(expected.y, 3)
    // Rotation applied exactly once by the wrapper (not doubled to 60).
    expect(child.rotate).toBe(30)
  })

  it('accumulates nested group rotation once per level for shapes', async () => {
    const group = {
      type: 'group',
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      rotate: 30,
      elements: [{
        type: 'group',
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        rotate: 15,
        elements: [{ type: 'shape', shapType: 'rect', left: 0, top: 0, width: 100, height: 100, rotate: 0 }],
      }],
    }
    const [child] = await flattenGroupElement(group, context(), echoChild)

    expect(child.rotate).toBe(45)
    expect(child.width).toBeCloseTo(100, 3)
    expect(child.height).toBeCloseTo(100, 3)
  })

  it('places a grouped line by transformed endpoints without re-rotating it', async () => {
    const group = {
      type: 'group',
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      rotate: 30,
      elements: [{ type: 'shape', shapType: 'line', left: 0, top: 0, width: 200, height: 1, x1: 0, y1: 0, x2: 200, y2: 0, rotate: 0 }],
    }
    const [line] = await flattenGroupElement(group, context(), echoChild)

    const gm = rotateAround(30, 100, 100)
    const p1 = applyToPoint(gm, 0, 0)
    const p2 = applyToPoint(gm, 200, 0)
    expect(line.x1).toBeCloseTo(p1.x, 3)
    expect(line.y1).toBeCloseTo(p1.y, 3)
    expect(line.x2).toBeCloseTo(p2.x, 3)
    expect(line.y2).toBeCloseTo(p2.y, 3)
    // Endpoints already carry the group rotation; the wrapper must not re-rotate.
    expect(line.rotate).toBe(0)
  })

  it('does not double-apply inherited rotation to a nested grouped line', async () => {
    const group = {
      type: 'group',
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      rotate: 30,
      elements: [{
        type: 'group',
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        rotate: 15,
        elements: [{ type: 'shape', shapType: 'line', left: 0, top: 0, width: 200, height: 1, x1: 0, y1: 0, x2: 200, y2: 0, rotate: 0 }],
      }],
    }
    const [line] = await flattenGroupElement(group, context(), echoChild)

    // The accumulated 45° lives in the endpoints, not the element rotation.
    expect(line.rotate).toBe(0)
  })

  it('preserves a grouped line own rotation while group rotation stays in endpoints', async () => {
    const group = {
      type: 'group',
      left: 0,
      top: 0,
      width: 200,
      height: 200,
      rotate: 30,
      elements: [{ type: 'shape', shapType: 'line', left: 0, top: 0, width: 200, height: 1, x1: 0, y1: 0, x2: 200, y2: 0, rotate: 10 }],
    }
    const [line] = await flattenGroupElement(group, context(), echoChild)

    expect(line.rotate).toBe(10)
  })

  it('leaves child box and position unchanged for a non-rotated group (identity)', async () => {
    const group = {
      type: 'group',
      left: 30,
      top: 40,
      width: 240,
      height: 140,
      rotate: 0,
      elements: [{ type: 'shape', shapType: 'rect', left: 10, top: 10, width: 40, height: 40, rotate: 0 }],
    }
    const [child] = await flattenGroupElement(group, context(), echoChild)

    expect(child.left).toBeCloseTo(40, 3)
    expect(child.top).toBeCloseTo(50, 3)
    expect(child.width).toBeCloseTo(40, 3)
    expect(child.height).toBeCloseTo(40, 3)
    expect(child.rotate).toBe(0)
  })
})
