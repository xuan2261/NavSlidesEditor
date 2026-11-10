import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {
  geometryFillPaint,
  geometryStrokePaint,
} = require('../../shared/src/pptx-geometry-document')
const { gradientColors } = require('../../shared/src/pptx-geometry-gradient')
const gray = (r, transforms) => ({
  kind: 'scrgb',
  value: { r, g: r, b: r },
  ...(transforms ? { transforms } : {}),
})
const cases = [
  [gray(50000), 'BCBCBC'],
  [gray(50000, [{ kind: 'shade', value: 50000 }]), '898989'],
  [gray(16, [{ kind: 'shade', value: 50000 }]), '000000'],
  [gray(200000, [{ kind: 'shade', value: 25000 }]), 'BCBCBC'],
  [gray(-50000, [{ kind: 'tint', value: 50000 }]), '898989'],
  [{ kind: 'scrgb', value: { r: 50000, g: 25000, b: 10000 } }, 'BC8959'],
  [{ kind: 'hsl', value: { hue: 7200000, sat: 100000, lum: 50000 } }, '00FF00'],
  [{ kind: 'hsl', value: { hue: 21600000, sat: 100000, lum: 50000 } }, 'FF0000'],
  [{ kind: 'hsl', value: { hue: 12600000, sat: 50000, lum: 40000 } }, '336699'],
  [{ kind: 'hsl', value: { hue: 1800001, sat: 33333, lum: 45678 } }, '9B744E'],
  [{ kind: 'preset', value: 'cornflowerBlue' }, '6495ED'],
  [{ kind: 'preset', value: 'dkSlateGray' }, '2F4F4F'],
  [{ kind: 'preset', value: 'ltGoldenrodYellow' }, 'FAFAD2'],
  [{ kind: 'preset', value: 'medVioletRed' }, 'C71585'],
  [{ kind: 'preset', value: 'chartreuse' }, '7FFF00'],
  [{ kind: 'preset', value: 'chocolate' }, 'D2691E'],
]
describe('native geometry color paint boundary', () => {
  it.each([
    [{ hue: 14400000, sat: 0, lum: 50000 }, [{ kind: 'sat', value: 100000 }], 'FF0000'],
    [{ hue: 14400000, sat: 100000, lum: 0 }, [{ kind: 'lumOff', value: 50000 }], '808080'],
    [{ hue: 14400000, sat: 100000, lum: 100000 }, [{ kind: 'lum', value: 50000 }], '808080'],
    [
      { hue: 14400000, sat: 100000, lum: 50000 },
      [
        { kind: 'sat', value: 0 },
        { kind: 'alpha', value: 50000 },
        { kind: 'sat', value: 100000 },
      ],
      'FF0000',
    ],
  ])(
    'uses RGB paint conversions without mutating authored HSL %j and %j',
    (value, transforms, rgb) => {
      const color = { kind: 'hsl', value, transforms }
      const before = structuredClone(color)
      expect(geometryFillPaint({ style: { fill: { color } } }).fill).toBe('#' + rgb)
      expect(color).toEqual(before)
    }
  )
  it.each([
    [[{ kind: 'red', value: 100000 }], 'FF68AC'],
    [[{ kind: 'redMod', value: 0 }], '0068AC'],
    [[{ kind: 'redOff', value: -100000 }], '0068AC'],
    [[{ kind: 'green', value: 100000 }], '24FFAC'],
    [[{ kind: 'greenMod', value: 0 }], '2400AC'],
    [[{ kind: 'greenOff', value: -100000 }], '2400AC'],
    [[{ kind: 'blue', value: 100000 }], '2468FF'],
    [[{ kind: 'blueMod', value: 0 }], '246800'],
    [[{ kind: 'blueOff', value: -100000 }], '246800'],
    [[{ kind: 'red', value: 50000 }], 'BC68AC'],
    [[{ kind: 'redMod', value: 50000 }], '1768AC'],
    [[{ kind: 'redOff', value: 25000 }], '8D68AC'],
    [[{ kind: 'hue', value: 1800000 }], 'AC6824'],
    [[{ kind: 'hueOff', value: -5400000 }], '24AC24'],
    [[{ kind: 'hueMod', value: 50000 }], '46AC24'],
    [[{ kind: 'sat', value: 50000 }], '34689C'],
    [[{ kind: 'satMod', value: 50000 }], '46688A'],
    [[{ kind: 'satOff', value: 25000 }], '0A68C6'],
    [[{ kind: 'comp' }], 'AC6824'],
    [[{ kind: 'inv' }], 'FDEFCA'],
    [[{ kind: 'gray' }], '5E5E5E'],
    [[{ kind: 'gamma' }], '69ABD6'],
    // Exact inverse sRGB: the red channel is 4.498698... before RGB8 rounding.
    // PowerPoint's observed 5 remains in the separate native comparison receipt.
    [[{ kind: 'invGamma' }], '042369'],
    [
      [
        { kind: 'redOff', value: 100000 },
        { kind: 'redOff', value: -50000 },
      ],
      'BC68AC',
    ],
    [[{ kind: 'satMod', value: -50000 }], '8A6846'],
    [[{ kind: 'gamma' }, { kind: 'invGamma' }], '2468AC'],
    [[{ kind: 'invGamma' }, { kind: 'gamma' }], '2468AC'],
  ])('applies ordered native transforms %j in the geometry paint space', (transforms, rgb) => {
    const color = { kind: 'srgb', value: '2468AC', transforms }
    const before = structuredClone(color)
    expect(geometryFillPaint({ style: { fill: { color } } }).fill).toBe('#' + rgb)
    expect(geometryStrokePaint({ style: { stroke: { color, width: 12700 } } }).stroke).toBe(
      '#' + rgb
    )
    expect(color).toEqual(before)
  })
  it.each(cases)('derives solid and outline paint for %j only at the output', (color, expected) => {
    const before = structuredClone(color)
    const geometry = {
      style: { fill: { color }, stroke: { color, width: 12700 } },
    }
    expect(geometryFillPaint(geometry)).toMatchObject({ fill: '#' + expected })
    expect(geometryStrokePaint(geometry)).toMatchObject({ stroke: '#' + expected })
    expect(color).toEqual(before)
  })
  it.each(['scrgb', 'hsl', 'preset'])(
    'preserves ordered %s alpha without changing source',
    (kind) => {
      const color = structuredClone(cases.find(([entry]) => entry.kind === kind)[0])
      color.transforms = [
        { kind: 'alpha', value: 50000 },
        { kind: 'alphaMod', value: 50000 },
        { kind: 'alphaOff', value: -25000 },
      ]
      const before = structuredClone(color)
      expect(geometryFillPaint({ style: { fill: { color } } }).fillOpacity).toBe(0)
      expect(geometryStrokePaint({ style: { stroke: { color, width: 0 } } }).strokeOpacity).toBe(0)
      expect(color).toEqual(before)
    }
  )
  it('uses the same final boundary for gradient stops', () => {
    const gradient = {
      kind: 'linear',
      angle: 0,
      scaled: true,
      rotWithShape: true,
      stops: [
        { pos: 0, color: gray(50000) },
        {
          pos: 100000,
          color: {
            kind: 'preset',
            value: 'cornflowerBlue',
            transforms: [{ kind: 'alpha', value: 50000 }],
          },
        },
      ],
    }
    const before = structuredClone(gradient)
    expect(gradientColors(gradient)).toEqual([
      { pos: 0, rgb: [188, 188, 188], alpha: 255 },
      { pos: 1, rgb: [100, 149, 237], alpha: 128 },
    ])
    expect(gradient).toEqual(before)
  })
  it.each([
    { kind: 'scrgb', value: { r: 0, g: 0 } },
    { kind: 'scrgb', value: { r: 0.5, g: 0, b: 0 } },
    { kind: 'scrgb', value: { r: 0, g: 0, b: 0, extra: 1 } },
    { kind: 'hsl', value: { hue: -1, sat: 100000, lum: 50000 } },
    { kind: 'hsl', value: { hue: 21600001, sat: 100000, lum: 50000 } },
    { kind: 'preset', value: 'transparent' },
    { kind: 'preset', value: 'darkSlateGray' },
    { kind: 'preset', value: 'CornflowerBlue' },
    { ...gray(50000), transforms: null },
    { ...gray(50000), transforms: false },
    { ...gray(50000), transforms: 0 },
    { ...gray(50000), transforms: '' },
  ])('rejects malformed or non-native color %j', (color) => {
    expect(() => geometryFillPaint({ style: { fill: { color } } })).toThrow()
    expect(() => geometryStrokePaint({ style: { stroke: { color, width: 12700 } } })).toThrow()
  })
})
