import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
const require = createRequire(import.meta.url)
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg.js')
const { blipSvgDefinition } = require('../../shared/src/pptx-geometry-blip.js')

const asset = { src: '/uploads/source.png', width: 4, height: 1, format: 'png' }
const options = { width: 100, height: 80, fill: '#000000', stroke: 'none', strokeWidth: 0, asset }
const fixture = () => {
  const geometry = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  geometry.style = { fill: { blip: { bindingId: 'source-image', stretch: {} } } }
  return geometry
}

it.each(['lighten', 'lightenLess', 'darken', 'darkenLess'])(
  'never paints an unshaded source image for unsupported blip %s', modifier => {
    const geometry = fixture()
    geometry.paths[0].fill = modifier
    const before = structuredClone({ geometry, asset })
    expect(() => geometrySvgPathsString(geometry, { ...options, blipAsset: asset })).toThrow(
      /blip path shade/
    )
    expect(() => blipSvgDefinition(geometry, { ...options, modifier })).toThrow(/blip path shade/)
    expect({ geometry, asset }).toEqual(before)
  }
)

it('renders a shaded path from its matching immutable source-resolution asset', () => {
  const geometry = fixture()
  geometry.paths[0].fill = 'lighten'
  const derived = { src: '/uploads/lighten.png', width: 4, height: 1, format: 'png', byteLength: 71,
    sha256: 'c'.repeat(64), sourceHash: 'd'.repeat(64), algorithm: 'ooxml-blip-source-rgb-v1' }
  const svg = geometrySvgPathsString(geometry, {
    ...options,
    blipAsset: { ...asset, preconditionHash: 'd'.repeat(64) },
    blipDerivedAssets: { lighten: derived },
  })
  expect(svg).toContain('href="/uploads/lighten.png"')
  expect(svg).toContain('-lighten-crop')
})

it('still renders a normal source texture and unpainted paths without a shade approximation', () => {
  const geometry = fixture()
  geometry.paths[0].fill = 'none'
  const svg = geometrySvgPathsString(geometry, { ...options, blipAsset: asset })
  expect(svg).toContain('href="/uploads/source.png"')
  expect(svg).toContain('fill:none')
  expect(svg).not.toContain('feComponentTransfer')
})
