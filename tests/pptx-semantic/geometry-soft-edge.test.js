// Synthetic vector behavior only; not native soft-edge qualification.
import { describe, expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import model from '../../shared/src/pptx-geometry-document.js'
import effects from '../../shared/src/pptx-geometry-effects.js'
import svg from '../../shared/src/pptx-geometry-svg.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import resolution from '../../shared/src/pptx-geometry-style-resolution.js'
import operation from '../../shared/src/pptx-projection-operation.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture, authored } from './geometry-style-fixture.js'

const { normalizePptxSemanticDocument: normalize } = semantic
const { materializeGeometry: materialize } = resolution
const edit = model.editGeometryDocument
const paint = effects.geometryShadowSvg
const edge = (rad = 114300) => ({ kind: 'softEdge', ...(rad === undefined ? {} : { rad }) })
const geometry = (effect = edge()) => ({
  ...geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry,
  style: { effects: { kind: 'list', effects: [effect] } },
})
const linked = (matrix = false) => {
  const document = inheritedGeometryStyleFixture()
  document.styles.provider.payload.properties.effects = authored({
    kind: 'list',
    effects: [authored({ kind: 'softEdge', rad: authored(114300) })],
  })
  if (matrix) {
    const wrap = (value) => authored(value, 'ppt/theme/theme1.xml')
    document.styles.theme.payload.effectStyles = [
      wrap({
        effects: wrap({ kind: 'list', effects: [wrap({ kind: 'softEdge' })] }),
      }),
    ]
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
const apply = (presentation, softEdge) =>
  operation.applyPresentationProjectionOperation(presentation, {
    type: capabilities.GEOMETRY_EDIT,
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'soft-edge', softEdge },
  })
const options = {
  fill: '#abcdef',
  stroke: '#123456',
  strokeWidth: 2,
  width: 160,
  height: 160,
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

describe('typed soft-edge source and occurrence intent', () => {
  it.each([{}, { rad: 0 }, { rad: 27273042316900 }])('preserves optional radius: %j', (patch) => {
    const effect = { kind: 'softEdge', ...patch },
      source = geometry(effect)
    const before = structuredClone(source)
    expect(model.SOFT_EDGE_RANGES.rad).toEqual([0, 27273042316900])
    const normalized = model.normalizeGeometryDocument(source)
    expect(model.geometrySoftEdge(normalized)).toEqual(effect)
    expect(model.geometryGlow(normalized)).toBeNull()
    expect(model.geometryOuterShadow(normalized)).toBeNull()
    expect(model.geometryInnerShadow(normalized)).toBeNull()
    const edited = edit(source, { type: 'soft-edge', softEdge: effect })
    expect(edited.style.effects.effects).toEqual([effect])
    expect(edit(edited, { type: 'soft-edge', softEdge: null }).style.effects.effects).toEqual([])
    expect(source).toEqual(before)
  })
  it.each([
    { rad: -1 },
    { rad: 27273042316901 },
    { rad: 1.5 },
    { rad: '1' },
    { color: { kind: 'srgb', value: '123456' } },
    { blurRad: 1 },
    { dist: 0 },
    { rotWithShape: true },
    { arbitrary: 1 },
    { kind: 'glow' },
  ])('rejects invalid effect and command atomically: %j', (patch) => {
    const source = geometry(),
      before = structuredClone(source)
    expect(() => edit(source, { type: 'soft-edge', softEdge: { ...edge(), ...patch } })).toThrow()
    expect(source).toEqual(before)
  })
  it('rejects multiple effects and wrong command fields', () => {
    const source = geometry()
    source.style.effects.effects.push(edge())
    expect(() => model.normalizeGeometryDocument(source)).toThrow()
    expect(() => edit(geometry(), { type: 'soft-edge', shadow: edge() })).toThrow()
  })
  it.each([false, true])('reopens color-free source (matrix=%s)', (matrix) => {
    const source = linked(matrix),
      before = structuredClone(source)
    const normalized = normalize(source)
    const first = materialize(normalized, 'i1')
    expect(first.style.effects.effects).toEqual([matrix ? { kind: 'softEdge' } : edge()])
    expect(materialize(normalize(JSON.parse(JSON.stringify(normalized))), 'i1')).toEqual(first)
    expect(source).toEqual(before)
  })
  it.each([{}, { rad: 0 }, { rad: 19050 }, null])('reopens sparse intent: %j', (patch) => {
    const source = {
      ...geometryProjectionFixture(),
      pptxSemantic: inheritedGeometryStyleFixture(),
    }
    const before = structuredClone(source),
      effect = patch === null ? null : { kind: 'softEdge', ...patch }
    const sibling = materialize(normalize(source.pptxSemantic), 'i2')
    const next = apply(source, effect)
    const override = next.pptxSemantic.instances.i1.overrides.components.geometry
    expect(override).toEqual({
      geometryStyle: { effects: { kind: 'list', effects: effect === null ? [] : [effect] } },
    })
    const reopened = normalize(JSON.parse(JSON.stringify(next.pptxSemantic)))
    expect(materialize(reopened, 'i1').style.effects.effects).toEqual(
      effect === null ? [] : [effect]
    )
    expect(materialize(reopened, 'i2')).toEqual(sibling)
    expect(next.pptxSemantic.definitions).toEqual(source.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(source.pptxSemantic.styles)
    expect(next.pptxSemantic.instances.i2).toEqual(source.pptxSemantic.instances.i2)
    expect(source).toEqual(before)
  })
  it('rejects invalid wrapped and occurrence radius without mutation', () => {
    const source = linked()
    source.styles.provider.payload.properties.effects.value.effects[0].value.rad.value = -1
    expect(() => normalize(source)).toThrow()
    const presentation = { ...geometryProjectionFixture(), pptxSemantic: linked() }
    const before = structuredClone(presentation)
    expect(() => apply(presentation, edge(-1))).toThrow()
    expect(presentation).toEqual(before)
  })
})

describe('derived inward soft-edge vector compositor', () => {
  it.each([{}, { rad: 0 }])('leaves zero or absent radius paint identical: %j', (patch) => {
    expect(paint(geometry({ kind: 'softEdge', ...patch }), options)).toBe(options.ink)
  })
  it('emits deterministic vector filtering with original combined ink once', () => {
    const source = geometry(),
      before = structuredClone(source)
    const body = paint(source, options)
    expect(body).toContain('data-pptx-geometry-soft-edge="geometry"')
    expect(body).toContain('in="SourceAlpha"')
    expect(body).toContain('in="SourceGraphic"')
    expect(body.split(options.ink)).toHaveLength(2)
    expect(body).not.toContain('<image')
    expect(paint(source, options)).toBe(body)
    expect(svg.geometrySvgPathsString(source, options)).toContain('data-pptx-geometry-soft-edge')
    expect(source).toEqual(before)
  })
  it.each([1, 0.4])('feathers inward with source color/alpha (alpha=%s)', async (alpha) => {
    const ink = `<path fill="#00ff00" fill-opacity="${alpha}" fill-rule="evenodd" d="M20 20H140V140H20Z M60 60V100H100V60Z"/>`
    const baseline = await render(ink)
    const painted = await render(paint(geometry(), { ...options, ink }))
    expect(painted(40, 40)).toEqual(baseline(40, 40))
    expect(painted(80, 80)[3]).toBe(0)
    expect(painted(16, 40)[3]).toBe(0)
    expect(painted(20, 40)[3]).toBeGreaterThan(0)
    expect(painted(20, 40)[3]).toBeLessThan(baseline(20, 40)[3])
    expect(painted(20, 40).slice(0, 3)).toEqual([0, 255, 0])
  })
  it('feathers open strokes in an affine frame', async () => {
    const ink = '<path d="M30 30H120" stroke="#0000ff" stroke-width="20" fill="none"/>'
    const body = paint(geometry(edge(28575)), { ...options, ink })
    const painted = await render(`<g transform="matrix(0 1 -1 0 160 0)">${body}</g>`)
    expect(painted(130, 70)).toEqual([0, 0, 255, 255])
    expect(painted(121, 70)[3]).toBeLessThan(255)
    expect(painted(119, 70)[3]).toBe(0)
  })
})
