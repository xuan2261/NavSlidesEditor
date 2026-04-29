import { describe, expect, it } from 'vitest'
import geometry from './geometry.js'

const {
  applyToPoint,
  identityMatrix,
  mapBox,
  mapBoxByMatrix,
  mapLineGeometry,
  normalizeSourceSize,
  readCoord,
  rotateAround,
  scaleAround,
  translate,
  multiply,
} = geometry

describe('pptx geometry helpers', () => {
  it('readCoord keeps 0 as valid instead of falling back', () => {
    expect(readCoord(0, 20, 99)).toBe(0)
    expect(readCoord(undefined, 20, 99)).toBe(20)
    expect(readCoord(undefined, undefined, 99)).toBe(99)
  })

  it('normalizes invalid source size to canvas defaults', () => {
    const normalized = normalizeSourceSize({ width: null, height: 0 })
    expect(normalized.width).toBe(960)
    expect(normalized.height).toBe(540)
    expect(normalized.scale.x).toBe(1)
    expect(normalized.scale.y).toBe(1)
  })

  it('maps box with nullish-safe coordinate reads', () => {
    const box = mapBox({ left: 0, top: 0, width: 100, height: 50 }, { x: 0.5, y: 2 })
    expect(box).toEqual({ x: 0, y: 0, width: 50, height: 100 })
  })

  it('maps absolute line endpoints into local endpoints and wrapper box', () => {
    const geom = mapLineGeometry(
      { left: 10, top: 10, width: 80, height: 20, x1: 100, y1: 50, x2: 140, y2: 90 },
      { x: 1, y: 1 }
    )
    expect(geom.mode).toBe('absolute')
    expect(geom.box).toEqual({ x: 100, y: 50, width: 40, height: 40 })
    expect(geom.endpoints).toEqual({ x1: 0, y1: 0, x2: 40, y2: 40 })
  })

  it('keeps local line endpoints when endpoints are inside the local box', () => {
    const geom = mapLineGeometry(
      { left: 10, top: 10, width: 80, height: 20, x1: 0, y1: 10, x2: 80, y2: 10 },
      { x: 1, y: 1 }
    )
    expect(geom.mode).toBe('local')
    expect(geom.box).toEqual({ x: 10, y: 10, width: 80, height: 20 })
    expect(geom.endpoints).toEqual({ x1: 0, y1: 10, x2: 80, y2: 10 })
  })

  it('maps boxes through affine matrices', () => {
    const box = { x: 10, y: 20, width: 30, height: 10 }
    const matrix = multiply(
      scaleAround(-1, 1, 25, 25),
      multiply(rotateAround(90, 25, 25), translate(5, 0))
    )
    const mapped = mapBoxByMatrix(box, matrix)
    expect(mapped.width).toBeGreaterThan(0)
    expect(mapped.height).toBeGreaterThan(0)
  })

  it('identity matrix keeps points unchanged', () => {
    const p = applyToPoint(identityMatrix(), 11, 22)
    expect(p).toEqual({ x: 11, y: 22 })
  })
})
