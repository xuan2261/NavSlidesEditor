import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { compileGradientPath } from './geometry-gradient-svg-path-sampler.js'

const require = createRequire(import.meta.url)
const {
  reflectedPath,
  reflectGradientGeometry,
} = require('../../shared/src/pptx-geometry-gradient-partition')

it('shares a compound contour across premultiplied fields without copying its geometry', () => {
  const shared = { id: 'field', paths: new Map(), definitions: [] }
  const shape = '<ellipse cx="50" cy="50" rx="70" ry="30"'
  const p = reflectGradientGeometry(`${shape} fill="rgb(120,15,30)"/>`, 108.25, shared)
  const q = reflectGradientGeometry(`${shape} fill="rgb(127,127,127)"/>`, 108.25, shared)
  expect(shared.definitions).toHaveLength(1)
  expect(shared.paths.size).toBe(1)
  expect(p.match(/href="([^"]+)"/)[1]).toBe(q.match(/href="([^"]+)"/)[1])
  expect(p).toContain('fill="rgb(120,15,30)"')
  expect(q).toContain('fill="rgb(127,127,127)"')
  expect(p + q).not.toContain(' d=')
})

it.each([
  'M-200 -200H400V400H-200Z',
  'M150 50A100 30 0 1 1 -50 50A100 30 0 1 1 150 50Z',
  'M10 50A80 45 0 1 1 170 50L-50 10Z',
  'M-20 10L120 10L20 30L120 50L-20 50L80 30Z',
  'M0 0H100V100H0Z M100 50A50 50 0 1 0 0 50A50 50 0 1 0 100 50Z',
])('retains exact clipped contours and reflected winding for %s', (data) => {
  const diameter = 108.25
  const original = compileGradientPath(data)
  const reflected = compileGradientPath(reflectedPath(data, diameter))
  for (let y = 0.375; y < 2 * diameter; y += 5.25) {
    for (let x = 0.625; x < 2 * diameter; x += 5.125) {
      const sx = x < diameter ? x : 2 * diameter - x
      const sy = y < diameter ? y : 2 * diameter - y
      expect(reflected(x, y, 'nonzero'), `${x},${y}`).toBe(original(sx, sy, 'nonzero'))
    }
  }
})
