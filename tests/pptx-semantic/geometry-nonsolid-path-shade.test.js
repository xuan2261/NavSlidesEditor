import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture'

const require = createRequire(import.meta.url)
const { geometryFillPaint } = require('../../shared/src/pptx-geometry-document')
const { patternPaint, patternPaintId } = require('../../shared/src/pptx-geometry-pattern')
const { blipPaintId } = require('../../shared/src/pptx-geometry-blip')
const { geometrySvgPathsString } = require('../../shared/src/pptx-geometry-svg')

const paints = [
  {
    family: 'pattern',
    fill: {
      pattern: {
        preset: 'pct50',
        foreground: { kind: 'srgb', value: '6496C8' },
        background: { kind: 'srgb', value: 'A35BC7' },
      },
    },
    paintId: patternPaintId,
  },
  {
    family: 'blip',
    fill: { blip: { bindingId: 'source-image', stretch: { fillRect: {} } } },
    paintId: blipPaintId,
  },
]

it.each(
  paints.flatMap((paint) =>
    ['lighten', 'lightenLess', 'darken', 'darkenLess'].map((modifier) => ({
      ...paint,
      modifier,
    }))
  )
)(
  'retains $family source paint with independent $modifier path ink',
  ({ fill, paintId, modifier }) => {
    const geometry =
      geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
    geometry.style = { fill: structuredClone(fill) }
    const normal = geometry.paths[0]
    normal.fill = 'norm'
    const shaded = structuredClone(normal)
    shaded.componentId += ':shaded'
    shaded.fill = modifier
    for (const command of shaded.commands)
      for (const point of command.points ?? []) point.componentId += ':shaded'
    geometry.paths.push(shaded)
    const before = structuredClone(geometry)

    expect(() => geometryFillPaint(geometry)).not.toThrow()
    expect(geometryFillPaint(geometry)).toEqual({ fill: `url(#${paintId(geometry)})` })
    const options = { width: 100, height: 80, nativeStroke: false }
    const normalId = paintId(geometry, options)
    expect(paintId(geometry, { ...options, modifier: 'norm' })).toBe(normalId)
    const shadedId = paintId(geometry, { ...options, modifier })
    expect(shadedId).not.toBe(normalId)
    if (fill.pattern) {
      const svg = geometrySvgPathsString(geometry, {
        ...options,
        fill: '#000000',
        stroke: 'none',
        strokeWidth: 0,
      })
      expect([...svg.matchAll(/<pattern id="([^"]+)"/g)].map((match) => match[1])).toEqual([
        normalId,
        shadedId,
      ])
      expect(svg).toContain(`fill:url(#${normalId})`)
      expect(svg).toContain(`fill:url(#${shadedId})`)
    } else {
      const sourceAsset = {
        src: '/uploads/source.png', width: 1, height: 1, format: 'png', byteLength: 4,
        preconditionHash: 'a'.repeat(64),
      }
      const derivedAssets = {
        [modifier]: {
          src: `/uploads/${modifier}.png`, width: 1, height: 1, format: 'png', byteLength: 4,
          sha256: 'b'.repeat(64), sourceHash: sourceAsset.preconditionHash,
          algorithm: 'ooxml-blip-source-rgb-v1',
        },
      }
      const blipOptions = { ...options, asset: sourceAsset, derivedAssets }
      const sourceId = paintId(geometry, { ...blipOptions, modifier: 'norm' })
      const shadedId = paintId(geometry, { ...blipOptions, modifier })
      const svg = geometrySvgPathsString(geometry, {
        ...options,
        blipAsset: sourceAsset,
        blipDerivedAssets: derivedAssets,
        fill: '#000000',
        stroke: 'none',
        strokeWidth: 0,
      })
      expect([...svg.matchAll(/<pattern id="([^"]+)"/g)].map((match) => match[1])).toEqual([
        sourceId,
        shadedId,
      ])
      expect([...svg.matchAll(/<image\b[^>]*href="([^"]+)"/g)].map((match) => match[1])).toEqual([
        sourceAsset.src,
        derivedAssets[modifier].src,
      ])
      expect(svg).toContain(`fill:url(#${sourceId})`)
      expect(svg).toContain(`fill:url(#${shadedId})`)
      expect(svg).not.toContain('filter=')
      const missingDerived = { ...options, blipAsset: sourceAsset,
        fill: '#000000', stroke: 'none', strokeWidth: 0 }
      expect(() => geometrySvgPathsString(geometry, missingDerived)).toThrow(/source-resolution derived asset/)
      const forgedDerived = structuredClone(derivedAssets)
      forgedDerived[modifier].sourceHash = 'c'.repeat(64)
      expect(() => geometrySvgPathsString(geometry, {
        ...missingDerived, blipDerivedAssets: forgedDerived,
      })).toThrow(/derived asset provenance/)

      const tiled = structuredClone(geometry)
      tiled.style.fill.blip = {
        bindingId: 'source-image',
        tile: { tx: 9525, ty: -9525, sx: 50000, sy: 50000, flip: 'xy', algn: 'ctr' },
      }
      const tileSourceId = paintId(tiled, { ...blipOptions, modifier: 'norm' })
      const tileShadedId = paintId(tiled, { ...blipOptions, modifier })
      const tileSvg = geometrySvgPathsString(tiled, {
        ...options, blipAsset: sourceAsset, blipDerivedAssets: derivedAssets,
        fill: '#000000', stroke: 'none', strokeWidth: 0,
      })
      const tileWidth = sourceAsset.width * 9525 * 0.5
      const tileHeight = sourceAsset.height * 9525 * 0.5
      const patternWidth = tileWidth * 2, patternHeight = tileHeight * 2
      const tileX = (tiled.width - tileWidth) / 2 + 9525
      const tileY = (tiled.height - tileHeight) / 2 - 9525
      for (const id of [tileSourceId, tileShadedId]) {
        expect(tileSvg).toContain(`clipPath id="${id}-crop" clipPathUnits="userSpaceOnUse"`)
        expect(tileSvg).toContain(`<pattern id="${id}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" x="${tileX}" y="${tileY}" width="${patternWidth}" height="${patternHeight}" patternTransform="matrix(1 0 0 1 0 0)"`)
        expect(tileSvg).toContain(`matrix(-1 0 0 1 ${patternWidth} 0)`)
        expect(tileSvg).toContain(`matrix(1 0 0 -1 0 ${patternHeight})`)
      }
    }
    expect(geometry).toEqual(before)
  }
)

it.each([
  { modifier: 'lighten', foreground: 'A2C0DE', background: 'C89DDD' },
  { modifier: 'lightenLess', foreground: '82ABD3', background: 'B57BD2' },
  { modifier: 'darken', foreground: '3C5A78', background: '623777' },
  { modifier: 'darkenLess', foreground: '5079A1', background: '8349A0' },
])(
  'matches native opaque pattern source bytes for $modifier',
  ({ modifier, foreground, background }) => {
    const pattern = structuredClone(paints[0].fill.pattern)
    const before = structuredClone(pattern)
    const normal = patternPaint(pattern)
    const shaded = patternPaint(pattern, modifier)

    expect(shaded.foreground).toEqual({ rgb: foreground, alpha: 1 })
    expect(shaded.background).toEqual({ rgb: background, alpha: 1 })
    expect(shaded.coverage).toEqual(normal.coverage)
    expect(shaded.mask).toBe(normal.mask)
    expect(pattern).toEqual(before)
  }
)
