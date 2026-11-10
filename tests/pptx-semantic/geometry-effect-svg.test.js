// Actual shared SVG caller, not native fidelity qualification.
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import geometrySvg from '../../shared/src/pptx-geometry-svg'

const point = (id, x, y) => ({ componentId: id, x: x * 9525, y: y * 9525 })
function shape(effects, compound) {
  return {
    schemaVersion: 1,
    componentId: 'geometry',
    kind: 'custom',
    width: 80 * 9525,
    height: 80 * 9525,
    adjustments: [],
    guides: [],
    handles: [],
    paths: [
      {
        componentId: 'outline',
        commands: [
          { kind: 'moveTo', points: [point('p0', 0, 0)] },
          { kind: 'lnTo', points: [point('p1', 80, 0)] },
          { kind: 'lnTo', points: [point('p2', 80, 80)] },
          { kind: 'lnTo', points: [point('p3', 0, 80)] },
          { kind: 'close' },
        ],
      },
    ],
    style: {
      fill: {
        color: { kind: 'srgb', value: '00ff00', transforms: [{ kind: 'alpha', value: 50000 }] },
      },
      stroke: {
        color: { kind: 'srgb', value: '0000ff' },
        width: 95250,
        ...(compound
          ? {
              compound,
              alignment: 'ctr',
              cap: 'flat',
              dash: { kind: 'preset', value: 'solid' },
              join: { kind: 'miter', limit: 800000 },
            }
          : {}),
      },
      effects,
    },
  }
}
async function sample(geometry) {
  const body = geometrySvg.geometrySvgPathsString(geometry, {
    width: 80,
    height: 80,
    fill: 'none',
    stroke: 'none',
    strokeWidth: 0,
  })
  const image = await loadImage(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">${body}</svg>`)
  )
  const context = createCanvas(80, 80).getContext('2d')
  context.drawImage(image, 0, 0)
  return (x, y) => [...context.getImageData(x, y, 1, 1).data]
}
describe('effect source channels in the production SVG caller', () => {
  it('overlays fill once, preserves translucent alpha and leaves line paint intact', async () => {
    const pixel = await sample(
      shape({
        kind: 'list',
        effects: [
          {
            kind: 'fillOverlay',
            blend: 'over',
            fill: { color: { kind: 'srgb', value: 'ff0000' } },
          },
        ],
      })
    )
    expect(pixel(40, 40)).toEqual([255, 0, 0, 128])
    expect(pixel(2, 40)).toEqual([0, 0, 255, 255])
  })
  it.each(['fill', 'line'])('provides the separate %s image to an authored DAG', async (name) => {
    const pixel = await sample(shape({ kind: 'dag', effects: [{ kind: 'effect', ref: name }] }))
    expect(pixel(40, 40)).toEqual(name === 'fill' ? [0, 255, 0, 128] : [0, 0, 0, 0])
    expect(pixel(2, 40)).toEqual(name === 'fill' ? [0, 255, 0, 128] : [0, 0, 255, 255])
  })
  it('keeps compound native outline paint out of the fill image', async () => {
    const pixel = await sample(
      shape({ kind: 'dag', effects: [{ kind: 'effect', ref: 'line' }] }, 'dbl')
    )
    expect(pixel(40, 40)).toEqual([0, 0, 0, 0])
    expect(pixel(3, 40)).toEqual([0, 0, 255, 255])
  })
})
