import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { sampleGradientSvg } from './geometry-gradient-svg-sampler.js'
const require = createRequire(import.meta.url)
const { gradientSvgDefinition } = require('../../shared/src/pptx-geometry-gradient')
const sourceStops = [
  { pos: 0, color: { kind: 'srgb', value: 'F01E3C' } },
  { pos: 100000, color: { kind: 'srgb', value: '1E50F0' } },
]
function svgFor(focus, stops = sourceStops, fillFrame) {
  return gradientSvgDefinition(
    {
      width: 180,
      height: 120,
      style: {
        fill: {
          gradient: {
            kind: 'path',
            path: 'circle',
            rotWithShape: true,
            fillToRect: focus,
            stops,
          },
        },
      },
    },
    { width: 180, height: 120, nativeStroke: false, fillFrame }
  )
}
const sampleOpaque = (svg, point) => sampleGradientSvg(svg, [point])[0]

// Interior witnesses from resume-path-gradient-focal-{reference,projector-v1}.
// Native byte quantization plus bounded vector band approximation allows two codes.
it.each([
  [{ l: 20000, r: 20000, t: 40000, b: 40000 }, [236, 34, 76]],
  [{ l: 10000, r: 30000, t: 20000, b: 40000 }, [240, 30, 61]],
  [{ l: 40000, t: 50000, r: 50000, b: 50000 }, [220, 45, 120]],
  [{ l: 40000, t: 45000, r: 50000, b: 50000 }, [222, 44, 116]],
])('renders independently sized focal axes at the native interior witness: %j', (focus, native) => {
  const before = structuredClone(focus)
  const actual = sampleOpaque(svgFor(focus), [90.25, 90.25])
  expect(actual).toHaveLength(3)
  actual.forEach((channel, index) =>
    expect(Math.abs(channel - native[index])).toBeLessThanOrEqual(2)
  )
  expect(focus).toEqual(before)
})

it('keeps the efficient radial representation for a circular focus', () => {
  const svg = svgFor({ l: 20000, r: 20000, t: 20000, b: 20000 })
  expect(svg).toContain('<radialGradient')
  expect(svg).not.toContain('<ellipse')
  expect(svg).not.toContain('<image')
})

it('preserves the supplied owner paint matrix for ellipse fields', () => {
  const matrix = [-1, 0.25, 0.125, 1, 20, 30]
  const svg = svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 }, sourceStops, {
    width: 180,
    height: 120,
    paintToLeaf: matrix,
  })
  expect(svg).toContain(`patternTransform="matrix(${matrix.join(' ')})"`)
})

it('samples premultiplied color without a transparent endpoint color fringe', () => {
  const { ellipseGradientBands } = require('../../shared/src/pptx-geometry-gradient-ellipse')
  const bands = ellipseGradientBands([
    { pos: 0, rgb: [255, 0, 0], alpha: 255 },
    { pos: 1, rgb: [0, 0, 255], alpha: 0 },
  ])
  const middle = bands.find((band) => band.t >= 0.5)
  expect(middle.alpha).toBe(127.5)
  expect(middle.premultiplied).toEqual([127.5, 0, 0])
})

it('retains both one-sided values at a repeated-offset alpha discontinuity', () => {
  const { ellipseGradientBands } = require('../../shared/src/pptx-geometry-gradient-ellipse')
  const bands = ellipseGradientBands([
    { pos: 0, rgb: [255, 0, 0], alpha: 255 },
    { pos: 0.5, rgb: [255, 0, 0], alpha: 255 },
    { pos: 0.5, rgb: [0, 0, 255], alpha: 0 },
    { pos: 1, rgb: [0, 0, 255], alpha: 0 },
  ])
  expect(bands).toEqual([
    { t: 0.5, alpha: 255, premultiplied: [255, 0, 0] },
    { t: 1, alpha: 0, premultiplied: [0, 0, 0] },
  ])
})

it('applies constant material alpha once instead of accumulating ellipse opacity', () => {
  const stops = sourceStops.map((stop) => ({
    ...stop,
    color: { ...stop.color, transforms: [{ kind: 'alpha', value: 50000 }] },
  }))
  const svg = svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 }, stops)
  expect(svg).toContain('<path')
  expect(svg.match(/<g opacity="/g)).toHaveLength(1)
  expect(svg).not.toMatch(/<path[^>]*fill-opacity=/)
})

it('reconstructs variable alpha from premultiplied fields, not an RGB-times-mask product', () => {
  const stops = structuredClone(sourceStops)
  stops[1].color.transforms = [{ kind: 'alpha', value: 0 }]
  const svg = svgFor({ l: 20000, r: 20000, t: 40000, b: 40000 }, stops)
  expect(svg).toContain('<path')
  expect(svg).toContain('<feComposite')
  expect(svg).toContain('operator="arithmetic"')
  expect(svg).toContain('k3="-1"')
  expect(svg).not.toContain(' mask=')
  expect(svg).not.toMatch(/<path[^>]*fill-opacity=/)
})
