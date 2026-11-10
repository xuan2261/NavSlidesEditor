import { describe, expect, it } from 'vitest'
import affine from '../../shared/src/pptx-affine.js'

const {
  IDENTITY,
  multiply,
  transformPoint,
  invert,
  groupTransform,
  leafTransform,
  viewportTransform,
} = affine
const close = (actual, expected) => {
  expect(Number.isFinite(actual)).toBe(true)
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-8 + Math.abs(expected) * 1e-11)
}
const pointClose = (actual, expected) => {
  close(actual.x, expected.x)
  close(actual.y, expected.y)
}
const source = (i = 0) => ({
  off: { x: -914400 + i * 1871.5, y: 38100 - i * 1207.25 },
  ext: { cx: 912345 + i * 3701.25, cy: 456789 + (i % 17) * 30007.5 },
  chOff: { x: -38100 + i * 73.125, y: 914400 - i * 127.25 },
  chExt: { cx: 457200 + (i % 13) * 8531.5, cy: 333000 + (i % 11) * 9271.25 },
  rotation: i % 12 ? (((i * 137) % 720) - 360) * 60000 + 12500 : 0,
  flipH: Boolean(i & 1),
  flipV: Boolean(i & 2),
})
// Independent point oracle: reflect normalized child coordinates, size, then
// rotate a native-unit point about the authored center. No matrix helpers.
function nativePoint(s, point) {
  let u = (point.x - s.chOff.x) / s.chExt.cx
  let v = (point.y - s.chOff.y) / s.chExt.cy
  if (s.flipH) u = 1 - u
  if (s.flipV) v = 1 - v
  const x = (u - 0.5) * s.ext.cx,
    y = (v - 0.5) * s.ext.cy
  const angle = (s.rotation / 60000 / 180) * Math.PI
  return {
    x: s.off.x + s.ext.cx / 2 + x * Math.cos(angle) - y * Math.sin(angle),
    y: s.off.y + s.ext.cy / 2 + x * Math.sin(angle) + y * Math.cos(angle),
  }
}
const probes = (s) =>
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0.37125, 0.6825],
    [-0.25, 1.5],
  ].map(([x, y]) => ({ x: s.chOff.x + x * s.chExt.cx, y: s.chOff.y + y * s.chExt.cy }))

describe('raw OOXML affine geometry', () => {
  it('uses column vectors, right-first ancestry and immutable inputs', () => {
    expect(IDENTITY).toEqual([1, 0, 0, 1, 0, 0])
    const parent = Object.freeze([2, 0, 0, 3, 10, 20])
    const child = Object.freeze([1, 0, 0, 1, -4, 5])
    const point = Object.freeze({ x: 7, y: -2 })
    expect(transformPoint(multiply(parent, child), point)).toEqual({ x: 16, y: 29 })
    expect(transformPoint(multiply(child, parent), point)).toEqual({ x: 20, y: 19 })
    expect(multiply(parent, IDENTITY)).toEqual(parent)
    expect(multiply(IDENTITY, parent)).toEqual(parent)
    const s = source(7)
    Object.values(s)
      .filter((v) => typeof v === 'object')
      .forEach(Object.freeze)
    groupTransform(Object.freeze(s))
    invert(parent)
    expect(parent).toEqual([2, 0, 0, 3, 10, 20])
  })
  it.each(Array.from({ length: 240 }, (_, i) => i))(
    'agrees with native-unit corner and pointer oracle %i',
    (i) => {
      const s = source(i),
        matrix = groupTransform(s),
        inverse = invert(matrix)
      for (const point of probes(s)) {
        const world = nativePoint(s, point)
        pointClose(transformPoint(matrix, point), world)
        pointClose(transformPoint(inverse, world), point)
      }
      const [a, b, c, d] = matrix
      close(
        a * d - b * c,
        ((((s.flipH !== s.flipV ? -1 : 1) * s.ext.cx) / s.chExt.cx) * s.ext.cy) / s.chExt.cy
      )
      const leaf = leafTransform(s)
      const local = { ...s, chOff: { x: 0, y: 0 }, chExt: s.ext }
      for (const point of probes(local))
        pointClose(transformPoint(leaf, point), nativePoint(local, point))
    }
  )
  it('composes 24 anisotropic reflected ancestors without flattening local transforms', () => {
    const ancestors = Array.from({ length: 24 }, (_, i) => {
      const s = source(i + 1)
      return { ...s, ext: { cx: s.chExt.cx * 1.6, cy: s.chExt.cy * 0.7 } }
    })
    const leaf = source(41),
      local = { ...leaf, chOff: { x: 0, y: 0 }, chExt: leaf.ext }
    const world = ancestors.reduce((matrix, s) => multiply(matrix, groupTransform(s)), IDENTITY)
    const matrix = multiply(world, leafTransform(leaf)),
      inverse = invert(matrix)
    for (const point of probes(local)) {
      const expected = ancestors.reduceRight((p, s) => nativePoint(s, p), nativePoint(local, point))
      pointClose(transformPoint(matrix, point), expected)
      // Inversion acts on the represented six coefficients. The independent
      // native chain has its own intermediate rounding and remains the
      // forward oracle above, not a different input to this inverse check.
      pointClose(transformPoint(inverse, transformPoint(matrix, point)), point)
    }
    const product = multiply(matrix, inverse)
    const u = Number.EPSILON / 2
    const gamma3 = (3 * u) / (1 - 3 * u)
    const [a, b, c, d, e, f] = matrix
    const [g, h, i, j, k, l] = inverse
    const scales = [
      Math.abs(a * g) + Math.abs(c * h),
      Math.abs(b * g) + Math.abs(d * h),
      Math.abs(a * i) + Math.abs(c * j),
      Math.abs(b * i) + Math.abs(d * j),
      Math.abs(a * k) + Math.abs(c * l) + Math.abs(e),
      Math.abs(b * k) + Math.abs(d * l) + Math.abs(f),
    ]
    product.forEach((value, index) => {
      expect(Math.abs(value - IDENTITY[index])).toBeLessThanOrEqual(gamma3 * scales[index])
    })
  })
  it('retains shear in S(2,1) R(45) rather than reducing it to an AABB plus angle', () => {
    const leaf = leafTransform({
      off: { x: -1, y: -1 },
      ext: { cx: 2, cy: 2 },
      rotation: 45 * 60000,
    })
    const matrix = multiply([2, 0, 0, 1, 0, 0], leaf)
    const [a, b, c, d] = matrix
    close(a * c + b * d, -1.5) // Rotated rectangle axes would be orthogonal.
    const corners = [
      [0, 0, 0, -Math.SQRT2],
      [2, 0, 2 * Math.SQRT2, 0],
      [2, 2, 0, Math.SQRT2],
      [0, 2, -2 * Math.SQRT2, 0],
    ]
    for (const [x, y, worldX, worldY] of corners) {
      pointClose(transformPoint(matrix, { x, y }), { x: worldX, y: worldY })
    }
    const hit = transformPoint(invert(matrix), { x: Math.SQRT2, y: 0 })
    pointClose(hit, { x: 1.5, y: 0.5 })
    const outside = transformPoint(invert(matrix), { x: 2.5, y: 1 })
    expect(outside.x > 2 || outside.y < 0).toBe(true) // Inside AABB, outside shape.
  })
  it('preserves negative and fractional source boxes without rounding or clipping', () => {
    const s = { off: { x: -12.5, y: -9.25 }, ext: { cx: 0.75, cy: 1.5 } }
    expect(transformPoint(leafTransform(s), { x: 0, y: 0 })).toEqual(s.off)
    expect(transformPoint(leafTransform(s), { x: 0.75, y: 1.5 })).toEqual({ x: -11.75, y: -7.75 })
    expect(() => leafTransform({ left: -12.5, top: 0, width: 2, height: 3, rotate: 45 })).toThrow(
      TypeError
    )
  })
  it.each([
    [9144000, 6858000, 1600, 900, 900 / 6858000, 200, 0],
    [12192000, 6858000, 1024, 768, 1024 / 12192000, 0, 96],
    [5000000, 2000000, 1000.125, 800.5, 1000.125 / 5000000, 0, 200.225],
  ])(
    'fits and centers viewport %i x %i with one scale',
    (slideWidth, slideHeight, viewportWidth, viewportHeight, scale, x, y) => {
      const matrix = viewportTransform({ slideWidth, slideHeight, viewportWidth, viewportHeight })
      matrix.forEach((value, i) => close(value, [scale, 0, 0, scale, x, y][i]))
      pointClose(transformPoint(matrix, { x: slideWidth / 2, y: slideHeight / 2 }), {
        x: viewportWidth / 2,
        y: viewportHeight / 2,
      })
      expect(transformPoint(matrix, { x: -slideWidth, y: -slideHeight }).x).toBeLessThan(0)
    }
  )
  it.each([
    [1e-200, -2e-200],
    [1e200, 2e200],
    [1e-200, 1e200],
    [1, Number.EPSILON],
  ])('inverts representable scales %s and %s without determinant epsilon or underflow', (x, y) => {
    const matrix = [x, 0, 0, y, 0, 0],
      inverse = invert(matrix)
    close(inverse[0], 1 / x)
    close(inverse[3], 1 / y)
    pointClose(transformPoint(inverse, transformPoint(matrix, { x: 0.125, y: -9.5 })), {
      x: 0.125,
      y: -9.5,
    })
  })
  it('accepts a nonzero near-singular determinant but rejects singular matrices', () => {
    expect(invert([1, 1, 1, 1 + Number.EPSILON, 0, 0]).every(Number.isFinite)).toBe(true)
    for (const matrix of [
      [0, 0, 0, 0, 1, 2],
      [1, 2, 2, 4, 5, 6],
      [-1, -2, 2, 4, 0, 0],
    ]) {
      expect(() => invert(matrix)).toThrow(RangeError)
    }
  })
  it.each([NaN, Infinity, -Infinity, '1', null, undefined, {}, 1n])(
    'rejects non-finite or non-numeric input %s',
    (bad) => {
      for (let i = 0; i < 6; i++) {
        const matrix = [...IDENTITY]
        matrix[i] = bad
        for (const call of [
          () => multiply(matrix, IDENTITY),
          () => multiply(IDENTITY, matrix),
          () => invert(matrix),
          () => transformPoint(matrix, { x: 0, y: 0 }),
        ])
          expect(call).toThrow(TypeError)
      }
      for (const key of ['x', 'y'])
        expect(() => transformPoint(IDENTITY, { x: 0, y: 0, [key]: bad })).toThrow(TypeError)
      for (const [field, keys] of [
        ['off', ['x', 'y']],
        ['chOff', ['x', 'y']],
        ['ext', ['cx', 'cy']],
        ['chExt', ['cx', 'cy']],
      ]) {
        for (const key of keys) {
          const s = source()
          s[field][key] = bad
          expect(() => groupTransform(s)).toThrow(TypeError)
          if (field === 'off' || field === 'ext') expect(() => leafTransform(s)).toThrow(TypeError)
        }
      }
      if (bad !== undefined)
        expect(() => groupTransform({ ...source(), rotation: bad })).toThrow(TypeError)
      for (const key of ['slideWidth', 'slideHeight', 'viewportWidth', 'viewportHeight']) {
        expect(() =>
          viewportTransform({
            slideWidth: 4,
            slideHeight: 3,
            viewportWidth: 16,
            viewportHeight: 9,
            [key]: bad,
          })
        ).toThrow(TypeError)
      }
    }
  )
  it.each([0, -1])('rejects nonpositive group/viewport and negative leaf extents %i', (bad) => {
    for (const field of ['ext', 'chExt'])
      for (const key of ['cx', 'cy']) {
        const s = source()
        s[field][key] = bad
        expect(() => groupTransform(s)).toThrow(RangeError)
        if (field === 'ext' && bad < 0) expect(() => leafTransform(s)).toThrow(RangeError)
      }
    for (const key of ['slideWidth', 'slideHeight', 'viewportWidth', 'viewportHeight']) {
      expect(() =>
        viewportTransform({
          slideWidth: 4,
          slideHeight: 3,
          viewportWidth: 16,
          viewportHeight: 9,
          [key]: bad,
        })
      ).toThrow(RangeError)
    }
  })
  it('rejects malformed matrices, missing raw geometry, and coerced flip flags', () => {
    for (const matrix of [null, [], new Array(6), [...IDENTITY, 0], '1,0,0,1,0,0']) {
      expect(() => invert(matrix)).toThrow(TypeError)
      expect(() => multiply(matrix, IDENTITY)).toThrow(TypeError)
      expect(() => transformPoint(matrix, { x: 0, y: 0 })).toThrow(TypeError)
    }
    for (const s of [undefined, null, {}, { off: { x: 0, y: 0 } }]) {
      expect(() => groupTransform(s)).toThrow(TypeError)
      expect(() => leafTransform(s)).toThrow(TypeError)
    }
    for (const flip of ['flipH', 'flipV'])
      for (const bad of [0, 1, 'false', null]) {
        expect(() => groupTransform({ ...source(), [flip]: bad })).toThrow(TypeError)
        expect(() => leafTransform({ ...source(), [flip]: bad })).toThrow(TypeError)
      }
  })
  it('rejects arithmetic outside finite matrix and point representation', () => {
    const huge = [Number.MAX_VALUE, 0, 0, 1, 0, 0]
    expect(() => multiply(huge, huge)).toThrow(RangeError)
    expect(() => transformPoint(huge, { x: 2, y: 0 })).toThrow(RangeError)
    expect(() => invert([Number.MIN_VALUE, 0, 0, 1, 0, 0])).toThrow(RangeError)
  })
})
