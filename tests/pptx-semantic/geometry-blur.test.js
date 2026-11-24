// Synthetic derived blur behavior, not native kernel/units/grow qualification.
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import model from '../../shared/src/pptx-geometry-document.js'
import effects from '../../shared/src/pptx-geometry-effects.js'
import svg from '../../shared/src/pptx-geometry-svg.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture.js'
const normalize = semantic.normalizePptxSemanticDocument
const materialize = resolution.materializeGeometry
const edit = model.editGeometryDocument
const blur = (patch = {}) => ({ kind: 'blur', rad: 114300, ...patch })
const geometry = (effect = blur()) => ({
  ...geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry,
  style: { effects: { kind: 'list', effects: [effect] } },
})
const paint = effects.geometryShadowSvg
const options = {
  width: 160,
  height: 160,
  fill: '#00ff00',
  stroke: 'none',
  strokeWidth: 0,
  bounds: [20, 20, 140, 140],
  ink: '<path fill="#00ff00" d="M20 20H140V140H20Z"/>',
}
const render = async (body) => {
  const image = await loadImage(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">${body}</svg>`)
  )
  const canvas = createCanvas(160, 160),
    context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  return (x, y) => [...context.getImageData(x, y, 1, 1).data]
}
const linked = (matrix, effect) => {
  const document = inheritedGeometryStyleFixture()
  const wrapped = (wrap) => {
    const entry = { kind: effect.kind }
    for (const [key, value] of Object.entries(effect)) if (key !== 'kind') entry[key] = wrap(value)
    return wrap({ kind: 'list', effects: [wrap(entry)] })
  }
  if (!matrix) document.styles.provider.payload.properties.effects = wrapped(authored)
  else {
    const wrap = (value) => authored(value, 'ppt/theme/theme1.xml')
    document.styles.theme.payload.effectStyles = [wrap({ effects: wrapped(wrap) })]
    delete document.styles.provider.payload.properties.effects
    document.styles.provider.payload.styleRefs.effectRef = authored({
      index: 1,
      color: authored({ kind: 'scheme', value: 'accent1' }),
    })
    for (const key of ['context1', 'context2'])
      document.styles[key].payload.matrixBindings.effectRef = {
        declarationId: 'provider',
        index: 1,
        themeId: 'theme',
        list: 'effectStyles',
        entryIndex: 0,
        source: document.styles.theme.payload.effectStyles[0].source,
      }
  }
  return document
}
describe('typed color-free native blur model', () => {
  it.each([{}, { rad: 0 }, { rad: 27273042316900 }, { grow: false }, { grow: true }])(
    'preserves exact optional attributes and immutable edits: %j',
    (patch) => {
      const effect = { kind: 'blur', ...patch },
        source = geometry(effect)
      const before = structuredClone(source)
      expect(model.BLUR_RANGES.rad).toEqual([0, 27273042316900])
      const normalized = model.normalizeGeometryDocument(source)
      expect(model.geometryBlur(normalized)).toEqual(effect)
      for (const getter of ['OuterShadow', 'InnerShadow', 'Glow', 'SoftEdge'])
        expect(model['geometry' + getter](normalized)).toBeNull()
      const next = edit(source, { type: 'blur', blur: effect })
      expect(next.style.effects.effects).toEqual([effect])
      expect(edit(next, { type: 'blur', blur: null }).style.effects.effects).toEqual([])
      expect(source).toEqual(before)
    }
  )
  it.each([
    { rad: -1 },
    { rad: 27273042316901 },
    { rad: 1.5 },
    { rad: '1' },
    { grow: 0 },
    { grow: 'true' },
    { grow: null },
    { color: { kind: 'srgb', value: '123456' } },
    { blurRad: 1 },
    { rotWithShape: true },
    { arbitrary: 1 },
    { kind: 'softEdge' },
  ])('rejects invalid edits atomically: %j', (patch) => {
    const source = geometry(),
      before = structuredClone(source)
    expect(() => edit(source, { type: 'blur', blur: blur(patch) })).toThrow()
    expect(source).toEqual(before)
  })
  it('keeps one-effect limit and rejects wrong command fields', () => {
    const source = geometry()
    source.style.effects.effects.push(blur())
    expect(() => model.normalizeGeometryDocument(source)).toThrow()
    expect(() => edit(geometry(), { type: 'blur', softEdge: blur() })).toThrow()
  })
  it.each([false, true])('reopens color-free effects (matrix=%s)', (matrix) => {
    const source = linked(matrix, blur({ grow: false })),
      before = structuredClone(source)
    const normalized = normalize(source)
    const first = materialize(normalized, 'i1')
    expect(first.style.effects.effects).toEqual([blur({ grow: false })])
    expect(materialize(normalize(JSON.parse(JSON.stringify(normalized))), 'i1')).toEqual(first)
    expect(source).toEqual(before)
  })
  it.each([{}, { rad: 0 }, { grow: false }, { grow: true }, null])(
    'retains sparse override, source graph and sibling: %j',
    (patch) => {
      const source = inheritedGeometryStyleFixture(),
        before = structuredClone(source)
      const effect = patch === null ? null : { kind: 'blur', ...patch }
      const next = structuredClone(source)
      next.instances.i1.overrides.components = {
        geometry: { geometryStyle: { effects: { kind: 'list', effects: effect ? [effect] : [] } } },
      }
      const reopened = normalize(JSON.parse(JSON.stringify(next)))
      expect(materialize(reopened, 'i1').style.effects.effects).toEqual(effect ? [effect] : [])
      expect(materialize(reopened, 'i2')).toEqual(materialize(source, 'i2'))
      expect(next.definitions).toEqual(before.definitions)
      expect(next.styles).toEqual(before.styles)
      expect(source).toEqual(before)
    }
  )
  it('rejects invalid wrapped grow and radius', () => {
    for (const effect of [
      blur({ grow: 1 }),
      blur({ rad: -1 }),
      blur({ color: { kind: 'srgb', value: '123456' } }),
    ])
      expect(() => normalize(linked(false, effect))).toThrow()
  })
})
describe('derived Gaussian blur paint', () => {
  it.each([{}, { rad: 0, grow: false }])(
    'keeps absent/zero radius paint identical: %j',
    (patch) => {
      expect(paint(geometry({ kind: 'blur', ...patch }), options)).toBe(options.ink)
    }
  )
  it('filters combined source color once with deterministic vector paint', () => {
    const source = geometry(),
      before = structuredClone(source),
      body = paint(source, options)
    expect(body).toContain('data-pptx-geometry-blur="geometry"')
    expect(body).toContain('in="SourceGraphic"')
    expect(body).not.toContain('<image')
    expect(body.split(options.ink)).toHaveLength(2)
    expect(paint(source, options)).toBe(body)
    expect(svg.geometrySvgPathsString(source, options)).toContain('data-pptx-geometry-blur')
    expect(source).toEqual(before)
  })
  it.each([1, 0.4])('blurs colored alpha and transparent hole boundaries: %s', async (alpha) => {
    const ink = `<path fill="#00ff00" fill-opacity="${alpha}" fill-rule="evenodd" d="M20 20H140V140H20Z M60 60V100H100V60Z"/>`
    const baseline = await render(ink),
      blurred = await render(paint(geometry(), { ...options, ink }))
    expect(blurred(40, 40)).toEqual(baseline(40, 40))
    expect(blurred(16, 40)[3]).toBeGreaterThan(0)
    expect(blurred(20, 40)[3]).toBeLessThan(baseline(20, 40)[3])
    expect(blurred(16, 40).slice(0, 3)).toEqual([0, 255, 0])
    expect(blurred(61, 80)[3]).toBeGreaterThan(0)
    expect(blurred(80, 80)[3]).toBe(0)
  })
  it('distinguishes derived grow=false clipping from absent/true support', async () => {
    const absent = await render(paint(geometry(), options))
    const grown = await render(paint(geometry(blur({ grow: true })), options))
    const clipped = await render(paint(geometry(blur({ grow: false })), options))
    expect(absent(16, 80)).toEqual(grown(16, 80))
    expect(grown(16, 80)[3]).toBeGreaterThan(0)
    expect(clipped(16, 80)[3]).toBe(0)
    expect(clipped(20, 80)[3]).toBeGreaterThan(0)
  })
  it('retains transformed exterior ink and anisotropic blur bounds', async () => {
    const body = paint(geometry(), {
      ...options,
      bounds: [30, 30, 120, 50],
      occurrenceMatrix: [0, 1, -0.5, 0, 140, 0],
      ink: '<path d="M30 40H120" stroke="#0000ff" stroke-width="20" fill="none"/>',
    })
    const blurred = await render(`<g transform="matrix(0 1 -0.5 0 140 0)">${body}</g>`)
    expect(blurred(120, 70)[3]).toBeGreaterThan(240)
    expect(blurred(127, 70)[3]).toBeGreaterThan(0)
    expect(blurred(127, 70).slice(0, 3)).toEqual([0, 0, 255])
    expect(blurred(135, 70)[3]).toBe(0)
  })
})
