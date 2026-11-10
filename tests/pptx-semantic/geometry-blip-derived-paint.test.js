import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
const require = createRequire(import.meta.url)
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg')
const { blipPaintId, blipSvgDefinition } = require('../../shared/src/pptx-geometry-blip')
const modes = ['lighten', 'lightenLess', 'darken', 'darkenLess']
const asset = { src: '/uploads/source.png', width: 4, height: 1, format: 'png', preconditionHash: 'a'.repeat(64) }
const variants = Object.fromEntries(modes.map(modifier => [modifier, { src: `/uploads/${modifier}.png`, width: 4,
  height: 1, format: 'png', byteLength: 100, sha256: 'b'.repeat(64), sourceHash: asset.preconditionHash,
  algorithm: 'ooxml-blip-source-rgb-v1' }]))
function fixture() {
  const geometry = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  geometry.style = { fill: { blip: { bindingId: 'source-image', srcRect: { l: 10000 },
    tile: { flip: 'xy', tx: 1234, sy: 80000 }, rotWithShape: false } } }
  const original = geometry.paths[0]
  geometry.paths = ['norm', ...modes, 'none'].map((fill, index) => {
    const path = structuredClone(original)
    path.componentId += ':' + index; path.fill = fill
    for (const command of path.commands) for (const point of command.points || []) point.componentId += ':' + index
    return path
  })
  return geometry
}
const options = { width: 100, height: 80, nativeStroke: false, occurrenceMatrix: [0, 1, -1, 0, 80, 0],
  fill: '#000000', stroke: '#cc0022', strokeWidth: 2, asset, derivedAssets: variants }
it('uses five source textures before identical crop/tile/flip transforms without shading stroke or final field', () => {
  const geometry = fixture(), before = structuredClone({ geometry, asset, variants })
  const svg = geometrySvgPathsString(geometry, { ...options, blipAsset: asset, blipDerivedAssets: variants })
  const ids = ['norm', ...modes].map(modifier => blipPaintId(geometry, { ...options, modifier }))
  expect(new Set(ids).size).toBe(5)
  expect(blipPaintId(geometry, options)).toBe(blipPaintId(geometry, { ...options, derivedAssets: undefined }))
  expect([...svg.matchAll(/<pattern id="([^"]+)"/g)].map(match => match[1])).toEqual(ids)
  for (const mode of modes) expect(svg).toContain(`href="/uploads/${mode}.png"`)
  expect(svg).toContain('href="/uploads/source.png"')
  for (const id of ids) expect(svg).toContain(`fill:url(#${id})`)
  expect(svg).toContain('fill:none'); expect(svg).toContain('stroke:#cc0022')
  expect(svg).not.toMatch(/filter=|feComponentTransfer|data:image/)
  const norm = blipSvgDefinition(geometry, { ...options, modifier: 'norm' })
  const shade = blipSvgDefinition(geometry, { ...options, modifier: 'lighten' })
  expect(shade.replaceAll(ids[1], ids[0]).replaceAll('/uploads/lighten.png', '/uploads/source.png')).toBe(norm)
  expect({ geometry, asset, variants }).toEqual(before)
})
it.each([
  ['source identity', { sourceHash: 'c'.repeat(64) }], ['width', { width: 5 }],
  ['URL boundary', { src: '/uploads/%2e%2e/f.png' }], ['algorithm', { algorithm: 'unqualified' }],
  ['encoded image', { pixels: [0, 0, 0, 0] }], ['format', { format: 'jpeg' }],
])('rejects derived %s mismatch without falling back to original', (_label, patch) => {
  const derivedAssets = { ...variants, lighten: { ...variants.lighten, ...patch } }
  expect(() => blipSvgDefinition(fixture(), { ...options, modifier: 'lighten', derivedAssets })).toThrow()
})
