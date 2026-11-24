import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { extentProjectionFixture } from './geometry-extent-fixture.js'
import { inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

const require = createRequire(import.meta.url)
const {
  createPresentationSchema,
  updatePresentationSchema,
} = require('../../server/middleware/schemas.js')
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation.js')

const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph.js')
function inheritedExtentFixture() {
  const deck = extentProjectionFixture(952500, 762000)
  const model = inheritedGeometryStyleFixture()
  model.definitions.definition = deck.pptxSemantic.definitions.definition
  model.styles.provider.payload.transform = deck.pptxSemantic.styles.provider.payload.transform
  deck.pptxSemantic = model
  return deck
}

describe.each([
  ['create', createPresentationSchema],
  ['update', updatePresentationSchema],
])('native extent %s DTO admission', (_name, schema) => {
  it.each(['width', 'height'])(
    'admits a canonical zero %s override on an inherited provider',
    (axis) => {
      const initial = inheritedExtentFixture()
      const before = structuredClone(initial)
      const next = applyPresentationProjectionOperation(initial, {
        type: 'geometry.edit',
        instanceId: 'i1',
        componentId: 'geometry',
        command: { type: 'extent', [axis]: 0 },
      })
      expect(next.pptxSemantic.definitions.local1.content).not.toHaveProperty('geometry')
      expect(next.slides[0].elements[0][axis]).toBe(0)
      const parsed = schema.safeParse(JSON.parse(JSON.stringify(next)))
      expect(parsed.success).toBe(true)
      expect(parsed.data.slides[0].elements[0][axis]).toBe(0)
      expect(initial).toEqual(before)
      const compact = { ...next, pptxSemantic: compactSemanticGraph(next.pptxSemantic) }
      const compactResult = schema.safeParse(JSON.parse(JSON.stringify(compact)))
      expect(compactResult.success).toBe(true)
      expect(compactResult.data.slides[0].elements[0][axis]).toBe(0)
    }
  )

  it('rejects a zero compatibility cache when its source-bound canonical extent is positive', () => {
    const deck = inheritedExtentFixture()
    deck.slides[0].elements[0].width = 0
    const before = structuredClone(deck)
    expect(schema.safeParse(deck).success).toBe(false)
    expect(deck).toEqual(before)
    const compact = { ...deck, pptxSemantic: compactSemanticGraph(deck.pptxSemantic) }
    expect(schema.safeParse(compact).success).toBe(false)
  })

  it('does not mask malformed protected source with a valid zero override or hidden occurrence', () => {
    const initial = inheritedExtentFixture()
    const next = applyPresentationProjectionOperation(initial, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'extent', width: 0 },
    })
    const candidate = structuredClone(next)
    candidate.pptxSemantic.instances.i1.overrides.hidden = true
    candidate.pptxSemantic.styles.provider.payload.transform.value.ext.value.cx.value = -1
    const before = structuredClone(candidate)
    expect(schema.safeParse(candidate).success).toBe(false)
    expect(candidate).toEqual(before)
  })
})
