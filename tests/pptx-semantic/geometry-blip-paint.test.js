import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const {
  blipParameters,
  blipPaintId,
  blipSvgDefinition,
} = require('../../shared/src/pptx-geometry-blip.js')
const asset = { src: '/uploads/texture.png', width: 32, height: 24, format: 'png' }
const fixture = (blip = { bindingId: 'imageBinding' }) => ({
  width: 128 * 9525,
  height: 96 * 9525,
  style: { fill: { blip } },
})
const options = { width: 128, height: 96, nativeStroke: true, asset }
describe('native geometry image paint parameters and SVG', () => {
  it('retains image paint references when durable JSON storage reorders record keys', () => {
    const geometry = fixture({
      bindingId: 'imageBinding', rotWithShape: false,
      srcRect: { l: 500, t: 1000 }, stretch: { fillRect: { r: 2000, b: 3000 } },
    })
    const input = {
      ...options,
      occurrenceMatrix: [1, 0, 0, 1, 100, 200],
      fillFrame: {
        ownerInstanceId: 'owner', componentId: 'fill', width: geometry.width,
        height: geometry.height, paintToWorld: [1, 0, 0, 1, 100, 200],
        paintToLeaf: [1, 0, 0, 1, 0, 0],
      },
    }
    const storageRoundTrip = value => JSON.parse(JSON.stringify(value, (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item))
    const stored = storageRoundTrip({ geometry, input })
    expect(blipSvgDefinition(stored.geometry, stored.input)).toBe(blipSvgDefinition(geometry, input))
    expect(blipPaintId(stored.geometry, stored.input)).toBe(blipPaintId(geometry, input))
    expect(blipPaintId(stored.geometry, { ...stored.input, modifier: 'darken' }))
      .not.toBe(blipPaintId(geometry, input))
  })
  it('derives omitted-mode tile defaults without changing sparse authored data', () => {
    const geometry = fixture()
    const before = structuredClone(geometry)
    const svg = blipSvgDefinition(geometry, options)
    expect(svg).toContain('<image')
    expect(svg).toContain('href="/uploads/texture.png"')
    expect(svg).toContain('width="304800" height="228600"')
    expect(svg).toContain(
      'patternTransform="matrix(0.00010498687664041995 0 0 0.00010498687664041995 0 0)"'
    )
    expect(svg).toContain(`id="${blipPaintId(geometry, options)}"`)
    expect(geometry).toEqual(before)
  })
  it('maps source crop into a destination fillRect with a real clipped image', () => {
    const geometry = fixture({
      bindingId: 'imageBinding',
      srcRect: { l: 25000, r: 25000 },
      stretch: { fillRect: { l: 25000, b: 50000 } },
    })
    const svg = blipSvgDefinition(geometry, options)
    expect(svg).toContain('<clipPath')
    expect(svg).toContain('x="304800" y="0" width="914400" height="457200"')
    expect(svg).toContain('<image x="-152400" y="0" width="1828800" height="457200"')
    expect(svg).toContain('preserveAspectRatio="none"')
  })
  it('derives tile scale, translation, center alignment and alternate mirrored copies', () => {
    const geometry = fixture({
      bindingId: 'imageBinding',
      tile: { sx: 50000, sy: 200000, tx: 9525, ty: -9525, algn: 'ctr', flip: 'xy' },
    })
    const svg = blipSvgDefinition(geometry, options)
    expect(svg).toContain('x="542925" y="219075" width="304800" height="914400"')
    expect((svg.match(/<image /g) || []).length).toBe(4)
    expect(svg).toContain('matrix(-1 0 0 1 304800 0)')
    expect(svg).toContain('matrix(1 0 0 -1 0 914400)')
  })
  it('uses the native90-degree upright bounds and swapped stretch extent for rotWithShape=false', () => {
    const geometry = fixture({ bindingId: 'imageBinding', rotWithShape: false, stretch: {} })
    const svg = blipSvgDefinition(geometry, {
      ...options,
      nativeStroke: false,
      occurrenceMatrix: [0, 1, -1, 0, 1000, 2000],
    })
    expect(svg).toContain('patternTransform="matrix(0 -1 1 0 0 914400)"')
    expect(svg).toContain('width="914400" height="1219200"')
  })
  it('retains the uncropped32x24 native tile period while sampling cropped pixels', () => {
    const geometry = fixture({
      bindingId: 'imageBinding',
      srcRect: { l: 25000, b: 25000 },
      tile: {},
    })
    const svg = blipSvgDefinition(geometry, { ...options, nativeStroke: false })
    expect(svg).toContain('width="304800" height="228600" patternTransform=')
    expect(svg).toContain('<image x="-101600" y="0" width="406400" height="304800"')
  })
  it('compensates native tile scale in the observed2x/.5x group without changing source parameters', () => {
    const geometry = fixture({ bindingId: 'imageBinding', tile: {} })
    const before = structuredClone(geometry)
    const svg = blipSvgDefinition(geometry, {
      ...options,
      nativeStroke: false,
      occurrenceMatrix: [2, 0, 0, 0.5, 3810000, 1714500],
    })
    expect(svg).toContain('width="304800" height="228600" patternTransform="matrix(0.5 0 0 2 0 0)"')
    expect(geometry).toEqual(before)
  })
  it('anchors upright tile phase at rotated rectangle bounds rather than the authored center frame', () => {
    const geometry = fixture({ bindingId: 'imageBinding', rotWithShape: false, tile: {} })
    const svg = blipSvgDefinition(geometry, {
      ...options,
      nativeStroke: false,
      occurrenceMatrix: [0, 1, -1, 0, 1485900, 1562100],
    })
    expect(svg).toContain('patternTransform="matrix(0 -1 1 0 0 914400)"')
    expect(svg).toContain('width="304800" height="228600"')
  })
  it.each([0, 64])(
    'consumes an owner stretch frame at child offset %s without restarting the image',
    (offset) => {
      const geometry = {
        ...fixture({ bindingId: 'imageBinding', stretch: {} }),
        width: 48 * 9525,
        height: 72 * 9525,
      }
      const fillFrame = {
        ownerInstanceId: 'source-group',
        componentId: 'group-properties',
        width: 112 * 9525,
        height: 72 * 9525,
        paintToWorld: [1, 0, 0, 1, 40 * 9525, 192 * 9525],
        paintToLeaf: [1, 0, 0, 1, -offset * 9525, 0],
      }
      const before = structuredClone({ geometry, fillFrame })
      const svg = blipSvgDefinition(geometry, { ...options, width: 48, height: 72, fillFrame })
      expect(svg).toContain('width="1066800" height="685800" patternTransform=')
      const matrix = svg
        .match(/patternTransform="matrix\(([^)]+)\)"/)[1]
        .split(' ')
        .map(Number)
      expect(matrix.slice(0, 4)).toEqual([1 / 9525, 0, 0, 1 / 9525])
      expect(matrix[4]).toBeCloseTo(-offset, 12)
      expect(matrix[5]).toBe(0)
      expect({ geometry, fillFrame }).toEqual(before)
    }
  )
  it('keys image paint by transient owner frame without changing authored image parameters', () => {
    const geometry = fixture({ bindingId: 'imageBinding', stretch: {} })
    const fillFrame = {
      ownerInstanceId: 'source-group',
      componentId: 'group-properties',
      width: 112 * 9525,
      height: 72 * 9525,
      paintToWorld: [1, 0, 0, 1, 0, 0],
      paintToLeaf: [1, 0, 0, 1, 0, 0],
    }
    const before = structuredClone(geometry)
    expect(blipPaintId(geometry, { ...options, fillFrame })).not.toBe(
      blipPaintId(geometry, {
        ...options,
        fillFrame: { ...fillFrame, width: 228 * 9525 },
      })
    )
    expect(blipPaintId(geometry, { ...options, fillFrame })).not.toBe(
      blipPaintId(geometry, {
        ...options,
        fillFrame: { ...fillFrame, ownerInstanceId: 'another-source-group' },
      })
    )
    expect(geometry).toEqual(before)
  })
  it('anchors native group tiles to owner axes rather than a rotated descendant or its AABB', () => {
    const geometry = {
      ...fixture({ bindingId: 'imageBinding', tile: {} }),
      width: 48 * 9525,
      height: 72 * 9525,
    }
    const fillFrame = {
      ownerInstanceId: 'source-group',
      componentId: 'group-properties',
      width: 124 * 9525,
      height: 72 * 9525,
      paintToWorld: [1, 0, 0, 1, 40 * 9525, 192 * 9525],
      paintToLeaf: [0, -1, 1, 0, -12 * 9525, 124 * 9525],
    }
    const input = {
      ...options,
      width: 48,
      height: 72,
      nativeStroke: false,
      fillFrame,
      occurrenceMatrix: [0, 1, -1, 0, 164 * 9525, 204 * 9525],
    }
    const before = structuredClone({ geometry, input })
    const svg = blipSvgDefinition(geometry, input)
    expect(svg).toContain(
      'width="304800" height="228600" patternTransform="matrix(0 -1 1 0 -114300 1181100)"'
    )
    expect({ geometry, input }).toEqual(before)
  })
  it('does not accept a render without a usable source-bound asset', () => {
    expect(() => blipSvgDefinition(fixture(), { ...options, asset: undefined })).toThrow(TypeError)
    expect(() =>
      blipSvgDefinition(fixture(), { ...options, asset: { ...asset, height: 0 } })
    ).toThrow(TypeError)
    expect(() =>
      blipSvgDefinition(fixture(), {
        ...options,
        asset: { ...asset, src: 'https://example.invalid/texture.png' },
      })
    ).toThrow(TypeError)
  })
  it.each([
    { bindingId: 'imageBinding', embed: 'imageOne' },
    { bindingId: 'imageBinding', src: '/uploads/texture.png' },
    { bindingId: 'imageBinding', dpi: 1.5 },
    { bindingId: 'imageBinding', tile: {}, stretch: {} },
    { bindingId: 'imageBinding', tile: { algn: 'unknown' } },
    { bindingId: 'imageBinding', srcRect: { l: 0.5 } },
  ])('rejects invalid or authoritative fields in geometry parameters %j', (blip) => {
    expect(() => blipParameters(blip)).toThrow(TypeError)
  })
})
