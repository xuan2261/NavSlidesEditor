import { describe, expect, it } from 'vitest'
import { calculateGuides } from './smartGuides'

describe('smartGuides', () => {
  it('snaps dragged element center to canvas center', () => {
    const result = calculateGuides(
      { id: 'drag', x: 379, y: 220, width: 200, height: 100 },
      [{ id: 'drag', x: 379, y: 220, width: 200, height: 100 }]
    )

    expect(result.snappedX).toBe(380)
    expect(result.guides).toContainEqual({ axis: 'x', position: 480 })
  })

  it('[cap:canvas.smart-guides tier:deep] snaps to another element edge and returns guide axes independently', () => {
    const result = calculateGuides(
      { id: 'drag', x: 294, y: 96, width: 80, height: 60 },
      [
        { id: 'drag', x: 294, y: 96, width: 80, height: 60 },
        { id: 'target', x: 300, y: 100, width: 120, height: 80 },
      ]
    )

    expect(result.snappedX).toBe(300)
    expect(result.snappedY).toBe(100)
    expect(result.guides).toEqual([
      { axis: 'x', position: 300 },
      { axis: 'y', position: 100 },
    ])
  })

  it('does not snap outside the threshold', () => {
    const result = calculateGuides(
      { id: 'drag', x: 250, y: 250, width: 80, height: 60 },
      [{ id: 'target', x: 400, y: 400, width: 120, height: 80 }]
    )

    expect(result).toEqual({ guides: [], snappedX: 250, snappedY: 250 })
  })

  it.each([0.1, 1, 4])('uses a constant screen-space attraction distance at %sx zoom', (scale) => {
    const target = { id: 'target', x: 10000, y: 20000, width: 1000, height: 1000 }
    const dragged = { id: 'drag', x: target.x - 5 / scale, y: 12000, width: 1000, height: 1000 }
    const near = calculateGuides(dragged, [target], 100000, 100000, scale)
    expect(near.snappedX).toBe(target.x)
    expect(near.guides).toEqual([{ axis: 'x', position: target.x }])
    const farX = target.x - 8 / scale
    const far = calculateGuides({ ...dragged, x: farX }, [target], 100000, 100000, scale)
    expect(far.snappedX).toBe(farX)
    expect(far.guides).toEqual([])
  })
})
