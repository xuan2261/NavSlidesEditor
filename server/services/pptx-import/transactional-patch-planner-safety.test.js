import { describe, expect, it } from 'vitest'
import plannerModule from './transactional-patch-planner.js'
import matrixModule from './canonical-feature-matrix.js'

const { compilePatchPlan } = plannerModule
const { CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, featureMatrixHash } = matrixModule
const BINDINGS = {
  transportId: 'server-snapshot-diff', transportSchemaVersion: 1,
  eligibilityPolicyId: 'tiptap-single-plain-run', eligibilityPolicyVersion: 1,
  normalizationContractId: 'tiptap-json-html-single-plain-run', normalizationContractVersion: 1,
}

function transport(text = 'After') {
  return { format: 'tiptap-json', schemaVersion: 1, document: {
    type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  } }
}

function operation(overrides = {}) {
  return {
    kind: 'property-change', rowId: 'primitive.text.run.plain-replacement',
    objectKind: 'text-run', slideId: 'slide-1', elementId: 'element-1',
    propertyId: 'text', operationId: 'replace', before: 'Before', after: 'After',
    bindings: { ...BINDINGS }, textTransport: transport(),
    impactClosure: ['ppt/slides/slide1.xml'],
    sourceRef: {
      status: 'authoritative', kind: 'text-run', packageGeneration: 1, revisionId: 'r0',
      matchMethod: 'native-id', confidence: 1, nativeId: '4',
      partUri: 'ppt/slides/slide1.xml', sourceHash: 'a'.repeat(64),
      relationshipChain: ['ppt/slides/_rels/slide1.xml.rels'],
    },
    ...overrides,
  }
}

function journal(operations) {
  return {
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: featureMatrixHash(),
    operations,
  }
}

describe('transactional patch planner input safety', () => {
  it('validates every operation before collision-free compaction and clones plan references', () => {
    const invalid = operation({ sourceRef: { ...operation().sourceRef, status: 'ambiguous' } })
    expect(compilePatchPlan(journal([invalid, operation()]))).toMatchObject({
      ok: false, reasonCode: 'SOURCE_NOT_AUTHORITATIVE',
    })

    const first = operation({ slideId: 'slide:one', elementId: 'element', after: 'One', textTransport: transport('One') })
    const second = operation({ slideId: 'slide', elementId: 'one:element', after: 'Two', textTransport: transport('Two') })
    const plan = compilePatchPlan(journal([first, second]))
    expect(plan.operations).toHaveLength(2)
    expect(plan.operations[0].sourceRef).not.toBe(first.sourceRef)
    expect(Object.isFrozen(plan.operations[0].sourceRef)).toBe(true)
    expect(Object.isFrozen(plan.operations[0].sourceRef.relationshipChain)).toBe(true)
  })

  it.each([
    ['changed source identity', [operation(), operation({ sourceRef: { ...operation().sourceRef, sourceHash: 'b'.repeat(64) } })], 'COMPACTION_SOURCE_IDENTITY_CHANGED'],
    ['discontinuous before text', [operation(), operation({ before: 'Middle', after: 'Final', textTransport: transport('Final') })], 'COMPACTION_BEFORE_AFTER_DISCONTINUITY'],
    ['after differs from normalized transport', [operation({ after: 'Other' })], 'AFTER_NORMALIZATION_MISMATCH'],
    ['empty relationship closure', [operation({ sourceRef: { ...operation().sourceRef, relationshipChain: [] } })], 'RELATIONSHIP_CHAIN_INVALID'],
    ['non-string impact closure', [operation({ impactClosure: ['ppt/slides/slide1.xml', 4] })], 'IMPACT_CLOSURE_INVALID'],
  ])('fails closed for %s', (_label, operations, reasonCode) => {
    expect(compilePatchPlan(journal(operations))).toMatchObject({ ok: false, reasonCode })
  })

  it('converts inherited fields and throwing getters to typed blocks', () => {
    const inherited = Object.create(operation())
    expect(compilePatchPlan(journal([inherited]))).toMatchObject({
      ok: false, reasonCode: 'OPERATION_INVALID',
    })
    const hostile = operation()
    Object.defineProperty(hostile, 'rowId', { get() { throw new Error('getter') } })
    expect(() => compilePatchPlan(journal([hostile]))).not.toThrow()
    expect(compilePatchPlan(journal([hostile]))).toMatchObject({
      ok: false, reasonCode: 'OPERATION_INVALID',
    })
  })

  it('rejects a journal that omits or drifts any matrix-subject field', () => {
    const valid = journal([operation()])
    for (const [field, expected] of [
      ['featureMatrixSchemaVersion', 'JOURNAL_MATRIX_SCHEMA_MISSING'],
      ['featureMatrixVersion', 'JOURNAL_MATRIX_VERSION_MISSING'],
      ['featureMatrixHash', 'JOURNAL_MATRIX_HASH_MISSING'],
    ]) {
      const missing = { ...valid }
      delete missing[field]
      expect(compilePatchPlan(missing)).toMatchObject({ ok: false, reasonCode: expected })
    }
    expect(compilePatchPlan({ ...valid, featureMatrixVersion: '0.0.0' }))
      .toMatchObject({ ok: false, reasonCode: 'JOURNAL_MATRIX_VERSION_MISMATCH' })
  })

  it('attaches current matrix and reason-code subjects to every fail-closed planner result', () => {
    const result = compilePatchPlan({ operations: [] })
    expect(result).toMatchObject({
      ok: false,
      reasonCode: 'JOURNAL_MATRIX_SCHEMA_MISSING',
      featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
      featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
      featureMatrixHash: featureMatrixHash(),
      reasonCodeSubject: expect.objectContaining({ schemaVersion: 1, version: '1.0.0' }),
    })
    expect(result.reasonCodes).toEqual(['JOURNAL_MATRIX_SCHEMA_MISSING'])
  })
})
