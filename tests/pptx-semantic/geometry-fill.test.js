import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { applySemanticGeometry } from '../../client/src/utils/pptx-semantic-geometry-bridge'
const require = createRequire(import.meta.url)
const core = require('../../shared/src/pptx-geometry-document')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { renderSlideElements } = require('../../shared/src/element-renderers')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree')

it.each([
  [{ kind: 'srgb', value: '2468AC' }, '#2468AC'],
  [{ kind: 'token', value: 'var(--ns-primary)' }, 'var(--ns-primary)'],
  [{ kind: 'none' }, 'none'],
])(
  'edits typed fill paint, renders it authoritatively and reopens with occurrence isolation: %j',
  (color, fill) => {
    const initial = geometryProjectionFixture()
    initial.slides[0].elements[0].fill = '#123456'
    initial.slides[0].elements[0].fillOpacity = 0.75
    const before = structuredClone(initial)
    const changed = applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-paint', color },
    })
    const geometry =
      changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
    expect(geometry.style.fill).toEqual({ color })
    expect(core.geometryFillPaint(geometry)).toEqual({ fill })
    expect(changed.slides[0].elements[0].fill).toBe(fill)
    expect(changed.slides[0].elements[0].fillOpacity).toBe(1)
    expect(semanticRenderTree(changed.pptxSemantic, changed.slides[0])[0].element.fill).toBe(fill)
    expect(
      renderSlideElements(changed.slides[0], { pptxSemantic: changed.pptxSemantic })
    ).toContain(`fill:${fill};`)
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(changed)))
    expect(
      reopened.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument.style.fill
    ).toEqual({ color })
    expect(reopened.slides[0].elements[0].fill).toBe(fill)
    expect(reopened.slides[0].elements[0].fillOpacity).toBe(1)
    expect(changed.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(changed.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
    expect(initial).toEqual(before)
  }
)

it('synchronizes legacy selection paint after a typed transform-preserving fill edit', () => {
  const initial = geometryProjectionFixture()
  initial.slides[0].elements[0].fill = '#FFFFFF'
  initial.slides[0].elements[0].fillOpacity = 0.9
  const color = {
    kind: 'srgb',
    value: '654321',
    transforms: [
      { kind: 'tint', value: 50000 },
      { kind: 'alpha', value: 50000 },
      { kind: 'alphaMod', value: 50000 },
    ],
  }
  const before = structuredClone(initial)
  const changed = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-paint', color },
  })
  const paint = core.geometryFillPaint(
    changed.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
  )
  expect(changed.slides[0].elements[0].fill).toBe(paint.fill)
  expect(changed.slides[0].elements[0].fillOpacity).toBe(0.25)
  expect(changed.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(changed.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
})

it('routes generic fill controls through the canonical geometry bridge, not just the compatibility cache', () => {
  const initial = geometryProjectionFixture()
  const next = applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [
    { id: 'i1', fill: '#654321', stroke: '#2468AC', strokeWidth: 4 },
  ])
  const geometry = next.instances.i1.overrides.components.geometry.geometryDocument
  expect(geometry.style.fill).toEqual({ color: { kind: 'srgb', value: '654321' } })
  expect(geometry.style.stroke).toMatchObject({
    color: { kind: 'srgb', value: '2468AC' },
    width: 38100,
  })
  expect(core.geometryFillPaint(geometry)).toEqual({ fill: '#654321' })
  expect(next.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(next.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
})

it('keeps authored fill alpha when the generic RGB swatch changes the resolved color', () => {
  const initial = geometryProjectionFixture()
  const sourceColor = {
    kind: 'srgb',
    value: '2468AC',
    transforms: [
      { kind: 'tint', value: 50000 },
      { kind: 'alpha', value: 50000 },
      { kind: 'alphaMod', value: 50000 },
      { kind: 'alphaOff', value: -10000 },
    ],
  }
  initial.pptxSemantic.definitions.definition.content.geometry.style = {
    fill: { color: sourceColor },
  }
  const before = structuredClone(initial)
  const next = applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [
    { id: 'i1', fill: '#654321' },
  ])
  const geometry = next.instances.i1.overrides.components.geometry.geometryDocument
  expect(geometry.style.fill.color).toEqual({
    kind: 'srgb',
    value: '654321',
    transforms: sourceColor.transforms.slice(1),
  })
  expect(core.geometryFillPaint(geometry)).toEqual({ fill: '#654321', fillOpacity: 0.15 })
  expect(next.definitions).toEqual(initial.pptxSemantic.definitions)
  expect(next.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  expect(initial).toEqual(before)
})

it.each([
  null,
  false,
  '#2468AC',
  { kind: 'srgb', value: 'bad' },
  { kind: 'srgb', value: '2468AC', extra: true },
  { kind: 'token', value: 'url(https://bad.example)' },
  { kind: 'none', value: 'none' },
  { kind: 'gradient', value: '2468AC' },
])('rejects malformed typed fill and canonical save admission atomically: %j', (color) => {
  const initial = geometryProjectionFixture()
  const before = structuredClone(initial)
  expect(() =>
    applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-paint', color },
    })
  ).toThrow()
  expect(initial).toEqual(before)
  const malformed = structuredClone(initial)
  malformed.pptxSemantic.definitions.definition.content.geometry.style = { fill: { color } }
  expect(() => normalizeSemanticPresentation(malformed)).toThrow()
})

it('keeps source path shade behavior after canonical fill edit', () => {
  const initial = geometryProjectionFixture()
  initial.pptxSemantic.definitions.definition.content.geometry.paths[0].fill = 'darken'
  const next = applyPresentationProjectionOperation(initial, {
    type: 'geometry.edit',
    instanceId: 'i1',
    componentId: 'geometry',
    command: { type: 'fill-paint', color: { kind: 'srgb', value: 'FFFFFF' } },
  })
  expect(renderSlideElements(next.slides[0], { pptxSemantic: next.pptxSemantic })).toContain(
    'fill:#999999;'
  )
})

it.each([null, false, 'none', {}, { paint: '#123456' }])(
  'rejects malformed canonical fill envelopes instead of silently using compatibility paint: %j',
  (fill) => {
    const malformed = geometryProjectionFixture()
    malformed.pptxSemantic.definitions.definition.content.geometry.style = { fill }
    expect(() => normalizeSemanticPresentation(malformed)).toThrow()
  }
)

it.each([
  // Same-source PowerPoint 16.0 build 10417 native-slide-2/3/5/6 pixels,
  // recorded in resume-fill-native-reference/native-receipt.json.
  [[{ kind: 'tint', value: 25000 }], '#E1E5EE', 1],
  [[{ kind: 'shade', value: 50000 }], '#174A7D', 1],
  // Luminance/alpha source cases use the second native reference directory.
  [[{ kind: 'lumMod', value: 50000 }], '#123456', 1],
  [[{ kind: 'lumOff', value: 25000 }], '#6FA8E1', 1],
  [
    [
      { kind: 'lumMod', value: 50000 },
      { kind: 'lumOff', value: 25000 },
    ],
    '#2874BF',
    1,
  ],
  [
    [
      { kind: 'lumOff', value: 25000 },
      { kind: 'lumMod', value: 50000 },
    ],
    '#1D548B',
    1,
  ],
  [
    [
      { kind: 'alphaMod', value: 50000 },
      { kind: 'alphaMod', value: 50000 },
    ],
    '#2468AC',
    0.25,
  ],
  [
    [
      { kind: 'alpha', value: 50000 },
      { kind: 'alphaMod', value: 50000 },
    ],
    '#2468AC',
    0.25,
  ],
  [
    [
      { kind: 'alpha', value: 50000 },
      { kind: 'alphaOff', value: -25000 },
    ],
    '#2468AC',
    0.25,
  ],
  [
    [
      { kind: 'tint', value: 50000 },
      { kind: 'shade', value: 50000 },
    ],
    '#8A91A0',
    1,
  ],
  [
    [
      { kind: 'shade', value: 50000 },
      { kind: 'tint', value: 50000 },
    ],
    '#BCC1CC',
    1,
  ],
])(
  'retains ordered native RGB transforms and separate fill alpha: %j',
  (transforms, fill, alpha) => {
    const initial = geometryProjectionFixture()
    const color = { kind: 'srgb', value: '2468AC', transforms }
    const next = applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-paint', color },
    })
    const geometry = next.pptxSemantic.instances.i1.overrides.components.geometry.geometryDocument
    expect(geometry.style.fill.color).toEqual(color)
    expect(core.geometryFillPaint(geometry)).toEqual({ fill, fillOpacity: alpha })
    const html = renderSlideElements(next.slides[0], { pptxSemantic: next.pptxSemantic })
    expect(html).toContain(`fill:${fill};`)
    expect(html).toContain(`fill-opacity="${alpha}"`)
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
    expect(reopened.pptxSemantic).toEqual(next.pptxSemantic)
    expect(next.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(next.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
  }
)

it.each([
  null,
  {},
  [{ kind: 'blur', value: 1 }],
  [{ kind: 'alpha', value: 100001 }],
  [{ kind: 'shade', value: -1 }],
  [{ kind: 'tint', value: 0.5 }],
  [{ kind: 'alphaMod', value: 1, extra: true }],
  Array(33).fill({ kind: 'alpha', value: 100000 }),
])('rejects malformed native fill transform declarations atomically: %j', (transforms) => {
  const initial = geometryProjectionFixture()
  const before = structuredClone(initial)
  expect(() =>
    applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-paint', color: { kind: 'srgb', value: '2468AC', transforms } },
    })
  ).toThrow()
  expect(initial).toEqual(before)
})
