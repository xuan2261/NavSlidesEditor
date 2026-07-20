import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import matrix from './canonical-feature-matrix.js'
import evidence from './evidence/evidence-contract.js'
import matrixSubject from './evidence/matrix-subject.js'
import trust from './evidence/trust-validator.js'
import trustRootValidator from './evidence/trust-root-validator.js'

const { CLAIM_LEVELS, evaluateClaim, hashCanonical, parseEvidenceManifest } = evidence
const { CANONICAL_FEATURE_MATRIX } = matrix
const { buildClaimSubject, canonicalMatrixSubject, claimSubjectHash } = matrixSubject
const { manifestClaimDigest } = trust
const { publicKeyFingerprint } = trustRootValidator

const sha = (value) => createHash('sha256').update(value).digest('hex')
const runId = 'run-20260710-0001'
const sourceSha = sha('source')
const exportSha = sha('export')
const keyPairs = Object.fromEntries(
  ['ci', 'provider', 'ledger'].map((name) => [name, generateKeyPairSync('ed25519')])
)

function buildContractOnlyCorpus() {
  const fixtureIds = [...new Set(CANONICAL_FEATURE_MATRIX.flatMap((row) => row.fixtureIds))].sort()
  const features = CANONICAL_FEATURE_MATRIX.map((row) => {
    const coverage = {
      rowId: row.id,
      fixtureIds: row.fixtureIds,
      editabilityTier: row.tier,
      requiredTests: row.requiredTestIds,
      claimLevel: row.claimCeiling,
      status: row.level4Promoted ? 'covered' : 'excluded',
      ...(row.level4Promoted ? {} : { exclusionReason: row.reason }),
    }
    return { ...coverage, sha256: hashCanonical(coverage) }
  })
  return {
    schemaVersion: 2,
    matrix: canonicalMatrixSubject(),
    decks: fixtureIds.map((id) => ({ id, sha256: sha(id) })),
    fixtureMap: Object.fromEntries(fixtureIds.map((id) => [id, id])),
    features,
  }
}
const policy = {
  identity: 'navslides-pptx-claim-v1',
  releaseChannel: 'stable',
  claimId: 'pptx-roundtrip',
  ci: {
    issuer: 'https://token.actions.githubusercontent.com',
    repository: 'xuan2261/NavSlidesEditor',
    workflow: '.github/workflows/pptx-claim.yml',
    ref: 'refs/heads/master',
    environment: 'pptx-claims',
  },
  provider: { runner: 'officecli-protected' },
  thresholds: { meanSsim: 0.99 },
  privacy: { visibility: 'private', redaction: 'slide-content', retentionDays: 30 },
}
policy.digest = hashCanonical(
  Object.fromEntries(Object.entries(policy).filter(([key]) => key !== 'digest'))
)

function signed(value, authority) {
  return {
    ...value,
    signature: sign(
      null,
      Buffer.from(hashCanonical(value)),
      keyPairs[authority].privateKey
    ).toString('base64'),
  }
}

function fixture(claimLevel = CLAIM_LEVELS[4]) {
  const corpus = buildContractOnlyCorpus()
  const corpusManifestHash = hashCanonical(corpus)
  const artifactContents = {
    'source.pptx': Buffer.from('source'),
    'export.pptx': Buffer.from('export'),
    'validity.json': Buffer.from(
      JSON.stringify({
        kind: 'validity',
        result: 'pass',
        packageRevision: 7,
      })
    ),
    'semantic.json': Buffer.from(
      JSON.stringify({
        kind: 'semantic',
        result: 'pass',
        tests: [{ id: 'edit-text', result: 'pass' }],
      })
    ),
    'security.json': Buffer.from(JSON.stringify({ kind: 'security', result: 'pass' })),
    'resource.json': Buffer.from(JSON.stringify({ kind: 'resource', result: 'pass' })),
    'visual.json': Buffer.from(
      JSON.stringify({
        kind: 'visual',
        result: 'pass',
        meanSsim: 0.995,
        threshold: { meanSsim: 0.99 },
      })
    ),
  }
  const artifact = (kind, file) => ({
    kind,
    path: file,
    runId,
    sha256: sha(artifactContents[file]),
    sourceSha,
    exportSha,
    packageRevision: 7,
    result: 'pass',
  })
  const artifacts = [
    artifact('original', 'source.pptx'),
    artifact('package', 'export.pptx'),
    artifact('validity', 'validity.json'),
    artifact('semantic', 'semantic.json'),
    artifact('security', 'security.json'),
    artifact('resource', 'resource.json'),
    {
      ...artifact('visual', 'visual.json'),
      width: 1920,
      height: 1080,
      sourceRenderer: 'powerpoint-source',
      candidateRenderer: 'powerpoint-export',
    },
  ]
  const manifest = {
    schemaVersion: 2,
    matrix: canonicalMatrixSubject(),
    claimLevel,
    runId,
    sourceSha256: sourceSha,
    exportSha256: exportSha,
    packageRevision: 7,
    corpusManifestHash,
    corpusDeckIds: corpus.decks.map((deck) => deck.id),
    testCommit: sha('release'),
    releaseCommit: sha('release'),
    command: 'npm run test:pptx:claim',
    lanes: ['original', 'package', 'validity', 'semantic', 'security', 'resource', 'visual'],
    renderer: 'powerpoint',
    provider: 'officecli',
    providerRole: 'claim-authoritative',
    os: 'windows-2025',
    officeBuild: '16.0.19029',
    fonts: ['Arial'],
    officeCli: { version: '1.2.3', sha256: sha('officecli') },
    thresholds: { meanSsim: 0.99 },
    policyDigest: policy.digest,
    evidenceEpoch: 2,
    createdAt: '2026-07-10T10:00:00.000Z',
    expiresAt: '2026-08-09T10:00:00.000Z',
    artifacts,
    privacy: policy.privacy,
  }
  manifest.claimSubject = buildClaimSubject(manifest)
  const subjectHash = claimSubjectHash(manifest.claimSubject)
  manifest.artifacts = manifest.artifacts.map((artifact) => ({
    ...artifact,
    claimSubjectHash: subjectHash,
  }))
  manifest.ciAttestation = signed(
    {
      ...policy.ci,
      policyDigest: policy.digest,
      releaseCommit: sha('release'),
      artifactDigest: hashCanonical(manifest.artifacts),
      claimDigest: manifestClaimDigest(manifest),
    },
    'ci'
  )
  manifest.providerAttestation = signed(
    {
      runner: policy.provider.runner,
      policyDigest: policy.digest,
      releaseCommit: sha('release'),
      artifactDigest: hashCanonical(manifest.artifacts.filter((item) => item.kind === 'visual')),
      claimDigest: manifestClaimDigest(manifest),
    },
    'provider'
  )
  const ledgerEntry = {
    ledgerIdentity: 'navslides-release-ledger',
    releaseChannel: policy.releaseChannel,
    claimId: policy.claimId,
    policyDigest: policy.digest,
    epoch: 2,
    releaseCommit: sha('release'),
    predecessor: 1,
    predecessorDigest: sha('checkpoint-1'),
    transparencyDigest: hashCanonical({ epoch: 2, releaseCommit: sha('release') }),
  }
  const trustRoot = {
    approvedPolicyIdentity: policy.identity,
    policy,
    publicKeys: Object.fromEntries(
      Object.entries(keyPairs).map(([name, pair]) => [
        name,
        pair.publicKey.export({ type: 'spki', format: 'pem' }),
      ])
    ),
  }
  return {
    manifest,
    corpus: structuredClone(corpus),
    artifactContents,
    now: new Date('2026-07-11T10:00:00.000Z'),
    trustRoot,
    trustedConfig: {
      rootSha256: hashCanonical(trustRoot),
      policyIdentity: policy.identity,
      authorityFingerprints: Object.fromEntries(
        Object.entries(trustRoot.publicKeys).map(([role, key]) => [role, publicKeyFingerprint(key)])
      ),
      ledgerCheckpoint: {
        identity: 'navslides-release-ledger',
        epoch: 1,
        digest: sha('checkpoint-1'),
      },
    },
    ledger: {
      identity: 'navslides-release-ledger',
      entries: [signed(ledgerEntry, 'ledger')],
    },
  }
}

function refreshEvidenceBindings(data) {
  const { manifest } = data
  manifest.claimSubject = buildClaimSubject(manifest)
  const subjectHash = claimSubjectHash(manifest.claimSubject)
  manifest.artifacts = manifest.artifacts.map((artifact) => ({
    ...artifact,
    claimSubjectHash: subjectHash,
  }))
  manifest.ciAttestation = signed(
    {
      ...policy.ci,
      policyDigest: policy.digest,
      releaseCommit: manifest.releaseCommit,
      artifactDigest: hashCanonical(manifest.artifacts),
      claimDigest: manifestClaimDigest(manifest),
    },
    'ci'
  )
  if (manifest.providerAttestation) {
    manifest.providerAttestation = signed(
      {
        runner: policy.provider.runner,
        policyDigest: policy.digest,
        releaseCommit: manifest.releaseCommit,
        artifactDigest: hashCanonical(manifest.artifacts.filter((item) => item.kind === 'visual')),
        claimDigest: manifestClaimDigest(manifest),
      },
      'provider'
    )
  }
}

function refreshCorpusBinding(data) {
  data.manifest.corpusManifestHash = hashCanonical(data.corpus)
  refreshEvidenceBindings(data)
}

function updateCoverageRow(data, index, update) {
  const { sha256: _sha256, ...coverage } = data.corpus.features[index]
  const next = update(coverage)
  data.corpus.features[index] = { ...next, sha256: hashCanonical(next) }
  refreshCorpusBinding(data)
}

describe('versioned evidence claim contract', () => {
  it('parses a complete manifest and rejects unknown or missing contract fields', () => {
    expect(parseEvidenceManifest(fixture().manifest).ok).toBe(true)
    expect(parseEvidenceManifest({ ...fixture().manifest, schemaVersion: 3 }).reasons).toContain(
      'unsupported-schema-version'
    )
    const missing = { ...fixture().manifest }
    delete missing.runId
    expect(parseEvidenceManifest(missing).reasons).toContain('missing-run-id')
  })

  it.each([
    [
      'placeholder dimensions',
      (f) => {
        f.manifest.artifacts[6].width = 8
      },
      'visual-placeholder',
    ],
    [
      'placeholder marker',
      (f) => {
        f.manifest.artifacts[6].placeholder = true
      },
      'visual-placeholder',
    ],
    [
      'self comparison',
      (f) => {
        f.manifest.artifacts[6].candidateRenderer = 'powerpoint-source'
      },
      'visual-self-comparison',
    ],
    [
      'cross-run evidence',
      (f) => {
        f.manifest.artifacts[1].runId = 'old-run'
      },
      'cross-run-evidence',
    ],
    [
      'package hash mismatch',
      (f) => {
        f.manifest.artifacts[2].exportSha = sha('wrong')
      },
      'artifact-package-mismatch',
    ],
    [
      'stale corpus',
      (f) => {
        f.manifest.corpusManifestHash = sha('old-corpus')
      },
      'stale-corpus-manifest',
    ],
    [
      'incomplete corpus',
      (f) => {
        f.manifest.corpusDeckIds = ['deck-a']
      },
      'incomplete-corpus-deck-set',
    ],
    [
      'missing provider provenance',
      (f) => {
        delete f.manifest.officeBuild
      },
      'missing-office-build',
    ],
    [
      'tampered CI artifact digest',
      (f) => {
        f.manifest.ciAttestation.artifactDigest = sha('tampered')
      },
      'ci-attestation-artifact-mismatch',
    ],
    [
      'wrong workflow',
      (f) => {
        f.manifest.ciAttestation.workflow = 'fork.yml'
      },
      'untrusted-ci-workflow',
    ],
    [
      'policy downgrade',
      (f) => {
        f.manifest.policyDigest = sha('old-policy')
      },
      'policy-digest-mismatch',
    ],
    [
      'older replay',
      (f) => {
        f.manifest.evidenceEpoch = 1
      },
      'evidence-epoch-replay',
    ],
    [
      'wrong release commit',
      (f) => {
        f.manifest.releaseCommit = sha('wrong-release')
      },
      'release-commit-mismatch',
    ],
  ])('rejects %s deterministically', (_name, mutate, reason) => {
    const data = fixture()
    mutate(data)
    expect(evaluateClaim(data).reasons).toContain(reason)
  })

  it('rejects duplicate highest epochs and a forked predecessor', () => {
    const duplicate = fixture()
    duplicate.ledger.entries.push({ ...duplicate.ledger.entries[0] })
    expect(evaluateClaim(duplicate).reasons).toContain('duplicate-ledger-epoch')
    const fork = fixture()
    fork.ledger.entries[0].predecessor = 0
    expect(evaluateClaim(fork).reasons).toContain('ledger-predecessor-mismatch')
  })

  it('keeps lower claims independent while level 5 requires provider evidence', () => {
    const lower = fixture(CLAIM_LEVELS[1])
    lower.manifest.artifacts = lower.manifest.artifacts.filter((artifact) =>
      ['original', 'package', 'security', 'resource'].includes(artifact.kind)
    )
    lower.manifest.lanes = ['original', 'package', 'security', 'resource']
    delete lower.manifest.providerAttestation
    delete lower.manifest.officeBuild
    const { signature: _signature, ...ci } = lower.manifest.ciAttestation
    lower.manifest.ciAttestation = signed(
      {
        ...ci,
        artifactDigest: hashCanonical(lower.manifest.artifacts),
        claimDigest: manifestClaimDigest(lower.manifest),
      },
      'ci'
    )
    expect(evaluateClaim(lower).reasons).toContain('no-edit-sha256-mismatch')

    const visual = fixture()
    delete visual.manifest.providerAttestation
    expect(evaluateClaim(visual).reasons).toContain('missing-provider-attestation')
  })

  it('permits exact no-edit export bytes for package preservation', () => {
    const noEdit = fixture(CLAIM_LEVELS[1])
    noEdit.artifactContents['export.pptx'] = Buffer.from(noEdit.artifactContents['source.pptx'])
    noEdit.manifest.exportSha256 = noEdit.manifest.sourceSha256
    noEdit.manifest.sourceOpcInventory = { '/ppt/presentation.xml': sha('source-part') }
    noEdit.manifest.exportOpcInventory = { '/ppt/presentation.xml': sha('source-part') }
    noEdit.manifest.artifacts = noEdit.manifest.artifacts
      .filter((artifact) => ['original', 'package', 'security', 'resource'].includes(artifact.kind))
      .map((artifact) => ({
        ...artifact,
        exportSha: noEdit.manifest.sourceSha256,
        sha256: artifact.kind === 'package' ? noEdit.manifest.sourceSha256 : artifact.sha256,
      }))
    noEdit.manifest.lanes = ['original', 'package', 'security', 'resource']
    delete noEdit.manifest.providerAttestation
    delete noEdit.manifest.officeBuild
    refreshEvidenceBindings(noEdit)

    expect(noEdit.manifest.sourceSha256).toBe(noEdit.manifest.exportSha256)
    expect(noEdit.artifactContents['source.pptx']).toEqual(noEdit.artifactContents['export.pptx'])
    expect(evaluateClaim(noEdit)).toMatchObject({
      passed: true,
      claimLevel: 'package-preservation',
    })
  })

  it('rejects mismatched no-edit bytes despite matching metadata and inventory', () => {
    const noEdit = fixture(CLAIM_LEVELS[1])
    noEdit.manifest.exportSha256 = noEdit.manifest.sourceSha256
    noEdit.manifest.sourceOpcInventory = { '/ppt/presentation.xml': sha('same-part') }
    noEdit.manifest.exportOpcInventory = { '/ppt/presentation.xml': sha('same-part') }
    noEdit.manifest.artifacts = noEdit.manifest.artifacts
      .filter((artifact) => ['original', 'package', 'security', 'resource'].includes(artifact.kind))
      .map((artifact) => ({ ...artifact, exportSha: noEdit.manifest.sourceSha256,
        sha256: artifact.kind === 'package' ? noEdit.manifest.sourceSha256 : artifact.sha256 }))
    noEdit.manifest.lanes = ['original', 'package', 'security', 'resource']
    delete noEdit.manifest.providerAttestation
    delete noEdit.manifest.officeBuild
    refreshEvidenceBindings(noEdit)
    expect(evaluateClaim(noEdit).reasons).toContain('no-edit-byte-identity-mismatch')
  })

  it('fails closed without executing getters in untrusted evidence', () => {
    const manifest = {}
    Object.defineProperty(manifest, 'claimLevel', { get: () => { throw new Error('getter') } })
    expect(evaluateClaim({ manifest }).reasons).toContain('missing-claim-level')
  })

  it('requires canonical exclusions and explicit privacy policy', () => {
    const coverage = fixture(CLAIM_LEVELS[3])
    updateCoverageRow(coverage, 0, ({ exclusionReason: _reason, ...row }) => row)
    expect(evaluateClaim(coverage).reasons).toContain('feature-exclusion-reason-required')
    const privacy = fixture()
    delete privacy.manifest.privacy
    expect(evaluateClaim(privacy).reasons).toContain('missing-evidence-privacy-policy')
  })

  it.each([
    [
      'unsigned CI attestation',
      (f) => {
        delete f.manifest.ciAttestation.signature
      },
      'invalid-ci-signature',
    ],
    [
      'unsigned provider attestation',
      (f) => {
        delete f.manifest.providerAttestation.signature
      },
      'invalid-provider-signature',
    ],
    [
      'unsigned ledger entry',
      (f) => {
        delete f.ledger.entries[0].signature
      },
      'invalid-ledger-signature',
    ],
    [
      'shared CI and provider key',
      (f) => {
        f.trustRoot.publicKeys.provider = f.trustRoot.publicKeys.ci
      },
      'non-independent-authority-keys',
    ],
    [
      'private key embedded in trust root',
      (f) => {
        f.trustRoot.publicKeys.ci = keyPairs.ci.privateKey.export({
          type: 'pkcs8',
          format: 'pem',
        })
      },
      'trust-root-private-key-forbidden',
    ],
    [
      'run-supplied policy without trust root',
      (f) => {
        f.policy = f.trustRoot.policy
        delete f.trustRoot
      },
      'missing-trust-root',
    ],
    [
      'unapproved policy identity',
      (f) => {
        f.trustRoot.approvedPolicyIdentity = 'attacker-policy'
      },
      'unapproved-policy-identity',
    ],
    [
      'false artifact result',
      (f) => {
        f.manifest.artifacts[2].result = 'fail'
      },
      'artifact-result-failed',
    ],
    [
      'mislabeled artifact report',
      (f) => {
        f.artifactContents['security.json'] = Buffer.from(
          JSON.stringify({
            kind: 'resource',
            result: 'pass',
          })
        )
        f.manifest.artifacts[4].sha256 = sha(f.artifactContents['security.json'])
      },
      'artifact-kind-mismatch',
    ],
    [
      'missing security lane',
      (f) => {
        f.manifest.artifacts = f.manifest.artifacts.filter((item) => item.kind !== 'security')
        f.manifest.lanes = f.manifest.lanes.filter((lane) => lane !== 'security')
      },
      'missing-security-artifact',
    ],
    [
      'missing resource lane',
      (f) => {
        f.manifest.artifacts = f.manifest.artifacts.filter((item) => item.kind !== 'resource')
        f.manifest.lanes = f.manifest.lanes.filter((lane) => lane !== 'resource')
      },
      'missing-resource-artifact',
    ],
    [
      'artifact hash not bound to file bytes',
      (f) => {
        f.artifactContents['validity.json'] = Buffer.from('tampered')
      },
      'artifact-file-hash-mismatch',
    ],
    [
      'artifact report result disagrees with metadata',
      (f) => {
        f.artifactContents['validity.json'] = Buffer.from(
          JSON.stringify({
            kind: 'validity',
            result: 'fail',
            packageRevision: 7,
          })
        )
        f.manifest.artifacts[2].sha256 = sha(f.artifactContents['validity.json'])
      },
      'artifact-result-failed',
    ],
    [
      'artifact report threshold disagrees with policy',
      (f) => {
        f.artifactContents['visual.json'] = Buffer.from(
          JSON.stringify({
            kind: 'visual',
            result: 'pass',
            meanSsim: 0.995,
            threshold: { meanSsim: 0.5 },
          })
        )
        f.manifest.artifacts[6].sha256 = sha(f.artifactContents['visual.json'])
      },
      'artifact-threshold-mismatch',
    ],
    [
      'threshold downgrade',
      (f) => {
        f.manifest.thresholds.meanSsim = 0.5
      },
      'threshold-policy-mismatch',
    ],
    [
      'failed threshold outcome',
      (f) => {
        f.artifactContents['visual.json'] = Buffer.from(
          JSON.stringify({
            kind: 'visual',
            result: 'pass',
            meanSsim: 0.98,
            threshold: { meanSsim: 0.99 },
          })
        )
        f.manifest.artifacts[6].sha256 = sha(f.artifactContents['visual.json'])
      },
      'visual-threshold-failed',
    ],
    [
      'omitted canonical required test',
      (f) => {
        updateCoverageRow(f, 0, (row) => ({ ...row, requiredTests: [] }))
      },
      'canonical-feature-required-tests-mismatch',
    ],
    [
      'mismatched canonical fixture ID',
      (f) => {
        updateCoverageRow(f, 0, (row) => ({ ...row, fixtureIds: ['missing-deck'] }))
      },
      'canonical-feature-fixtures-mismatch',
    ],
  ])('rejects %s', (_name, mutate, reason) => {
    const data = fixture()
    mutate(data)
    expect(evaluateClaim(data).reasons).toContain(reason)
  })

  it.each([
    [
      'missing matrix identity',
      (f) => {
        delete f.manifest.matrix
      },
      'missing-feature-matrix',
    ],
    [
      'mismatched matrix identity',
      (f) => {
        f.manifest.matrix = { ...f.manifest.matrix, matrixVersion: '0.0.0' }
        refreshEvidenceBindings(f)
      },
      'stale-feature-matrix-subject',
    ],
    [
      'stale corpus matrix identity',
      (f) => {
        f.corpus.matrix = { ...f.corpus.matrix, hash: sha('stale-matrix') }
        refreshCorpusBinding(f)
      },
      'stale-corpus-matrix-subject',
    ],
    [
      'stale exact claim subject',
      (f) => {
        f.manifest.claimSubject = {
          ...f.manifest.claimSubject,
          matrix: { ...f.manifest.claimSubject.matrix, hash: sha('stale-matrix') },
        }
      },
      'stale-claim-subject',
    ],
    [
      'artifact subject mismatch',
      (f) => {
        f.manifest.artifacts[0].claimSubjectHash = sha('stale-subject')
      },
      'artifact-claim-subject-mismatch',
    ],
    [
      'unknown canonical row',
      (f) => {
        updateCoverageRow(f, 0, (row) => ({ ...row, rowId: 'unknown.feature.row' }))
      },
      'unknown-canonical-feature-row',
    ],
    [
      'duplicate canonical row',
      (f) => {
        f.corpus.features[1] = { ...f.corpus.features[0] }
        refreshCorpusBinding(f)
      },
      'duplicate-canonical-feature-row',
    ],
    [
      'legacy tier',
      (f) => {
        updateCoverageRow(f, 0, (row) => ({ ...row, editabilityTier: 'native' }))
      },
      'legacy-feature-tier',
    ],
    [
      'broad family overclaim',
      (f) => {
        updateCoverageRow(f, 0, (row) => ({ ...row, rowId: 'primitive.text' }))
      },
      'unknown-canonical-feature-row',
    ],
    [
      'missing canonical coverage row',
      (f) => {
        f.corpus.features.pop()
        refreshCorpusBinding(f)
      },
      'incomplete-canonical-feature-coverage',
    ],
  ])('rejects an unbound matrix subject or noncanonical coverage', (_name, mutate, reason) => {
    const data = fixture()
    mutate(data)
    expect(evaluateClaim(data).reasons).toContain(reason)
  })

  it('keeps lower claims independent but does not invent level-4 promotion', () => {
    expect(evaluateClaim(fixture(CLAIM_LEVELS[1])).reasons).toContain('no-edit-sha256-mismatch')
    expect(evaluateClaim(fixture(CLAIM_LEVELS[3])).reasons).toContain(
      'no-promoted-feature-coverage'
    )
  })

  it.each([
    [
      'future creation time',
      '2026-07-12T10:00:00.000Z',
      '2026-08-09T10:00:00.000Z',
      'evidence-created-in-future',
    ],
    [
      'expired evidence',
      '2026-06-01T10:00:00.000Z',
      '2026-07-01T10:00:00.000Z',
      'evidence-expired',
    ],
    [
      'inverted timestamps',
      '2026-07-10T10:00:00.000Z',
      '2026-07-09T10:00:00.000Z',
      'evidence-time-range-inverted',
    ],
    [
      'retention exceeded',
      '2026-07-10T10:00:00.000Z',
      '2026-09-10T10:00:00.000Z',
      'evidence-retention-exceeded',
    ],
  ])('rejects %s', (_name, createdAt, expiresAt, reason) => {
    const data = fixture()
    data.manifest.createdAt = createdAt
    data.manifest.expiresAt = expiresAt
    expect(evaluateClaim(data).reasons).toContain(reason)
  })
})
