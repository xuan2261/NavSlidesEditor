import JSZip from 'jszip'
import { describe, expect, it, vi } from 'vitest'
import plannerModule from './transactional-patch-planner.js'
import canonicalModule from './canonical-feature-matrix.js'
import securityModule from './export-security-preflight.js'
import validatorModule from './transactional-export-validators.js'
import capabilityModule from './export-capabilities.js'
import jobStateModule from './export-job-state.js'
import reasonModule from './reason-code-contract.js'

const { compilePatchPlan: rawCompilePatchPlan } = plannerModule
const compilePatchPlan = (input, options = {}) => rawCompilePatchPlan(input, {
  matrixAuthorityEpoch: 1,
  ...options,
})
const {
  CANONICAL_FEATURE_MATRIX_VERSION, FEATURE_MATRIX_SCHEMA_VERSION, createMatrixAuthoritySubject,
  featureMatrixHash,
} = canonicalModule
const { reasonCodeSubject } = reasonModule
const { securityPreflight } = securityModule
const { runLayeredValidators } = validatorModule
const { exportSurfaceCapabilities, providerEvidencePlaceholder } = capabilityModule
const { cancellationOutcome, transitionExportJob } = jobStateModule

const SEED_ROW_ID = 'primitive.text.run.plain-replacement'
const SEED_BINDINGS = Object.freeze({
  transportId: 'server-snapshot-diff',
  transportSchemaVersion: 1,
  eligibilityPolicyId: 'tiptap-single-plain-run',
  eligibilityPolicyVersion: 1,
  normalizationContractId: 'tiptap-json-html-single-plain-run',
  normalizationContractVersion: 1,
})

function textTransport(text = 'After') {
  return {
    format: 'tiptap-json',
    schemaVersion: 1,
    document: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    },
  }
}

function operation(overrides = {}) {
  const sourceRef = {
    status: 'authoritative',
    kind: 'text-run',
    packageGeneration: 1,
    revisionId: 'r0',
    matchMethod: 'native-id',
    confidence: 1,
    nativeId: '4',
    partUri: 'ppt/slides/slide1.xml',
    sourceHash: 'a'.repeat(64),
    relationshipChain: ['ppt/slides/_rels/slide1.xml.rels'],
  }
  return {
    kind: 'property-change',
    rowId: SEED_ROW_ID,
    objectKind: 'text-run',
    slideId: 's1',
    elementId: 'e1',
    propertyId: 'text',
    operationId: 'replace',
    before: 'Before',
    after: 'After',
    impactClosure: ['ppt/slides/slide1.xml'],
    sourceRef,
    bindings: SEED_BINDINGS,
    textTransport: textTransport(),
    ...overrides,
  }
}

function journal(operations, hash = featureMatrixHash(), matrixAuthorityEpoch = 1) {
  return {
    featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
    featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
    featureMatrixHash: hash,
    matrixAuthoritySubject: createMatrixAuthoritySubject(undefined, matrixAuthorityEpoch),
    reasonCodeSubject: reasonCodeSubject(),
    operations,
  }
}

async function packageBytes(extra = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml',
    '<Types><Default Extension="xml" ContentType="application/xml"/></Types>')
  zip.file('ppt/presentation.xml', '<p:presentation xmlns:p="p"/>')
  zip.file('ppt/slides/slide1.xml', '<p:sld/>')
  for (const [path, bytes] of Object.entries(extra)) zip.file(path, bytes)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}

describe('authoritative transactional patch contracts', () => {
  it('uses the persisted global matrix authority epoch rather than a literal epoch one', () => {
    const plan = compilePatchPlan(journal([operation()], featureMatrixHash(), 7), {
      matrixAuthorityEpoch: 7,
    })

    expect(plan).toMatchObject({
      ok: true,
      matrixAuthoritySubject: expect.objectContaining({ evolutionEpoch: 7 }),
    })
  })

  it('compacts contiguous canonical G2 seed changes and dispatches the registry adapter', () => {
    const first = operation()
    const second = operation({
      before: 'After', after: 'Final', textTransport: textTransport('Final'),
    })
    const plan = compilePatchPlan(journal([first, second]))

    expect(plan).toMatchObject({
      ok: true,
      operations: [{
        rowId: SEED_ROW_ID,
        adapterId: 'native-text-plain-run',
        before: 'Before',
        after: 'Final',
        normalizedText: 'Final',
      }],
      touchedParts: ['ppt/slides/slide1.xml'],
      relationshipClosure: ['ppt/slides/_rels/slide1.xml.rels'],
      featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
      featureMatrixHash: featureMatrixHash(),
      level4Promoted: false,
    })
  })

  it('blocks same-target changes with discontinuous before text', () => {
    const plan = compilePatchPlan(journal([
      operation(),
      operation({ before: 'Middle', after: 'Final', textTransport: textTransport('Final') }),
    ]))

    expect(plan).toMatchObject({
      ok: false,
      reasonCode: 'COMPACTION_BEFORE_AFTER_DISCONTINUITY',
    })
  })

  it.each([
    ['missing row ID', journal([operation({ rowId: undefined })]), 'ROW_ID_MISSING'],
    ['non-seed canonical candidate', journal([operation({ rowId: 'primitive.geometry.basic-transform' })]), 'NON_SEED_ROW'],
    ['missing matrix hash', {
      featureMatrixSchemaVersion: FEATURE_MATRIX_SCHEMA_VERSION,
      featureMatrixVersion: CANONICAL_FEATURE_MATRIX_VERSION,
      operations: [operation()],
    }, 'JOURNAL_MATRIX_HASH_MISSING'],
    ['mismatched matrix hash', journal([operation()], 'b'.repeat(64)), 'JOURNAL_MATRIX_HASH_MISMATCH'],
    ['wrong object kind', journal([operation({ objectKind: 'shape-transform' })]), 'OBJECT_KIND_MISMATCH'],
    ['non-text-run source', journal([operation({ sourceRef: { ...operation().sourceRef, kind: 'shape' } })]), 'SOURCE_OBJECT_KIND_MISMATCH'],
    ['untrusted source', journal([operation({ sourceRef: { ...operation().sourceRef, status: 'ambiguous' } })]), 'SOURCE_NOT_AUTHORITATIVE'],
    ['incomplete authoritative source', journal([operation({ sourceRef: { ...operation().sourceRef, confidence: 0.9 } })]), 'SOURCE_REFERENCE_INVALID'],
    ['wrong property scope', journal([operation({ propertyId: 'content' })]), 'SCOPE_MISMATCH'],
    ['wrong operation scope', journal([operation({ operationId: 'append' })]), 'SCOPE_MISMATCH'],
    ['missing binding', journal([operation({ bindings: { ...SEED_BINDINGS, transportId: undefined } })]), 'BINDING_MISSING'],
    ['mismatched binding', journal([operation({ bindings: { ...SEED_BINDINGS, transportSchemaVersion: 2 } })]), 'BINDING_MISMATCH'],
    ['legacy plain-string transport', journal([operation({ textTransport: 'After' })]), 'TIPTAP_LEGACY_PLAIN_STRING_NOT_ALLOWED'],
  ])('fails closed for %s', (_label, input, reasonCode) => {
    expect(compilePatchPlan(input)).toMatchObject({
      ok: false,
      blockReason: reasonCode,
      reasonCode,
    })
  })

  it('blocks raw operations and caller-supplied matrices from expanding the canonical seed', () => {
    expect(compilePatchPlan(journal([{ ...operation(), kind: 'raw-set' }]))).toMatchObject({
      ok: false, blockReason: 'OPERATION_KIND_UNSUPPORTED',
    })
    expect(compilePatchPlan(journal([operation({
      rowId: 'effect.opacity', propertyId: 'opacity', operationId: 'set', objectKind: 'shape-style',
    })]), [{ id: 'effect.opacity' }])).toMatchObject({
      ok: false, blockReason: 'NON_SEED_ROW',
    })
  })

  it('blocks protected content before adapters', async () => {
    expect(await securityPreflight(await packageBytes({
      'ppt/vbaProject.bin': Buffer.from('macro'),
    }))).toMatchObject({ ok: false, blockReason: 'protected-or-active-content' })
  })

  it('requires the qualified containment lane when requested', async () => {
    const bytes = await packageBytes()
    await expect(runLayeredValidators({
      beforeBytes: bytes, afterBytes: bytes,
      touchedParts: [], requireOfficeCli: true,
    }, { nativeReimport: vi.fn(async () => true) })).rejects.toMatchObject({
      code: 'OFFICECLI_UNAVAILABLE',
    })
  })

  it('requires validators to return literal true', async () => {
    const bytes = await packageBytes()
    await expect(runLayeredValidators({
      beforeBytes: bytes, afterBytes: bytes, touchedParts: [],
    }, { nativeReimport: vi.fn(async () => ({ ok: false })) })).rejects.toThrow('Native semantic validation failed')
  })

  it('labels all export surfaces and never fabricates provider evidence', () => {
    expect(exportSurfaceCapabilities({ hasValidatedRevision: true })).toMatchObject({
      original: { capability: 'original', roundtrip: true },
      edited: { capability: 'validated-edited', available: true, roundtrip: true },
      reconstructed: { capability: 'reconstructed', roundtrip: false },
    })
    expect(providerEvidencePlaceholder('subject')).toEqual({
      status: 'unavailable', provider: null, subjectHash: 'subject',
      claimLevel: null, reason: 'protected-provider-not-configured',
    })
  })

  it('enforces durable transaction order and cancellation point-of-no-return', () => {
    let job = { transactionState: 'requested', cancellationPoint: 'cancellable' }
    for (const state of ['leased', 'staged', 'validated', 'committing']) {
      job = transitionExportJob(job, state)
    }
    expect(cancellationOutcome(job)).toEqual({
      accepted: false, outcome: 'commit-in-progress',
    })
    job = transitionExportJob(job, 'committed')
    expect(cancellationOutcome(job)).toEqual({ accepted: false, outcome: 'committed' })
    expect(() => transitionExportJob(job, 'staged')).toThrow(/Invalid export transaction/)
  })
})
