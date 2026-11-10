import { expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { geometryShadowSvg } = require('../../shared/src/pptx-geometry-effects')

it('keeps native shadow distance unscaled through an anisotropic reflected group', () => {
  // PowerPoint 16.0/10417, exact body slide 6 in the affine-visible reference:
  // group scale 1.5 x 0.8, rotation 30 degrees and horizontal reflection.
  const matrix = [-1.5 * Math.cos(Math.PI / 6), -0.75, -0.4, 0.8 * Math.cos(Math.PI / 6), 0, 0]
  const geometry = {
    componentId: 'shadow-distance',
    style: {
      effects: {
        kind: 'list',
        effects: [
          {
            kind: 'outerShdw',
            dist: 152400,
            dir: 0,
            rotWithShape: true,
            color: { kind: 'srgb', value: '000000' },
          },
        ],
      },
    },
  }
  const html = geometryShadowSvg(geometry, {
    width: 120,
    height: 80,
    ink: '<path d="M0 0H120V80H0Z"/>',
    bounds: [0, 0, 120, 80],
    occurrenceMatrix: matrix,
  })
  const offset = html
    .match(/<g filter="[^"]+"><g transform="matrix\(([^"]+)\)"/)[1]
    .split(' ')
    .map(Number)
    .slice(4)
  const worldOffset = [
    matrix[0] * offset[0] + matrix[2] * offset[1],
    matrix[1] * offset[0] + matrix[3] * offset[1],
  ]
  expect(Math.hypot(...worldOffset)).toBeCloseTo(16, 10)
  expect(worldOffset[0]).toBeCloseTo(-16 * Math.cos(Math.PI / 6), 10)
  expect(worldOffset[1]).toBeCloseTo(-8, 10)
})
