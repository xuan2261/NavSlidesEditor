import { describe, expect, it } from 'vitest'
import patternCore from '../../shared/src/pptx-geometry-pattern.js'
import geometryCore from '../../shared/src/pptx-geometry-document.js'
import svgCore from '../../shared/src/pptx-geometry-svg.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

const masks = {
  pct5: '8000000008000000',
  pct10: '8000080080000800',
  pct20: '8800220088002200',
  pct25: '8822882288228822',
  pct30: 'aa44aa11aa44aa11',
  pct40: 'aa55aa51aa55aa15',
  pct50: 'aa55aa55aa55aa55',
  pct60: 'ee55bb55ee55bb55',
  pct70: '77dd77dd77dd77dd',
  pct75: '77ffddff77ffddff',
  pct80: 'effffeffeffffeff',
  pct90: 'fffffff7ffffff7f',
  horz: 'ff00000000000000',
  vert: '8080808080808080',
  ltHorz: 'ff000000ff000000',
  ltVert: '8888888888888888',
  dkHorz: 'ffff0000ffff0000',
  dkVert: 'cccccccccccccccc',
  narHorz: 'ff00ff00ff00ff00',
  narVert: '5555555555555555',
  dashHorz: 'f00000000f000000',
  dashVert: '8080808008080808',
  cross: 'ff80808080808080',
  dnDiag: '8040201008040201',
  upDiag: '0102040810204080',
  ltDnDiag: '8844221188442211',
  ltUpDiag: '1122448811224488',
  dkDnDiag: 'cc663399cc663399',
  dkUpDiag: '3366cc993366cc99',
  wdDnDiag: 'c1e070381c0e0783',
  wdUpDiag: '83070e1c3870e0c1',
  dashDnDiag: '0000884422110000',
  dashUpDiag: '0000112244880000',
  diagCross: '8142241818244281',
  smCheck: '9966669999666699',
  lgCheck: 'f0f0f0f00f0f0f0f',
  smGrid: 'ff888888ff888888',
  lgGrid: 'ff80808080808080',
  dotGrid: 'aa00800080008000',
  smConfetti: '8008400210012004',
  lgConfetti: 'b130031bd8c00c8d',
  horzBrick: 'ff808080ff080808',
  diagBrick: '0102040818244281',
  solidDmnd: '10387cfe7c381000',
  openDmnd: '8244281028448201',
  dotDmnd: '8000220008002200',
  plaid: 'aa55aa55f0f0f0f0',
  sphere: '77898f8f7798f8f8',
  weave: '8854224588142251',
  divot: '0010081000800180',
  shingle: '038448300c020101',
  wave: '001825c0001825c0',
  trellis: 'ff66ff99ff66ff99',
  zigZag: '8142241881422418',
}
function geometry(pattern) {
  const source = geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry
  return { ...source, width: 952500, height: 762000, style: { fill: { pattern } } }
}
const options = {
  width: 100,
  height: 80,
  fill: 'none',
  stroke: 'none',
  strokeWidth: 0,
  occurrenceMatrix: [1, 0, 0, 1, 285750, 381000],
}
describe('native pattern paint and shared SVG', () => {
  it.each([
    [
      'dnDiag',
      'e93f00000000003f3fe93f0000000000003fe93f0000000000003fe93f0000000000003fe93f0000000000003fe93f0000000000003fe93f3f00000000003fe9',
    ],
    [
      'upDiag',
      '3f00000000003fe900000000003fe93f000000003fe93f000000003fe93f000000003fe93f000000003fe93f000000003fe93f0000000000e93f00000000003f',
    ],
    [
      'diagCross',
      'e93f000000003fe93fe93f00003fe93f003fe93f3fe93f0000003fe9e93f000000003fe9e93f0000003fe93f3fe93f003fe93f00003fe93fe93f000000003fe9',
    ],
  ])(
    'retains native EMF+ weighted hatch coverage separately from the fallback brush for %s',
    (preset, gray) => {
      const source = { preset }
      const paint = patternCore.patternPaint(source)
      expect(paint.mask).toBe(masks[preset])
      expect(paint.coverage).toEqual(
        gray.match(/../g).map((hex) => {
          const value = parseInt(hex, 16)
          return value === 233 ? Math.SQRT2 - 0.5 : value === 63 ? 0.25 : value === 0 ? 0 : 1
        })
      )
      expect(source).toEqual({ preset })
    }
  )
  it('renders native antialiased diagonal brush colors as editable vector cells', () => {
    const source = geometry({
      preset: 'diagCross',
      foreground: { kind: 'srgb', value: 'F01E3C' },
      background: { kind: 'srgb', value: '1E50F0' },
    })
    const before = structuredClone(source)
    const svg = svgCore.geometrySvgPathsString(source, options)
    for (const color of ['DD224B', '5243C3', '1E50F0'])
      expect(svg).toContain(`fill="#${color}" fill-opacity="1"`)
    expect(svg).not.toContain('fill="#F01E3C"')
    expect(svg).not.toMatch(/<image|data:image|<filter/)
    expect(source).toEqual(before)
  })
  it.each([
    [50000, 0, 'EE1C3B', 117, 'EF1838', 32],
    [50000, 100000, 'CF2559', 138, '3B48D6', 223],
    [100000, 50000, 'E61F44', 244, '723BA8', 159],
  ])(
    'preserves native premultiplied hatch coverage with foreground alpha%s/background alpha%s',
    (foregroundAlpha, backgroundAlpha, highRgb, highAlpha, lowRgb, lowAlpha) => {
      const source = geometry({
        preset: 'diagCross',
        foreground: {
          kind: 'srgb',
          value: 'F01E3C',
          transforms: [{ kind: 'alpha', value: foregroundAlpha }],
        },
        background: {
          kind: 'srgb',
          value: '1E50F0',
          transforms: [{ kind: 'alpha', value: backgroundAlpha }],
        },
      })
      const svg = svgCore.geometrySvgPathsString(source, options)
      expect(svg).toContain(`fill="#${highRgb}" fill-opacity="${highAlpha / 255}"`)
      expect(svg).toContain(`fill="#${lowRgb}" fill-opacity="${lowAlpha / 255}"`)
      expect(svg).not.toMatch(/<rect|<image|<filter/)
    }
  )
  it('quantizes alpha only in derived paint and keeps foreground/background coverage separate', () => {
    const pattern = {
      preset: 'pct50',
      foreground: { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'alpha', value: 50000 }] },
      background: { kind: 'srgb', value: '0000FF', transforms: [{ kind: 'alpha', value: 0 }] },
    }
    const before = structuredClone(pattern)
    const paint = patternCore.patternPaint(pattern)
    expect(paint.foreground.alpha).toBe(128 / 255)
    expect(paint.background.alpha).toBe(0)
    const svg = svgCore.geometrySvgPathsString(geometry(pattern), options)
    expect(svg).toContain(`fill="#FF0000" fill-opacity="${128 / 255}"`)
    expect(svg).toContain('fill="#0000FF" fill-opacity="0"')
    expect(svg).not.toContain('<rect')
    expect(pattern).toEqual(before)
  })
  it.each(Object.entries(masks))('derives the genuine native 8x8 brush for %s', (preset, mask) => {
    const source = {
      preset,
      foreground: { kind: 'srgb', value: 'FE1739' },
      background: { kind: 'srgb', value: '17DDFE' },
    }
    const before = structuredClone(source)
    const paint = patternCore.patternPaint(source)
    expect(paint).toMatchObject({
      mask,
      foreground: { rgb: 'FE1739' },
      background: { rgb: '17DDFE' },
    })
    if (!['dnDiag', 'upDiag', 'diagCross'].includes(preset))
      expect(paint.coverage).toEqual(
        mask
          .match(/../g)
          .flatMap((hex) => Array.from({ length: 8 }, (_, x) => (parseInt(hex, 16) >> (7 - x)) & 1))
      )
    expect(source).toEqual(before)
  })
  it('applies observed defaults only in derived paint', () => {
    const source = {}
    expect(patternCore.patternPaint(source)).toMatchObject({
      mask: masks.pct5,
      foreground: { rgb: '000000' },
      background: { rgb: 'FFFFFF' },
    })
    expect(source).toEqual({})
  })
  it('uses vectors with slide-relative phase and no embedded image', () => {
    const source = geometry({ preset: 'dnDiag' })
    const before = structuredClone(source)
    const svg = svgCore.geometrySvgPathsString(source, options)
    expect(svg).toContain('<pattern')
    expect(svg).toContain('patternUnits="userSpaceOnUse"')
    expect(svg).toContain('patternTransform="matrix(9525 0 0 9525 -285750 -381000)"')
    expect(svg).not.toMatch(/<image|data:image|<filter/)
    expect(geometryCore.geometryFillPaint(source).fill).toMatch(/^url\(#pptx-pattern-[\da-f]+\)$/)
    expect(source).toEqual(before)
  })
  it('keeps document tile scale when native outline changes SVG path coordinates', () => {
    const source = geometry({ preset: 'dnDiag' })
    source.style.stroke = { color: { kind: 'srgb', value: '123456' }, width: 9525 }
    const svg = svgCore.geometrySvgPathsString(source, options)
    expect(svg).toContain('patternTransform="matrix(1 0 0 1 -30 -40)"')
  })
  it('cancels occurrence reflection and changes definition identity with phase', () => {
    const source = geometry({ preset: 'dnDiag' })
    const first = svgCore.geometrySvgPathsString(source, options)
    const reflected = svgCore.geometrySvgPathsString(source, {
      ...options,
      occurrenceMatrix: [-1, 0, 0, 1, 1238250, 381000],
    })
    expect(reflected).toContain('patternTransform="matrix(-9525 0 0 9525 1238250 -381000)"')
    expect(first.match(/<pattern id="([^"]+)"/)[1]).not.toBe(
      reflected.match(/<pattern id="([^"]+)"/)[1]
    )
  })
  it('materializes shaded pattern paths without rewriting source paint', () => {
    const source = geometry({ preset: 'pct5' })
    source.paths = source.paths.map((path) => ({ ...path, fill: 'darken' }))
    const before = structuredClone(source)
    const normalized = geometryCore.normalizeGeometryDocument(source)
    expect(normalized.style.fill.pattern).toEqual({ preset: 'pct5' })
    expect(normalized.paths.map((path) => path.fill)).toEqual(source.paths.map(() => 'darken'))
    expect(source).toEqual(before)
  })
  it('rejects an unrecognized pattern path modifier during materialization', () => {
    const source = geometry({ preset: 'pct5' })
    source.paths = source.paths.map((path) => ({ ...path, fill: 'brighten' }))
    expect(() => geometryCore.normalizeGeometryDocument(source)).toThrow()
  })
  it('preserves paint identity across durable storage key reordering while retaining transform order', () => {
    const patternA = {
      preset: 'pct50',
      background: { kind: 'srgb', value: 'FFFFFF' },
      foreground: {
        kind: 'srgb',
        value: '123456',
        transforms: [
          { kind: 'tint', value: 20000 },
          { kind: 'alpha', value: 50000 },
        ],
      },
    }
    const patternB = {
      foreground: {
        transforms: [
          { kind: 'tint', value: 20000 },
          { kind: 'alpha', value: 50000 },
        ],
        value: '123456',
        kind: 'srgb',
      },
      preset: 'pct50',
      background: { value: 'FFFFFF', kind: 'srgb' },
    }
    const patternC = {
      ...patternA,
      foreground: {
        ...patternA.foreground,
        transforms: [
          { kind: 'alpha', value: 50000 },
          { kind: 'tint', value: 20000 },
        ],
      },
    }
    const idA = patternCore.patternPaintId(geometry(patternA), options)
    const idB = patternCore.patternPaintId(geometry(patternB), options)
    const idC = patternCore.patternPaintId(geometry(patternC), options)
    expect(idA).toBe(idB)
    expect(idA).not.toBe(idC)
  })
})
