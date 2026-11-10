import { describe, expect, it } from 'vitest'
import groupMapper from './map-group.js'

const { flattenGroupElement } = groupMapper
const echo = async (child, ctx) => [{ ...child, zIndex: ctx.zIndex }]
const context = () => ({ scale: { x: 1, y: 1 }, zIndex: 7, slideIndex: 0, warnings: [] })
const image = (props = {}) => ({
  type: 'image', left: 20, top: 10, width: 40, height: 20, rotate: 0, ...props,
})
const group = (props = {}, elements = [image()]) => ({
  type: 'group', left: 100, top: 80, width: 200, height: 100, ...props, elements,
})

// Independent OOXML point transform: translate to the parent, flip about the
// group's center, then rotate. The parser has already scaled child coordinates.
function groupPoint(g, x, y) {
  const dx = (x - g.width / 2) * (g.isFlipH ? -1 : 1)
  const dy = (y - g.height / 2) * (g.isFlipV ? -1 : 1)
  const angle = (g.rotate || 0) * Math.PI / 180
  return {
    x: g.left + g.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: g.top + g.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

function childPoint(child, x, y) {
  const angle = child.rotate * Math.PI / 180
  const dx = x * (child.isFlipH ? -1 : 1)
  const dy = y * (child.isFlipV ? -1 : 1)
  return {
    x: child.left + child.width / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: child.top + child.height / 2 + dx * Math.sin(angle) + dy * Math.cos(angle),
  }
}

describe('pptx group reflection', () => {
  it.each([
    [true, false, 240, 90],
    [false, true, 120, 150],
    [true, true, 240, 150],
  ])('inherits H=%s V=%s in position and image orientation', async (isFlipH, isFlipV, left, top) => {
    const [child] = await flattenGroupElement(group({ isFlipH, isFlipV }), context(), echo)
    expect(child).toMatchObject({ left, top, width: 40, height: 20, isFlipH, isFlipV, rotate: 0 })
  })

  it.each([
    [true, false, true, false, false, false],
    [false, true, false, true, false, false],
    [true, false, false, true, true, true],
    [false, true, true, false, true, true],
  ])('composes group (%s,%s) and child (%s,%s) flips', async (gh, gv, ch, cv, h, v) => {
    const [child] = await flattenGroupElement(
      group({ isFlipH: gh, isFlipV: gv }, [image({ isFlipH: ch, isFlipV: cv })]), context(), echo
    )
    expect(Boolean(child.isFlipH)).toBe(h)
    expect(Boolean(child.isFlipV)).toBe(v)
  })

  it.each(['isFlipH', 'isFlipV'])('cancels nested %s reflections and restores context/order', async (flip) => {
    const ctx = context()
    const nested = group({ left: 0, top: 0, [flip]: true }, [image(), image({ left: 70 })])
    const children = await flattenGroupElement(group({ [flip]: true }, [nested]), ctx, echo)
    expect(children.map(child => child.zIndex)).toEqual([7, 8])
    expect(ctx.zIndex).toBe(7)
    expect(ctx.warnings).toEqual([])
    for (const child of children) {
      expect(Boolean(child.isFlipH)).toBe(false)
      expect(Boolean(child.isFlipV)).toBe(false)
    }
    expect(children[0]).toMatchObject({ left: 120, top: 90, rotate: 0 })
  })

  it.each([
    [true, false, 13], [false, true, 13], [true, true, 61],
  ])('reflects child rotation after group rotation H=%s V=%s', async (isFlipH, isFlipV, rotation) => {
    const original = image({ rotate: 24, isFlipV: true })
    const g = group({ rotate: 37, isFlipH, isFlipV }, [original])
    const [child] = await flattenGroupElement(g, context(), echo)
    expect(child.rotate).toBe(rotation)
    // Asymmetric sample points catch both reflection handedness and R*F order.
    for (const [x, y] of [[-20, -10], [20, -10], [7, 4]]) {
      const local = childPoint(original, x, y)
      const expected = groupPoint(g, local.x, local.y)
      const actual = childPoint(child, x, y)
      expect(actual.x).toBeCloseTo(expected.x, 8)
      expect(actual.y).toBeCloseTo(expected.y, 8)
    }
  })

  it('composes reflected nested rotation even when the flips cancel', async () => {
    const inner = group({ left: 10, top: 5, rotate: -15, isFlipH: true }, [image({ rotate: 10 })])
    const outer = group({ rotate: 30, isFlipH: true }, [inner])
    const [child] = await flattenGroupElement(outer, context(), echo)
    expect(child.rotate).toBe(55)
    expect(Boolean(child.isFlipH)).toBe(false)
    const local = childPoint(inner.elements[0], 13, -7)
    const intermediate = groupPoint(inner, local.x, local.y)
    const expected = groupPoint(outer, intermediate.x, intermediate.y)
    const actual = childPoint(child, 13, -7)
    expect(actual.x).toBeCloseTo(expected.x, 8)
    expect(actual.y).toBeCloseTo(expected.y, 8)
  })

  it('keeps group reflections in line endpoints and reverses only its own rotation', async () => {
    const original = image({ type: 'shape', shapType: 'line', x1: 40, y1: 20, x2: 0, y2: 0, rotate: 10 })
    const g = group({ rotate: 30, isFlipH: true }, [original])
    const [line] = await flattenGroupElement(g, context(), echo)
    for (const n of [1, 2]) {
      const expected = groupPoint(g, original.left + original[`x${n}`], original.top + original[`y${n}`])
      expect(line[`x${n}`]).toBeCloseTo(expected.x, 8)
      expect(line[`y${n}`]).toBeCloseTo(expected.y, 8)
    }
    expect(line.rotate).toBe(-10)
    expect(Boolean(line.isFlipH)).toBe(false)
  })
})
