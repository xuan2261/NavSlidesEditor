// @vitest-environment node
import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
import { chartProjectionFixture } from './projection-capabilities-fixture'
import { geometryStyleFixture } from './geometry-style-fixture'
import { pictureFixture } from './semantic-picture-fixture'
const require = createRequire(import.meta.url)
const { normalizeSemanticPresentation, validateSemanticPresentationBindings } = require('../../shared/src/pptx-semantic-presentation')
const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
const { normalizePptxSemanticDocument } = require('../../shared/src/pptx-semantic-document')
const { updatePresentationSchema } = require('../../server/middleware/schemas')
function geometryPresentation() {
  const pptxSemantic = geometryStyleFixture()
  return { title: 'Geometry', pptxSemantic, slides: Object.values(pptxSemantic.instances).map(i => ({
    id: i.slideId, elements: [{ id: i.id, type: 'shape', pptxInstanceId: i.id, width: 10, height: 10 }],
  })) }
}
function errorOf(fn) {
  try { fn() } catch (e) { return { name: e.name, message: e.message } }
  throw new Error('Expected rejection')
}
it.each([1, 2, 3])('admits schema %i without replacing slides or mutating input', schema => {
  const p = schema === 1 ? chartProjectionFixture() : geometryPresentation()
  if (schema === 3) p.pptxSemantic = compactSemanticGraph(p.pptxSemantic)
  const before = structuredClone(p)
  const admitted = validateSemanticPresentationBindings(p)
  expect(admitted).toEqual(normalizeSemanticPresentation(p).pptxSemantic)
  expect(Object.isFrozen(admitted)).toBe(true)
  expect(admitted).not.toBe(p.pptxSemantic)
  expect(p).toEqual(before)
  expect(updatePresentationSchema.parse(p).pptxSemantic).toEqual(admitted)
})
it.each(['occurrence', 'chart', 'timing'])('retains exact %s binding errors', failure => {
  const p = chartProjectionFixture()
  if (failure === 'occurrence') p.slides[0].elements[0].pptxInstanceId = 'missing'
  if (failure === 'chart') p.slides[0].elements[0].chartType = 'pie'
  if (failure === 'timing') p.slides[0].sourceTimingDefinitionIds = ['missing']
  const old = errorOf(() => normalizeSemanticPresentation(p))
  expect(errorOf(() => validateSemanticPresentationBindings(p))).toEqual(old)
  expect(updatePresentationSchema.safeParse(p).error.issues.some(i => i.message === old.message)).toBe(true)
})
it.each(['type', 'geometry'])('retains picture projection-only %s errors beyond graph normalization', async failure => {
  const { presentation } = await pictureFixture()
  const p = structuredClone(presentation)
  if (failure === 'type') p.slides[0].elements[0].type = 'shape'
  else {
    const i = Object.values(p.pptxSemantic.instances)[0]
    const d = p.pptxSemantic.definitions[i.definitionId]
    i.overrides.components = { [d.content.geometry.componentId]: { geometryDocument: {
      ...d.content.geometry, width: 0,
    } } }
  }
  // The graph alone is insufficient to admit these projection bindings.
  expect(() => normalizePptxSemanticDocument(p.pptxSemantic)).not.toThrow()
  const old = errorOf(() => normalizeSemanticPresentation(p))
  expect(errorOf(() => validateSemanticPresentationBindings(p))).toEqual(old)
  expect(updatePresentationSchema.safeParse(p).error.issues.some(i => i.message === old.message)).toBe(true)
})
it('retains absent-semantics and omitted-slides public behavior', () => {
  const p = { title: 'Plain', slides: [] }
  expect(normalizeSemanticPresentation(p)).toBe(p)
  expect(validateSemanticPresentationBindings(p)).toBeUndefined()
  const partial = { pptxSemantic: chartProjectionFixture().pptxSemantic }
  expect(validateSemanticPresentationBindings(partial)).toEqual(normalizeSemanticPresentation(partial).pptxSemantic)
})
