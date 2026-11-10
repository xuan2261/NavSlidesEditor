// Synthetic source/renderer contracts, not native glow pixel qualification.
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import geometryModule from '../../shared/src/pptx-geometry-document.js'
import effects from '../../shared/src/pptx-geometry-effects.js'
import svg from '../../shared/src/pptx-geometry-svg.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture.js'

const glow = (patch = {}) => ({
  kind: 'glow', color: { kind: 'srgb', value: 'FF0000' }, rad: 114300, ...patch,
})
const geometry = (effect = glow()) => ({
  ...geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry,
  style: { effects: { kind: 'list', effects: [effect] } },
})
const linked = () => {
  const document = inheritedGeometryStyleFixture()
  document.styles.provider.payload.properties.effects = authored({
    kind: 'list', effects: [authored({
      kind: 'glow', color: authored({ kind: 'scheme', value: 'accent1' }), rad: authored(114300),
    })],
  })
  return document
}
const options = {
  width: 100, height: 80, bounds: [0, 0, 100, 80],
  ink: '<path d="M0 0H100V80H0Z" fill="#abcdef"/>',
}

describe('bounded typed glow', () => {
  it.each([undefined, 0, 27273042316900])('preserves authored radius %s through normalization and edit', (rad) => {
    const effect = { kind: 'glow', color: { kind: 'srgb', value: '123456' }, ...(rad === undefined ? {} : { rad }) }
    const source = geometry(effect), before = JSON.stringify(source)
    expect(geometryModule.GLOW_RANGES.rad).toEqual([0, 27273042316900])
    const normalized = geometryModule.normalizeGeometryDocument(source)
    expect(geometryModule.geometryGlow(normalized)).toEqual(effect)
    expect(geometryModule.geometryOuterShadow(normalized)).toBeNull()
    expect(geometryModule.geometryInnerShadow(normalized)).toBeNull()
    const edited = geometryModule.editGeometryDocument(source, { type: 'glow', glow: effect })
    expect(edited.paths).toEqual(source.paths)
    expect(edited.style.effects.effects).toEqual([effect])
    expect(geometryModule.editGeometryDocument(edited, { type: 'glow', glow: null }).style.effects)
      .toEqual({ kind: 'list', effects: [] })
    expect(JSON.stringify(source)).toBe(before)
  })

  it.each([
    { rad: -1 }, { rad: 27273042316901 }, { rad: 1.5 }, { rad: '1' },
    { blurRad: 1 }, { dist: 1 }, { dir: 0 }, { sx: 100000 }, { rotWithShape: true },
    { color: { kind: 'none' } }, { kind: 'innerShdw' }, { arbitrary: 1 },
  ])('rejects malformed glow atomically: %j', (patch) => {
    const source = geometry(), before = JSON.stringify(source)
    expect(() => geometryModule.editGeometryDocument(source, { type: 'glow', glow: glow(patch) })).toThrow()
    expect(JSON.stringify(source)).toBe(before)
  })

  it('enforces one effect and exact command fields', () => {
    const source = geometry()
    source.style.effects.effects.push(glow())
    expect(() => geometryModule.normalizeGeometryDocument(source)).toThrow()
    expect(() => geometryModule.editGeometryDocument(geometry(), { type: 'glow', shadow: glow() })).toThrow()
    expect(() => geometryModule.editGeometryDocument(geometry(), { type: 'outer-shadow', shadow: glow() })).toThrow()
  })

  it.each([false, true])('resolves symbolic inherited color without changing source/siblings (matrix=%s)', (matrix) => {
    const source = linked()
    if (matrix) {
      const wrap = (value) => authored(value, 'ppt/theme/theme1.xml')
      source.styles.theme.payload.effectStyles = [wrap({ effects: wrap({
        kind: 'list', effects: [wrap({ kind: 'glow', color: wrap({
          kind: 'scheme', value: 'phClr', transforms: [wrap({ kind: 'alpha', value: 50000 })],
        }) })],
      }) })]
      delete source.styles.provider.payload.properties.effects
      source.styles.provider.payload.styleRefs.effectRef = authored({
        index: 1, color: authored({ kind: 'scheme', value: 'accent1' }),
      })
      for (const key of ['context1', 'context2']) source.styles[key].payload.matrixBindings.effectRef = {
        declarationId: 'provider', index: 1, themeId: 'theme', list: 'effectStyles',
        entryIndex: 0, source: source.styles.theme.payload.effectStyles[0].source,
      }
    }
    const before = JSON.stringify(source)
    const document = semantic.normalizePptxSemanticDocument(source)
    const first = resolution.materializeGeometry(document, 'i1')
    expect(first.style.effects.effects[0].color.value).toBe('FF0000')
    expect(resolution.materializeGeometry(document, 'i2').style.effects.effects[0].color.value).toBe('00FF00')
    if (matrix) expect(first.style.effects.effects[0].color.transforms).toEqual([{ kind: 'alpha', value: 50000 }])
    expect(resolution.materializeGeometry(semantic.normalizePptxSemanticDocument(JSON.parse(JSON.stringify(document))), 'i1')).toEqual(first)
    expect(resolution.resolveGeometryStyle(document, 'i1').properties.effects.dependencyIds).toContain('theme:colors.accent2')
    expect(JSON.stringify(source)).toBe(before)
  })

  it('validates sparse overrides and explicit suppression without modifying shared source', () => {
    const source = linked(), definitions = JSON.stringify(source.definitions), styles = JSON.stringify(source.styles)
    source.instances.i1.overrides.components = {
      geometry: { geometryStyle: { effects: { kind: 'list', effects: [glow({ rad: 0 })] } } },
    }
    const first = semantic.normalizePptxSemanticDocument(source)
    expect(resolution.materializeGeometry(first, 'i1').style.effects.effects[0].rad).toBe(0)
    expect(resolution.materializeGeometry(first, 'i2').style.effects.effects[0].rad).toBe(114300)
    source.instances.i1.overrides.components.geometry.geometryStyle.effects.effects = []
    expect(resolution.materializeGeometry(semantic.normalizePptxSemanticDocument(source), 'i1').style.effects.effects).toEqual([])
    source.instances.i1.overrides.components.geometry.geometryStyle.effects.effects = [glow({ rad: -1 })]
    expect(() => semantic.normalizePptxSemanticDocument(source)).toThrow()
    expect(JSON.stringify(source.definitions)).toBe(definitions)
    expect(JSON.stringify(source.styles)).toBe(styles)
  })

  it.each([{ rad: authored(-1) }, { blurRad: authored(1) }])('rejects malformed wrapped glow fields: %j', (patch) => {
    const source = linked()
    Object.assign(source.styles.provider.payload.properties.effects.value.effects[0].value, patch)
    const before = JSON.stringify(source)
    expect(() => semantic.normalizePptxSemanticDocument(source)).toThrow()
    expect(JSON.stringify(source)).toBe(before)
  })
})

describe('derived exterior glow compositor', () => {
  it('uses combined source alpha and emits original ink exactly once with deterministic filter bounds', () => {
    const source = geometry(), before = JSON.stringify(source)
    const result = effects.geometryShadowSvg(source, options)
    expect(result).toContain('data-pptx-geometry-glow="geometry"')
    expect(result).toContain('in="SourceAlpha"')
    expect(result).toContain('in2="inkCoverage" operator="out"')
    expect(result).toContain('in="SourceGraphic"')
    expect(result.split(options.ink)).toHaveLength(2)
    expect(result).toContain('x="-17" y="-17" width="134" height="114"')
    expect(effects.geometryShadowSvg(source, options)).toBe(result)
    expect(JSON.stringify(source)).toBe(before)
    expect(svg.geometrySvgPathsString(source, { width: 100, height: 80, fill: '#abcdef', stroke: '#123456', strokeWidth: 2 }))
      .toContain('data-pptx-geometry-glow="geometry"')
  })

  it.each([0, undefined])('zero or absent radius adds no exterior ink: %s', (rad) => {
    const effect = glow()
    if (rad === undefined) delete effect.rad
    else effect.rad = rad
    expect(effects.geometryShadowSvg(geometry(effect), options)).toBe(options.ink)
  })

  it('renders exterior colored pixels while preserving solid source and a distant transparent hole', async () => {
    const ink = '<path fill="#00ff00" fill-rule="evenodd" d="M20 20H140V140H20Z M60 60V100H100V60Z"/>'
    const body = effects.geometryShadowSvg(geometry(), {
      width: 160, height: 160, bounds: [20, 20, 140, 140], ink,
    })
    const image = await loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">${body}</svg>`))
    const canvas = createCanvas(160, 160), context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixel = (x, y) => [...context.getImageData(x, y, 1, 1).data]
    expect(pixel(40, 40)).toEqual([0, 255, 0, 255])
    expect(pixel(80, 80)[3]).toBe(0)
    expect(pixel(16, 40)[0]).toBeGreaterThan(200)
    expect(pixel(16, 40)[3]).toBeGreaterThan(0)
    expect(pixel(0, 0)[3]).toBe(0)
  })

  it('preserves translucent source alpha and color even beside the exterior edge', async () => {
    const ink = '<path fill="#00ff00" fill-opacity="0.4" d="M20 20H140V140H20Z"/>'
    const body = effects.geometryShadowSvg(geometry(), {
      width: 160, height: 160, bounds: [20, 20, 140, 140], ink,
    })
    const render = async (content) => {
      const image = await loadImage(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">${content}</svg>`))
      const canvas = createCanvas(160, 160), context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return context
    }
    const baseline = await render(ink), painted = await render(body)
    for (const x of [20, 21, 30, 80]) {
      expect([...painted.getImageData(x, 80, 1, 1).data])
        .toEqual([...baseline.getImageData(x, 80, 1, 1).data])
    }
    expect(painted.getImageData(16, 80, 1, 1).data[3]).toBeGreaterThan(0)
  })
})
