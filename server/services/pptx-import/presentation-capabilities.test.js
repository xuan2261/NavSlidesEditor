import { describe, expect, it } from 'vitest'
import matrixModule from './canonical-feature-matrix.js'
import capabilities from './presentation-capabilities.js'

const {
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = matrixModule

function driftedMatrix() {
  const matrix = JSON.parse(JSON.stringify(CANONICAL_FEATURE_MATRIX_ENVELOPE))
  matrix.rows[0].reason = 'Static copy drifted from the canonical matrix.'
  return matrix
}

describe('presentation behavior capability matrix', () => {
  it('derives canonical presentation row summaries without a legacy vocabulary', () => {
    const canonicalRows = CANONICAL_FEATURE_MATRIX.filter((row) => row.family === 'presentation')

    expect(capabilities.matrix).toEqual({
      schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
      matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
      hash: featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE),
    })
    expect(capabilities.rows).toHaveLength(canonicalRows.length)
    expect(capabilities.rows.map((row) => row.id)).toEqual(canonicalRows.map((row) => row.id))
    expect(capabilities.rows.every((row) => row.verifiedEditable === false)).toBe(true)
    expect(capabilities.rows.every((row) => row.transactionEligible === false)).toBe(true)
    expect(capabilities.rows.map((row) => row.tier)).not.toEqual(expect.arrayContaining([
      'structural-mvp', 'preserve-only',
    ]))
    expect(capabilities).toMatchObject({
      maxClaimLevel: 0,
      achievedClaimLevel: 0,
      verifiedClaimLevel: 0,
      targetClaimLevel: 4,
    })
  })

  it('uses the canonical matrix hash so static copies cannot drift', () => {
    expect(featureMatrixHash(driftedMatrix())).not.toBe(featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE))
    expect(capabilities.matrix.hash).toBe(featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE))
    expect(capabilities.rows.every((row) => !('adapterId' in row || 'fixtureIds' in row || 'requiredTestIds' in row))).toBe(true)
  })
})
