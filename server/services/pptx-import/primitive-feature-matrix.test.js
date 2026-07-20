import { describe, expect, it } from 'vitest'
import primitiveModule from './primitive-feature-matrix.js'
import canonicalModule from './canonical-feature-matrix.js'

const { PRIMITIVE_FEATURE_MATRIX, featureRow } = primitiveModule
const {
  CANONICAL_FEATURE_MATRIX,
  FEATURE_MATRIX_SCHEMA_VERSION,
  FEATURE_TIERS,
  featureMatrixHash,
} = canonicalModule

const SEED_ID = 'primitive.text.run.plain-replacement'

function lookup(propertyId, operationId, overrides = {}) {
  return {
    propertyId, operationId, transportId: 'server-snapshot-diff', transportSchemaVersion: 1,
    eligibilityPolicyId: 'preserve-only', eligibilityPolicyVersion: 1,
    normalizationContractId: 'source-bytes-preservation', normalizationContractVersion: 1,
    ...overrides,
  }
}

describe('primitive feature matrix facade', () => {
  it('derives only primitive rows from the versioned canonical matrix', () => {
    expect(PRIMITIVE_FEATURE_MATRIX).toEqual(
      CANONICAL_FEATURE_MATRIX.filter((row) => row.family === 'primitive'),
    )
    expect(FEATURE_MATRIX_SCHEMA_VERSION).toBe(1)
    expect(featureMatrixHash()).toMatch(/^[a-f0-9]{64}$/)
    expect(PRIMITIVE_FEATURE_MATRIX.every((row) => FEATURE_TIERS.includes(row.tier))).toBe(true)
  })

  it('preserves the exact authoritative seed binding without level-4 promotion', () => {
    expect(featureRow(SEED_ID, lookup('text', 'replace', {
      eligibilityPolicyId: 'tiptap-single-plain-run',
      normalizationContractId: 'tiptap-json-html-single-plain-run',
    }))).toMatchObject({
      id: SEED_ID,
      adapterId: 'native-text-plain-run',
      adapterQualified: true,
      transactionEligible: true,
      level4Promoted: false,
    })
    expect(PRIMITIVE_FEATURE_MATRIX.filter((row) => row.level4Promoted)).toEqual([])
  })

  it('exposes whole-image replacement and crop as distinct non-promoted scopes', () => {
    expect(featureRow('primitive.image.whole-replacement',
      lookup('media-source', 'replace-whole-object')))
      .toMatchObject({ tier: 'replace-only-visual', adapterId: 'native-image-replacement' })
    expect(featureRow('primitive.image.crop', lookup('source-crop', 'set-crop')))
      .toMatchObject({ tier: 'preserved-opaque', adapterId: null })
  })

  it('returns typed blocking verdicts for unknown, non-primitive, or broad scope lookups', () => {
    expect(featureRow('unknown.row', { propertyId: 'text', operationId: 'replace' }))
      .toMatchObject({ type: 'feature-lookup-verdict', tier: 'unsupported-blocking' })
    expect(featureRow('presentation.notes.rich')).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'non-primitive-row',
    })
    expect(featureRow(SEED_ID, { propertyId: 'text' })).toMatchObject({
      type: 'feature-lookup-verdict', tier: 'unsupported-blocking', reason: 'incomplete-scope',
    })
  })
})
