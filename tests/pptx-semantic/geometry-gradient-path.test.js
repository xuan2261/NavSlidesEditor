import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { geometryStyleFixture, authored } from './geometry-style-fixture.js'
const require = createRequire(import.meta.url)
const { normalizeGeometryDocument } = require('../../shared/src/pptx-geometry-document')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation')
const {
  materializeGeometry,
  resolveGeometryStyle,
} = require('../../shared/src/pptx-geometry-style-resolution')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { canonicalJson } = require('../../server/services/pptx-import/package-store/schemas')
const { deriveMutationJournal } = require('../../server/services/pptx-import/mutation-journal')
const stops = [
  { pos: 0, color: { kind: 'srgb', value: 'F01E3C' } },
  { pos: 100000, color: { kind: 'srgb', value: '1E50F0' } },
]
const focus = { l: 50000, t: 50000, r: 50000, b: 50000 }
const pathGradient = (path = 'circle') => ({
  kind: 'path',
  path,
  rotWithShape: true,
  stops: structuredClone(stops),
  fillToRect: { ...focus },
})
function geometry(gradient) {
  return {
    ...geometryProjectionFixture().pptxSemantic.definitions.definition.content.geometry,
    style: { fill: { gradient } },
  }
}
function sourcePresentation() {
  const presentation = geometryProjectionFixture()
  presentation.pptxSemantic = geometryStyleFixture()
  presentation.pptxSemantic.styles.provider.payload.properties.fill = authored({
    gradient: authored({
      kind: 'path',
      path: authored('circle'),
      rotWithShape: authored(true),
      fillToRect: authored(
        Object.fromEntries(Object.entries(focus).map(([key, value]) => [key, authored(value)]))
      ),
      tileRect: authored({ l: authored(-25000), r: authored(10000) }),
      stops: stops.map((stop) =>
        authored({
          pos: authored(stop.pos),
          color: authored(stop.color),
        })
      ),
    }),
  })
  return normalizeSemanticPresentation(presentation)
}

it.each(['circle', 'rect', 'shape'])(
  'preserves typed %s path gradient without invented linear parameters',
  (path) => {
    const input = geometry(pathGradient(path)),
      before = structuredClone(input)
    const normalized = normalizeGeometryDocument(input)
    expect(normalized.style.fill.gradient).toEqual(pathGradient(path))
    expect(Object.hasOwn(normalized.style.fill.gradient, 'angle')).toBe(false)
    expect(Object.hasOwn(normalized.style.fill.gradient, 'scaled')).toBe(false)
    expect(input).toEqual(before)
  }
)

it.each([
  { l: 25000, r: 25000 },
  { l: -25000, t: -10000, r: 0, b: 10000 },
])('retains exact signed linear tile rectangle %j', (tileRect) => {
  const gradient = { kind: 'linear', angle: 0, scaled: true, rotWithShape: true, stops, tileRect }
  expect(normalizeGeometryDocument(geometry(gradient)).style.fill.gradient).toEqual(gradient)
})

it('edits and reopens path geometry without changing definitions or another occurrence', () => {
  const initial = geometryProjectionFixture(),
    before = structuredClone(initial)
  const gradient = { ...pathGradient(), tileRect: { l: 25000, r: 25000 } }
  const changed = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-gradient', gradient },
  })
  expect(materializeGeometry(changed.pptxSemantic, 'i1').style.fill.gradient).toEqual(gradient)
  expect(changed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(changed.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(changed))).pptxSemantic).toEqual(
    changed.pptxSemantic
  )
  expect(initial).toEqual(before)
})

it('retains source path/focal/tile declarations and applies sparse occurrence parameters', () => {
  const initial = sourcePresentation(),
    before = structuredClone(initial)
  expect(materializeGeometry(initial.pptxSemantic, 'i1').style.fill.gradient).toMatchObject({
    ...pathGradient(),
    tileRect: { l: -25000, r: 10000 },
  })
  const patch = {
    path: 'rect',
    fillToRect: { l: 25000, t: 50000, r: 75000, b: 50000 },
    tileRect: { l: 10000, r: 10000 },
  }
  const changed = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-gradient-patch', patch },
  })
  expect(
    changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.fill.gradientPatch
  ).toEqual(patch)
  expect(resolveGeometryStyle(changed.pptxSemantic, 'i1').style.fill.gradient).toMatchObject(patch)
  expect(materializeGeometry(changed.pptxSemantic, 'i2')).toEqual(
    materializeGeometry(before.pptxSemantic, 'i2')
  )
  expect(changed.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(changed.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(changed))).pptxSemantic).toEqual(
    changed.pptxSemantic
  )
  expect(initial).toEqual(before)
})

it('accumulates sparse rectangle axes while leaving untouched source axes live', () => {
  const initial = sourcePresentation(),
    before = structuredClone(initial)
  const apply = (deck, patch) =>
    applyPresentationProjectionOperation(deck, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-gradient-patch', patch },
    })
  const first = apply(initial, { fillToRect: { l: 25000 }, tileRect: { l: 10000 } })
  const next = apply(first, { fillToRect: { t: 30000 }, tileRect: { t: 25000 } })
  const stored =
    next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.fill.gradientPatch
  expect(stored).toEqual({
    fillToRect: { l: 25000, t: 30000 },
    tileRect: { l: 10000, t: 25000 },
  })
  expect(materializeGeometry(next.pptxSemantic, 'i1').style.fill.gradient).toMatchObject({
    fillToRect: { l: 25000, t: 30000, r: 50000, b: 50000 },
    tileRect: { l: 10000, t: 25000, r: 10000 },
  })
  expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(materializeGeometry(next.pptxSemantic, 'i2')).toEqual(
    materializeGeometry(before.pptxSemantic, 'i2')
  )
})

it.each(['circle', 'rect', 'shape'])(
  'retains %s paint IDs and journal authority through canonical rectangle sorting',
  (path) => {
    const initial = sourcePresentation()
    const changed = applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: {
        type: 'fill-gradient-patch',
        patch: { path, fillToRect: { l: 25000 }, tileRect: { t: -10000, b: 20000 } },
      },
    })
    const persisted = JSON.parse(canonicalJson(changed))
    const persistedBefore = JSON.parse(canonicalJson(initial))
    expect(normalizeSemanticPresentation(persisted).pptxSemantic).toEqual(changed.pptxSemantic)
    const coldPaint = renderSlideElements(persisted.slides[0], {
      pptxSemantic: persisted.pptxSemantic,
    })
    const warmPaint = renderSlideElements(changed.slides[0], { pptxSemantic: changed.pptxSemantic })
    expect(coldPaint).toBe(warmPaint)
    expect(deriveMutationJournal(persistedBefore, persisted)).toEqual(
      deriveMutationJournal(initial, changed)
    )
  }
)

it('keeps inherited shaded gradient stops live after a sparse frame edit', () => {
  const initial = structuredClone(sourcePresentation())
  initial.pptxSemantic.definitions.definition.content.geometry.paths[0].fill = 'lightenLess'
  const before = structuredClone(initial)
  const next = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-gradient-patch', patch: { fillToRect: { l: 25000 } } },
  })
  expect(materializeGeometry(next.pptxSemantic, 'i1').paths[0].fill).toBe('lightenLess')
  expect(materializeGeometry(next.pptxSemantic, 'i1').style.fill.gradient.stops).toEqual(stops)
  expect(
    next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle.fill.gradientPatch
  ).toEqual({ fillToRect: { l: 25000 } })
  expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
  expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
  expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(next))).pptxSemantic).toEqual(
    next.pptxSemantic
  )
  expect(renderSlideElements(next.slides[0], { pptxSemantic: next.pptxSemantic })).toContain(
    '-lightenLess'
  )
  const providerChanged = structuredClone(next)
  providerChanged.pptxSemantic.styles.provider.payload.properties.fill.value.gradient.value.stops[0].value.color.value.value =
    'A35BC7'
  expect(
    materializeGeometry(providerChanged.pptxSemantic, 'i1').style.fill.gradient.stops[0].color
  ).toEqual({ kind: 'srgb', value: 'A35BC7' })
  expect(initial).toEqual(before)
})

it('renders native circle paint as a circumscribed radial gradient with source stop direction', () => {
  const initial = geometryProjectionFixture()
  const changed = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-gradient', gradient: pathGradient() },
  })
  const html = renderSlideElements(changed.slides[0], { pptxSemantic: changed.pptxSemantic })
  expect(html).toContain('<radialGradient')
  expect(html).toContain('stop-color="#f01e3c"')
  expect(html).toContain('stop-color="#1e50f0"')
  expect(html).not.toContain('<image')
})

it.each([
  { path: 'ellipse' },
  { path: undefined },
  { angle: 0 },
  { scaled: true },
  { fillToRect: { l: 0.5 } },
  { fillToRect: { r: 2147483648 } },
  { tileRect: { unknown: 0 } },
  { tileRect: { t: -2147483649 } },
])('rejects malformed path/rectangle parameters atomically: %j', (patch) => {
  const valid = geometry(pathGradient())
  expect(normalizeGeometryDocument(valid).style.fill.gradient).toEqual(pathGradient())
  const invalid = geometry({ ...pathGradient(), ...patch }),
    before = structuredClone(invalid)
  expect(() => normalizeGeometryDocument(invalid)).toThrow()
  expect(invalid).toEqual(before)
})
