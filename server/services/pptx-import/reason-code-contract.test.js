import { describe, expect, it } from 'vitest'
import reasonModule from './reason-code-contract.js'

const {
  CANONICAL_REASON_CODE_SCHEMA_VERSION,
  canonicalReasonCodes,
  publicReasonCodes,
  reasonCodeSubject,
} = reasonModule

describe('reason code contract', () => {
  it('uses a versioned deterministic reason vocabulary and safe fallback', () => {
    expect(reasonCodeSubject()).toEqual({
      schemaVersion: CANONICAL_REASON_CODE_SCHEMA_VERSION,
      version: '1.0.0',
      hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(canonicalReasonCodes(['stale-matrix-subject', 'missing-matrix-subject']))
      .toEqual(['missing-matrix-subject', 'stale-matrix-subject'])
    expect(canonicalReasonCodes(['unknown', 'missing-matrix-subject']))
      .toEqual(['unknown-reason-code', 'missing-matrix-subject'])
    expect(publicReasonCodes(['unknown', 'missing-matrix-subject']))
      .toEqual(['unknown-reason-code', 'missing-matrix-subject'])
    expect(canonicalReasonCodes(['JOURNAL_MATRIX_VERSION_MISMATCH']))
      .toEqual(['JOURNAL_MATRIX_VERSION_MISMATCH'])
  })
})
