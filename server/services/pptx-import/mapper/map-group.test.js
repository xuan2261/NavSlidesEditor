import { describe, expect, it } from 'vitest'
import groupMapper from './map-group.js'

const { flattenGroupElement } = groupMapper

function context() {
  return {
    scale: { x: 1, y: 1 },
    zIndex: 7,
    slideIndex: 0,
    warnings: [],
    stats: { shapeCount: 0 },
  }
}

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
})
