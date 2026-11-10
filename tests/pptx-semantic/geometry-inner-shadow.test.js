// Synthetic contract evidence only; native pixels and app qualification are separate.
import { describe, expect, it } from 'vitest'
import geometryModule from '../../shared/src/pptx-geometry-document.js'
import effectModule from '../../shared/src/pptx-geometry-effects.js'
import svgModule from '../../shared/src/pptx-geometry-svg.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture.js'

const shadow = (patch = {}) => ({
  kind: 'innerShdw',
  color: { kind: 'srgb', value: '123456', transforms: [{ kind: 'alpha', value: 50000 }] },
  blurRad: 28575,
  dist: 152400,
  dir: 0,
  ...patch,
})
const geometry = (effect = shadow()) => ({
  ...geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry,
  style: { effects: { kind: 'list', effects: [effect] } },
})
const linked = () => {
  const document = inheritedGeometryStyleFixture()
  document.styles.provider.payload.properties.effects = authored({
    kind: 'list',
    effects: [authored({
      kind: 'innerShdw',
      color: authored({ kind: 'scheme', value: 'accent1' }),
      dist: authored(152400),
      dir: authored(0),
    })],
  })
  return document
}
const options = {
  width: 100, height: 80, bounds: [-10, -10, 110, 90],
  ink: '<path d="M0 0H100V80H0Z" fill="#abcdef" fill-opacity=".4"/>',
}

describe('typed inner shadow', () => {
  it('normalizes and edits native values without changing source JSON or paths', () => {
    const source = geometry()
    const before = JSON.stringify(source)
    const normalized = geometryModule.normalizeGeometryDocument(source)
    expect(geometryModule.geometryInnerShadow(normalized)).toEqual(shadow())
    expect(geometryModule.geometryOuterShadow(normalized)).toBeNull()
    const changed = geometryModule.editGeometryDocument(source, {
      type: 'inner-shadow', shadow: shadow({ dist: 0, dir: 21599999 }),
    })
    expect(changed.paths).toEqual(source.paths)
    expect(changed.style.effects.effects[0].dist).toBe(0)
    const cleared = geometryModule.editGeometryDocument(changed, { type: 'inner-shadow', shadow: null })
    expect(cleared.style.effects).toEqual({ kind: 'list', effects: [] })
    expect(JSON.stringify(source)).toBe(before)
  })

  it.each([
    { blurRad: -1 }, { blurRad: 27273042316901 }, { dist: -1 }, { dist: 0.1 },
    { dir: 21600000 }, { dir: '0' }, { sx: 100000 }, { sy: 100000 },
    { kx: 0 }, { algn: 'ctr' }, { rotWithShape: true },
    { color: { kind: 'none' } }, { kind: 'glow' },
  ])('rejects malformed or outer-only fields atomically: %j', (patch) => {
    const source = geometry()
    const before = JSON.stringify(source)
    expect(() => geometryModule.editGeometryDocument(source, {
      type: 'inner-shadow', shadow: shadow(patch),
    })).toThrow()
    expect(JSON.stringify(source)).toBe(before)
  })

  it('admits an ordered effect list while preserving command-kind boundaries', () => {
    const source = geometry()
    source.style.effects.effects.push(shadow({ kind: 'outerShdw' }))
    expect(geometryModule.normalizeGeometryDocument(source).style.effects).toEqual(source.style.effects)
    expect(() => geometryModule.editGeometryDocument(geometry(), {
      type: 'inner-shadow', shadow: shadow({ kind: 'outerShdw' }),
    })).toThrow()
    expect(() => geometryModule.editGeometryDocument(geometry(), {
      type: 'outer-shadow', shadow: shadow(),
    })).toThrow()
  })

  it.each([false, true])('resolves inherited colors and preserves source JSON (matrix=%s)', (matrix) => {
    const source = linked()
    if (matrix) {
      const theme = 'ppt/theme/theme1.xml', wrap = (value) => authored(value, theme)
      const effects = wrap({ kind: 'list', effects: [wrap({
        kind: 'innerShdw', color: wrap({ kind: 'scheme', value: 'phClr' }), dist: wrap(152400),
      })] })
      source.styles.theme.payload.effectStyles = [wrap({ effects })]
      const provider = source.styles.provider.payload
      delete provider.properties.effects
      provider.styleRefs.effectRef = authored({
        index: 1, color: authored({ kind: 'scheme', value: 'accent1' }),
      })
      for (const key of ['context1', 'context2']) source.styles[key].payload.matrixBindings.effectRef = {
        declarationId: 'provider', index: 1, themeId: 'theme', list: 'effectStyles',
        entryIndex: 0, source: source.styles.theme.payload.effectStyles[0].source,
      }
    }
    const before = JSON.stringify(source)
    const normalized = semantic.normalizePptxSemanticDocument(source)
    const first = resolution.materializeGeometry(normalized, 'i1')
    const second = resolution.materializeGeometry(normalized, 'i2')
    expect(first.style.effects.effects[0]).toMatchObject({ kind: 'innerShdw', color: { value: 'FF0000' } })
    expect(second.style.effects.effects[0].color.value).toBe('00FF00')
    expect(resolution.resolveGeometryStyle(normalized, 'i1').properties.effects.dependencyIds)
      .toContain('theme:colors.accent2')
    const reopened = semantic.normalizePptxSemanticDocument(JSON.parse(JSON.stringify(normalized)))
    expect(resolution.materializeGeometry(reopened, 'i1')).toEqual(first)
    first.style.effects.effects[0].color.value = '000000'
    expect(JSON.stringify(source)).toBe(before)
  })

  it('keeps occurrence shadow overrides and explicit empty effects separate from shared inheritance', () => {
    const source = linked()
    const definitions = JSON.stringify(source.definitions)
    const styles = JSON.stringify(source.styles)
    source.instances.i1.overrides.components = {
      geometry: { geometryStyle: { effects: { kind: 'list', effects: [shadow({ dist: 0 })] } } },
    }
    let normalized = semantic.normalizePptxSemanticDocument(source)
    expect(resolution.materializeGeometry(normalized, 'i1').style.effects.effects[0].dist).toBe(0)
    expect(resolution.materializeGeometry(normalized, 'i2').style.effects.effects[0].dist).toBe(152400)
    source.instances.i1.overrides.components.geometry.geometryStyle.effects.effects = []
    normalized = semantic.normalizePptxSemanticDocument(source)
    expect(resolution.materializeGeometry(normalized, 'i1').style.effects.effects).toEqual([])
    expect(JSON.stringify(source.definitions)).toBe(definitions)
    expect(JSON.stringify(source.styles)).toBe(styles)
  })

  it('rejects invalid inner fields in both source wrappers and sparse overrides', () => {
    const source = linked()
    source.styles.provider.payload.properties.effects.value.effects[0].value.rotWithShape = authored(false)
    expect(() => semantic.normalizePptxSemanticDocument(source)).toThrow()
    const override = linked()
    override.instances.i1.overrides.components = {
      geometry: { geometryStyle: { effects: { kind: 'list', effects: [shadow({ sx: 1 })] } } },
    }
    expect(() => semantic.normalizePptxSemanticDocument(override)).toThrow()
  })
})

describe('inner shadow derived compositing', () => {
  it('colors the inverse shifted alpha atop original ink, preserving its alpha and holes', () => {
    const result = effectModule.geometryShadowSvg(geometry(), options)
    expect(result).toContain('data-pptx-geometry-inner-shadow="geometry"')
    expect(result).toContain('<feGaussianBlur in="SourceAlpha" stdDeviation="1" result="blur"/>')
    expect(result).toContain('<feOffset in="blur" dx="16" dy="0" result="offset"/>')
    expect(result).toContain('flood-color="#123456" flood-opacity="0.5"')
    expect(result).toContain('<feComposite in="color" in2="offset" operator="out" result="shadow"/>')
    expect(result).toContain('<feComposite in="shadow" in2="SourceGraphic" operator="atop"/>')
    expect(result.split(options.ink)).toHaveLength(2)
    expect(result).not.toContain('data-pptx-geometry-shadow=')
  })

  it.each([
    [-2, 0, 0, 0.5, 100, 80],
    [0, -2, -0.5, 0, 0, 0],
    [1, 0.5, 0.2, 2, 0, 0],
  ])('keeps local direction and native distance under occurrence transform %j', (...matrix) => {
    const result = effectModule.geometryShadowSvg(geometry(shadow({ dir: 2700000 })), {
      ...options, occurrenceMatrix: matrix,
    })
    const [, x, y] = result.match(/<feOffset in="blur" dx="([^"]+)" dy="([^"]+)"/)
    const dx = Number(x), dy = Number(y)
    expect(dx).toBeCloseTo(dy, 10)
    expect(Math.hypot(matrix[0] * dx + matrix[2] * dy, matrix[1] * dx + matrix[3] * dy))
      .toBeCloseTo(16, 10)
  })

  it('keeps zero native values explicit and filter IDs deterministic', () => {
    const source = geometry(shadow({ dist: 0, blurRad: 0, dir: 0 }))
    const first = effectModule.geometryShadowSvg(source, options)
    expect(first).toContain('stdDeviation="0"')
    expect(first).toContain('dx="0" dy="0"')
    expect(effectModule.geometryShadowSvg(source, options)).toBe(first)
    const defaults = effectModule.geometryShadowSvg(geometry({
      kind: 'innerShdw', color: { kind: 'srgb', value: '000000' },
    }), options)
    expect(defaults).toContain('stdDeviation="0"')
    expect(defaults).toContain('dx="0" dy="0"')
  })

  it('routes derived filled and stroked geometry through one combined interior mask', () => {
    const source = geometry()
    const before = JSON.stringify(source)
    const result = svgModule.geometrySvgPathsString(source, {
      width: 100, height: 80, fill: '#abcdef', stroke: '#123456', strokeWidth: 2,
    })
    expect(result).toContain('data-pptx-geometry-inner-shadow="geometry"')
    expect(result.match(/data-pptx-geometry-path=/g)).toHaveLength(1)
    expect(JSON.stringify(source)).toBe(before)
  })
})
