import { describe, expect, it } from 'vitest'
import matrixModule from './canonical-feature-matrix.js'
import plannerModule from './transactional-patch-planner.js'
import reasonModule from './reason-code-contract.js'

const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, createMatrixAuthoritySubject,
  featureMatrixHash, getFeatureRow,
} = matrixModule
const { compilePatchPlan: rawCompilePatchPlan } = plannerModule
const compilePatchPlan = (input) => rawCompilePatchPlan(input, { matrixAuthorityEpoch: 1 })
const { reasonCodeSubject } = reasonModule

function bindings() {
  const row = getFeatureRow('primitive.shape.solid-fill')
  return Object.fromEntries([
    'transportId', 'transportSchemaVersion', 'eligibilityPolicyId',
    'eligibilityPolicyVersion', 'normalizationContractId',
    'normalizationContractVersion',
  ].map((key) => [key, row[key]]))
}

function operation(overrides = {}) {
  return {
    kind: 'property-change', rowId: 'primitive.shape.solid-fill',
    objectKind: 'shape', slideId: 'slide-1', elementId: 'shape-1',
    propertyId: 'solid-fill', operationId: 'set-style',
    before: '#112233', after: '#AABBCC', bindings: bindings(),
    impactClosure: ['ppt/slides/slide1.xml'],
    sourceRef: {
      status: 'authoritative', kind: 'shape', packageGeneration: 1,
      revisionId: 'r0', matchMethod: 'native-id', confidence: 1,
      nativeId: '8', partUri: 'ppt/slides/slide1.xml',
      sourceHash: 'a'.repeat(64),
      relationshipChain: ['ppt/_rels/presentation.xml.rels'],
    },
    ...overrides,
  }
}

function journal(operations) {
  return {
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: featureMatrixHash(),
    matrixAuthoritySubject: createMatrixAuthoritySubject(),
    reasonCodeSubject: reasonCodeSubject(),
    operations,
  }
}

describe('shape-fill planner authorization', () => {
  it('recognizes only the fill row then preserves its candidate-only eligibility gate', () => {
    expect(compilePatchPlan(journal([operation()]))).toMatchObject({
      ok: false, reasonCode: 'ROW_ADAPTER_UNQUALIFIED',
    })
  })

  it.each([
    ['stroke', operation({ propertyId: 'solid-stroke' }), 'SCOPE_MISMATCH'],
    ['wrong object kind', operation({ objectKind: 'shape-style' }), 'OBJECT_KIND_MISMATCH'],
    ['non-RGB fill', operation({ after: '#ABC' }), 'SOLID_FILL_INVALID'],
    ['non-shape source', operation({ sourceRef: { ...operation().sourceRef, kind: 'text-run' } }), 'SOURCE_OBJECT_KIND_MISMATCH'],
    ['extra touched part', operation({ impactClosure: ['ppt/slides/slide1.xml', 'ppt/slides/slide2.xml'] }), 'IMPACT_CLOSURE_INVALID'],
  ])('fails closed for %s', (_label, input, reasonCode) => {
    expect(compilePatchPlan(journal([input]))).toMatchObject({
      ok: false, reasonCode,
    })
  })
})
