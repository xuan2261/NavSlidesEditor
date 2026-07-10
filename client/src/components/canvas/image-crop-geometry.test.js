import { describe, expect, it } from 'vitest'
import {
  computeCropCommitGeometry,
  computeCropResetGeometry,
} from './image-crop-geometry'

describe('image crop geometry', () => {
  it('preserves the legacy unrotated crop geometry', () => {
    expect(
      computeCropCommitGeometry(
        { x: 100, y: 100, width: 200, height: 100, rotation: 0 },
        { x: 0.25, y: 0, w: 0.75, h: 1 }
      )
    ).toMatchObject({ x: 150, y: 100, width: 150, height: 100 })
  })

  it('moves a rotated crop along the element local axis', () => {
    expect(
      computeCropCommitGeometry(
        { x: 100, y: 100, width: 200, height: 100, rotation: 90 },
        { x: 0.25, y: 0, w: 0.75, h: 1 }
      )
    ).toMatchObject({ x: 125, y: 125, width: 150, height: 100 })
  })

  it('restores a rotated cropped image to its original world rectangle', () => {
    expect(
      computeCropResetGeometry({
        x: 125,
        y: 125,
        width: 150,
        height: 100,
        rotation: 90,
        imageW: 200,
        imageH: 100,
        imageOffsetX: -50,
        imageOffsetY: 0,
      })
    ).toMatchObject({ x: 100, y: 100, width: 200, height: 100 })
  })
})
