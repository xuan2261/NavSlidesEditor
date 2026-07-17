import { describe, expect, it } from 'vitest'
import matrixModule from './canonical-feature-matrix.js'

const {
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  FEATURE_TIERS,
  canonicalFeatureMatrixHash,
  canonicalMatrixBytes,
  createMatrixDependency,
  createMatrixAuthoritySubjects,
  featureRow,
  getFeatureRow,
  parseCanonicalFeatureMatrix,
  validateMatrixAuthoritySubjects,
  validateMatrixDependency,
} = matrixModule

const SEED_ID = 'primitive.text.run.plain-replacement'
const DEFAULT_BINDING = Object.freeze({
  transportId: 'server-snapshot-diff', transportSchemaVersion: 1,
  eligibilityPolicyId: 'preserve-only', eligibilityPolicyVersion: 1,
  normalizationContractId: 'source-bytes-preservation', normalizationContractVersion: 1,
})

function lookup(propertyId, operationId, overrides = {}) {
  return { ...DEFAULT_BINDING, propertyId, operationId, ...overrides }
}

function draftMatrix() {
  return JSON.parse(JSON.stringify(CANONICAL_FEATURE_MATRIX_ENVELOPE))
}

function expectInvalid(input, code) {
  expect(() => parseCanonicalFeatureMatrix(input)).toThrow(
    expect.objectContaining({ name: 'CanonicalFeatureMatrixValidationError', code }),
  )
}

describe('canonical feature matrix', () => {
  it('creates a versioned envelope with canonically sorted rows and a stable hash', () => {
    const matrix = draftMatrix()
    const reversed = { ...matrix, rows: [...matrix.rows].reverse() }
    const nestedSetsReordered = {
      ...matrix,
      rows: matrix.rows.map((row) => ({
        ...row,
        scope: {
          propertyIds: [...row.scope.propertyIds].reverse(),
          operationIds: [...row.scope.operationIds].reverse(),
        },
        fixtureIds: [...row.fixtureIds].reverse(),
        requiredTestIds: [...row.requiredTestIds].reverse(),
      })),
    }
    const catalogsReordered = {
      ...matrix,
      impactPolicies: [...matrix.impactPolicies].reverse(),
      transports: [...matrix.transports].reverse(),
      eligibilityPolicies: [...matrix.eligibilityPolicies].reverse(),
      normalizationContracts: [...matrix.normalizationContracts].reverse(),
      adapters: [...matrix.adapters].reverse(),
    }

    expect(CANONICAL_FEATURE_MATRIX_ENVELOPE).toMatchObject({
      schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
      matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
      rows: CANONICAL_FEATURE_MATRIX,
    })
    expect(CANONICAL_FEATURE_MATRIX.map((row) => row.id))
      .toEqual([...CANONICAL_FEATURE_MATRIX].map((row) => row.id).sort())
    expect(canonicalFeatureMatrixHash(matrix)).toBe(canonicalFeatureMatrixHash(reversed))
    expect(canonicalFeatureMatrixHash(matrix)).toBe(canonicalFeatureMatrixHash(nestedSetsReordered))
    expect(canonicalMatrixBytes(matrix)).toEqual(canonicalMatrixBytes(catalogsReordered))
  })

  it('rejects duplicate rows, identifier sets, and exact scopes', () => {
    const duplicateRow = draftMatrix()
    duplicateRow.rows.push({ ...duplicateRow.rows[0] })
    expectInvalid(duplicateRow, 'DUPLICATE_ROW_ID')

    const duplicateIdentifier = draftMatrix()
    duplicateIdentifier.rows[0].scope.propertyIds.push(
      duplicateIdentifier.rows[0].scope.propertyIds[0],
    )
    expectInvalid(duplicateIdentifier, 'DUPLICATE_IDENTIFIER')

    const duplicateScope = draftMatrix()
    duplicateScope.rows.push({ ...duplicateScope.rows[0], id: 'primitive.text.run.copy' })
    expectInvalid(duplicateScope, 'DUPLICATE_EXACT_SCOPE')

    const distinctVariableLengthScopes = draftMatrix()
    distinctVariableLengthScopes.rows[0] = {
      ...distinctVariableLengthScopes.rows[0], id: 'scope.first', family: 'scope', objectKind: 'object',
      scope: { propertyIds: ['a', 'b'], operationIds: ['c'] },
    }
    distinctVariableLengthScopes.rows[1] = {
      ...distinctVariableLengthScopes.rows[1], id: 'scope.second', family: 'scope', objectKind: 'object',
      scope: { propertyIds: ['a'], operationIds: ['b', 'c'] },
    }
    expect(() => parseCanonicalFeatureMatrix(distinctVariableLengthScopes)).not.toThrow()
  })

  it('rejects unknown fields, legacy tiers, and rows without an exact scope', () => {
    const unknownField = draftMatrix()
    unknownField.rows[0].unreviewed = true
    expectInvalid(unknownField, 'UNKNOWN_ROW_FIELD')

    const legacyTier = draftMatrix()
    legacyTier.rows[0].tier = 'editable'
    expectInvalid(legacyTier, 'INVALID_TIER')

    const missingScope = draftMatrix()
    delete missingScope.rows[0].scope
    expectInvalid(missingScope, 'MISSING_REQUIRED_FIELD')

    expectInvalid(Object.create(draftMatrix()), 'INVALID_OBJECT')
  })

  it('uses the authoritative stable G2 seed ID with independent G2 and G4 states', () => {
    const seed = featureRow(SEED_ID, lookup('text', 'replace', {
      eligibilityPolicyId: 'tiptap-single-plain-run',
      normalizationContractId: 'tiptap-json-html-single-plain-run',
    }))

    expect(seed).toMatchObject({
      id: SEED_ID,
      family: 'primitive',
      objectKind: 'text-run',
      adapterId: 'native-text-plain-run',
      adapterQualified: true,
      transactionEligible: true,
      level4Promoted: false,
      tier: 'native-editable',
    })
    expect(FEATURE_TIERS).toEqual([
      'native-editable',
      'structured-partial',
      'replace-only-visual',
      'preserved-opaque',
      'unsupported-blocking',
    ])

    const invalidTransaction = draftMatrix()
    invalidTransaction.rows.find((row) => row.id === SEED_ID).adapterQualified = false
    expectInvalid(invalidTransaction, 'TRANSACTION_REQUIRES_ADAPTER_QUALIFICATION')

    const invalidPromotion = draftMatrix()
    const promotionSeed = invalidPromotion.rows.find((row) => row.id === SEED_ID)
    promotionSeed.transactionEligible = false
    promotionSeed.level4Promoted = true
    expectInvalid(invalidPromotion, 'LEVEL4_PROMOTION_REQUIRES_QUALIFIED_TRANSACTION')
  })

  it('binds lookups to exact scope and transport contracts without broad authorization', () => {
    expect(getFeatureRow(SEED_ID)).toMatchObject({ id: SEED_ID, family: 'primitive' })
    expect(featureRow(SEED_ID)).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'invalid-lookup',
    })
    expect(featureRow(SEED_ID, { propertyId: 'text' })).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'incomplete-scope',
    })
    expect(featureRow(SEED_ID, { propertyId: 'text', operationId: 'append' })).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'unsupported-scope',
    })
    expect(featureRow(SEED_ID, { propertyId: 'text', operationId: 'replace' })).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'incomplete-binding',
    })
    expect(featureRow(SEED_ID, lookup('text', 'replace', {
      transportSchemaVersion: 2, eligibilityPolicyId: 'tiptap-single-plain-run',
      normalizationContractId: 'tiptap-json-html-single-plain-run',
    }))).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'binding-mismatch',
    })
    expect(featureRow(SEED_ID, Object.create(lookup('text', 'replace', {
      eligibilityPolicyId: 'tiptap-single-plain-run',
      normalizationContractId: 'tiptap-json-html-single-plain-run',
    })))).toMatchObject({ type: 'feature-lookup-verdict', reason: 'invalid-lookup' })
    expect(featureRow('unknown.row', { propertyId: 'text', operationId: 'replace' }))
      .toMatchObject({ type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'unknown-row' })
  })

  it('fails closed for inherited or throwing lookup fields', () => {
    const valid = lookup('text', 'replace', {
      eligibilityPolicyId: 'tiptap-single-plain-run',
      normalizationContractId: 'tiptap-json-html-single-plain-run',
    })
    expect(featureRow(SEED_ID, Object.create(valid))).toMatchObject({ reason: 'invalid-lookup' })
    const throwing = { ...valid }
    Object.defineProperty(throwing, 'propertyId', { get() { throw new Error('getter') } })
    expect(() => featureRow(SEED_ID, throwing)).not.toThrow()
    expect(featureRow(SEED_ID, throwing)).toMatchObject({ reason: 'incomplete-scope' })
  })

  it('keeps whole-image replacement and crop as separately gated rows', () => {
    const replacement = featureRow('primitive.image.whole-replacement',
      lookup('media-source', 'replace-whole-object'))
    const crop = featureRow('primitive.image.crop', lookup('source-crop', 'set-crop'))

    expect(replacement).toMatchObject({ tier: 'replace-only-visual', adapterId: 'native-image-replacement' })
    expect(crop).toMatchObject({ tier: 'preserved-opaque', adapterId: null })
    expect(CANONICAL_FEATURE_MATRIX.every((row) => row.level4Promoted === false)).toBe(true)
    expect(CANONICAL_FEATURE_MATRIX.filter((row) => row.transactionEligible).map((row) => row.id))
      .toEqual([SEED_ID])
  })

  it('requires closed catalog bindings and an exact qualified adapter before execution', () => {
    const matrix = draftMatrix()
    const seed = matrix.rows.find((row) => row.id === SEED_ID)
    seed.impactPolicyId = 'unknown-impact-policy'
    expectInvalid(matrix, 'UNKNOWN_IMPACT_POLICY_BINDING')

    const duplicateAdapter = draftMatrix()
    duplicateAdapter.adapters.push({ ...duplicateAdapter.adapters[0] })
    expectInvalid(duplicateAdapter, 'DUPLICATE_ADAPTER_BINDING')

    const missingQualifiedAdapter = draftMatrix()
    missingQualifiedAdapter.adapters.find((adapter) => adapter.id === 'native-text-plain-run').qualified = false
    expectInvalid(missingQualifiedAdapter, 'MISSING_QUALIFIED_ADAPTER')

    const staleRowQualification = draftMatrix()
    staleRowQualification.rows.find((row) => row.id === 'primitive.geometry.basic-transform')
      .adapterQualified = true
    expectInvalid(staleRowQualification, 'MISSING_QUALIFIED_ADAPTER')
  })

  it('keeps historical matrix dependencies immutable and fails them stale after evolution', () => {
    const historical = draftMatrix()
    const dependency = createMatrixDependency(historical)
    const evolved = draftMatrix()
    evolved.matrixVersion = '1.0.1'

    expect(canonicalMatrixBytes(historical)).toEqual(canonicalMatrixBytes({
      ...historical,
      rows: [...historical.rows].reverse(),
    }))
    expect(validateMatrixDependency(dependency, historical)).toEqual({ authorized: true, reasons: [] })
    expect(validateMatrixDependency(dependency, evolved)).toEqual({
      authorized: false,
      reasons: ['stale-matrix-subject'],
    })
    expect(dependency).toEqual(createMatrixDependency(historical))
  })

  it('invalidates persisted qualification, capability, journal, and claim authority together', () => {
    const historical = draftMatrix()
    const subjects = createMatrixAuthoritySubjects(historical)
    const evolved = draftMatrix()
    evolved.matrixVersion = '1.0.1'

    expect(validateMatrixAuthoritySubjects(subjects, historical)).toEqual({
      authorized: true,
      reasons: [],
    })
    expect(validateMatrixAuthoritySubjects(subjects, evolved)).toEqual({
      authorized: false,
      reasons: [
        'stale-capability-matrix-subject',
        'stale-claim-matrix-subject',
        'stale-journal-matrix-subject',
        'stale-qualification-matrix-subject',
      ],
    })
    expect(subjects).toEqual(createMatrixAuthoritySubjects(historical))
  })
})
