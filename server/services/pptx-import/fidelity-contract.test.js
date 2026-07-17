import { describe, expect, it, vi } from 'vitest'
import matrixModule from './canonical-feature-matrix.js'
import contract from './fidelity-contract.js'
const {
  CANONICAL_FEATURE_MATRIX,
  CANONICAL_FEATURE_MATRIX_ENVELOPE,
  CANONICAL_FEATURE_MATRIX_VERSION,
  FEATURE_MATRIX_SCHEMA_VERSION,
  featureMatrixHash,
} = matrixModule
const { buildFidelityDto, createConflict, createSuccessorQueue } = contract
const expectedMatrix = Object.freeze({
  schemaVersion: FEATURE_MATRIX_SCHEMA_VERSION, matrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
  hash: featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE),
})
function dtoKeys(value) {
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, nested]) => [key, ...dtoKeys(nested)])
}
function draftMatrixWithDrift() {
  const matrix = JSON.parse(JSON.stringify(CANONICAL_FEATURE_MATRIX_ENVELOPE))
  matrix.rows[0].reason = 'Changed outside the canonical matrix.'; return matrix
}
describe('PPTX fidelity API contract', () => {
  it('binds public matrix metadata and safe row summaries to the canonical matrix', () => {
    const dto = buildFidelityDto({ id: 'deck', pptxOriginal: { id: 'source' } }, {
      verifiedOriginalAvailable: true,
    })
    const seed = dto.fidelity.rows.find((row) => row.id === 'primitive.text.run.plain-replacement')
    expect(dto.matrix).toEqual(expectedMatrix)
    expect(dto.fidelity).toMatchObject({
      status: 'source-backed',
      maxClaimLevel: 1,
      achievedClaimLevel: 1,
      verifiedClaimLevel: 1,
      targetClaimLevel: 4,
      level5Available: false,
    })
    expect(dto.fidelity.rows).toHaveLength(CANONICAL_FEATURE_MATRIX.length)
    expect(dto.fidelity.rows.every((row) => row.verifiedEditable === false)).toBe(true)
    expect(seed).toEqual({
      id: 'primitive.text.run.plain-replacement',
      family: 'primitive',
      objectKind: 'text-run',
      tier: 'native-editable',
      claimCeiling: 'valid-edited-package',
      transactionEligible: true,
      verifiedEditable: false,
      reasonCode: 'transaction-eligible-not-verified-editable',
      reason: 'Eligible for validated edited-package processing, not verified feature editing.',
    })
  })
  it('does not overclaim level four or accept matrix drift', () => {
    const dto = buildFidelityDto({ id: 'unverified' })
    expect(dto.fidelity).toMatchObject({
      maxClaimLevel: 0,
      achievedClaimLevel: 0,
      verifiedClaimLevel: 0,
      targetClaimLevel: 4,
    })
    expect(dto.matrix.hash).toBe(featureMatrixHash(CANONICAL_FEATURE_MATRIX_ENVELOPE))
    expect(dto.matrix.hash).not.toBe(featureMatrixHash(draftMatrixWithDrift()))
  })
  it('exposes the safe current package generation for validated export', () => {
    const dto = buildFidelityDto({
      id: 'deck',
      pptxAggregateHead: { packageRevisionId: 'r1', generation: 2 },
    }, { validatedEditedAvailable: true })

    expect(dto.aggregateGeneration).toBe(2)
  })

  it('describes the transaction-eligible seed without promoting it to level four', () => {
    const dto = buildFidelityDto({ id: 'deck', pptxOriginal: { id: 'source' } }, {
      verifiedOriginalAvailable: true,
      validatedEditedAvailable: true,
    })
    const seed = dto.fidelity.rows.find((row) => row.id === 'primitive.text.run.plain-replacement')
    expect(dto.exports.validatedEdited).toMatchObject({ available: true, reasonCode: null, reason: null })
    expect(dto.fidelity).toMatchObject({ maxClaimLevel: 1, verifiedClaimLevel: 1 })
    expect(seed).toMatchObject({ transactionEligible: true, verifiedEditable: false })
  })
  it.each(['macro', 'protection', 'unknown'])('keeps %s packages original-only without content details', (kind) => {
    const dto = buildFidelityDto({
      id: 'deck',
      aggregateGeneration: 7,
      pptxOriginal: {
        id: 'source',
        sha256: 'secret-original-hash',
        packagePath: 'C:\\secret.pptx',
        sourceRef: { partUri: 'ppt/slides/slide1.xml' },
        journalId: 'journal-secret',
        capabilitySummary: { kinds: [kind] },
      },
    }, {
      verifiedOriginalAvailable: true,
      validatedEditedAvailable: true,
    })
    expect(dto.fidelity.status).toBe('original-only')
    expect(dto.exports.original).toMatchObject({ available: true, reasonCode: null, reason: null })
    expect(dto.exports.validatedEdited).toMatchObject({
      available: false,
      reasonCode: 'original-only-package',
      reason: 'This package can only be recovered as its original file.',
    })
    expect(dto.exports.reconstructed.available).toBe(false)
    expect(dto.fidelity.rows.find((row) => row.id === 'primitive.text.run.plain-replacement')).toMatchObject({
      transactionEligible: false,
      verifiedEditable: false,
      reasonCode: 'original-only-package',
      reason: 'This package can only be recovered as its original file.',
    })
    expect(dto).not.toHaveProperty('revision')
    expect(dto.fidelity).not.toHaveProperty('kinds')
    expect(dtoKeys(dto)).not.toEqual(expect.arrayContaining([
      'adapterId', 'fixtureIds', 'requiredTestIds', 'transportId', 'impactPolicyId',
      'sourceAuthorityRule', 'normalizationContractId', 'packagePath', 'sourceRef',
      'journalId', 'aggregateGeneration', 'capabilitySummary', 'sha256', 'kinds',
    ]))
    expect(JSON.stringify(dto)).not.toMatch(/secret-original-hash|secret\.pptx|journal-secret|slide1\.xml/i)
  })
  it('fails closed when either capability summary requires original-only recovery', () => {
    const dto = buildFidelityDto({
      id: 'deck',
      capabilitySummary: { kinds: ['macro'] },
      pptxOriginal: { id: 'source', capabilitySummary: {} },
    }, {
      verifiedOriginalAvailable: true,
      validatedEditedAvailable: true,
    })
    expect(dto.fidelity.status).toBe('original-only')
    expect(dto.exports.validatedEdited).toMatchObject({
      available: false,
      reasonCode: 'original-only-package',
    })
    expect(dto.exports.reconstructed).toMatchObject({
      available: false,
      reasonCode: 'original-only-package',
    })
  })
  it.each([['unsafe kinds', ['macro']], ['malformed kinds', 'macro']])(
    'keeps source-less %s metadata in one reconstructed fallback state', (_, kinds) => {
      const dto = buildFidelityDto({
        id: 'detached', capabilitySummary: { kinds },
      }, { validatedEditedAvailable: true })
      expect(dto.fidelity).toMatchObject({
        status: 'reconstructed', editabilityTier: 'preserved-opaque',
      })
      expect(dto.exports.validatedEdited).toMatchObject({
        available: false, reasonCode: 'validated-edited-export-unavailable',
      })
      expect(dto.exports.reconstructed).toMatchObject({
        available: true, reasonCode: null, reason: null,
      })
    },
  )
  it('uses paired safe reason code and text for unavailable exports', () => {
    const dto = buildFidelityDto({ id: 'missing', pptxOriginal: { id: 'source' } }, {
      validatedEditedReasonCode: 'C:\\private\\officecli.stderr',
    })
    expect(dto.exports.original).toEqual({
      available: false,
      label: 'Download Original',
      reasonCode: 'original-package-unverified',
      reason: 'The original package is not verified for download.',
    })
    expect(dto.exports.validatedEdited).toEqual({
      available: false,
      label: 'Export Validated Edited Revision',
      reasonCode: 'validated-edited-export-unavailable',
      reason: 'A validated edited revision is not available.',
    })
  })
  it.each(['top-level', 'original'])('fails closed on malformed %s capability kinds', (location) => {
    const presentation = { id: 'malformed', pptxOriginal: { id: 'source' } }
    const owner = location === 'top-level' ? presentation : presentation.pptxOriginal
    owner.capabilitySummary = { kinds: 'macro' }
    const dto = buildFidelityDto(presentation, { verifiedOriginalAvailable: true, validatedEditedAvailable: true })
    expect(dto.fidelity.status).toBe('original-only')
    expect(dto.exports.validatedEdited).toMatchObject({
      available: false, reasonCode: 'original-only-package',
    })
    expect(dto.exports.reconstructed).toMatchObject({
      available: false, reasonCode: 'original-only-package',
    })
  })
  it('returns typed non-destructive revision conflicts', () => {
    expect(createConflict(2, 3)).toEqual({
      status: 409,
      code: 'pptx-revision-conflict',
      conflict: {
        expectedRevision: 2,
        actualRevision: 3,
        recovery: 'reload-and-review',
        destructive: false,
      },
    })
  })
  it('deduplicates successor generation by idempotency key', async () => {
    const generate = vi.fn(async () => ({ revision: 4 }))
    const enqueue = createSuccessorQueue(generate)
    const request = { presentationId: 'deck', revision: 3, idempotencyKey: 'once' }
    expect(await Promise.all([enqueue(request), enqueue(request)])).toEqual([
      { revision: 4 },
      { revision: 4 },
    ])
    expect(generate).toHaveBeenCalledTimes(1)
  })
})
