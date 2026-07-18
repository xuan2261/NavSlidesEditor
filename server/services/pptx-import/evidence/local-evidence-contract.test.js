import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import localEvidence from './local-evidence-contract.js'
import matrixSubject from './matrix-subject.js'
import reasonModule from '../reason-code-contract.js'

const {
  buildLocalEvidenceManifest,
  buildPrivateCapabilityDto,
  compareClaimRepresentations,
  verifyLocalEvidenceManifest,
  verifyStageLineage,
} = localEvidence
const { canonicalMatrixSubject } = matrixSubject
const { reasonCodeSubject } = reasonModule

const hash = (value) => createHash('sha256').update(value).digest('hex')
const sha = (name) => hash(`local-evidence-${name}`)

function fixture(options = {}) {
  const subjectReasonCode = Object.hasOwn(options, 'subjectReasonCode')
    ? options.subjectReasonCode
    : reasonCodeSubject()
  const contents = {
    'package.json': Buffer.from('package report'),
    'semantic.json': Buffer.from('semantic report'),
  }
  const artifacts = Object.entries(contents).map(([alias, bytes]) => ({
    alias,
    kind: alias === 'package.json' ? 'package' : 'semantic',
    byteLength: bytes.length,
    sha256: hash(bytes),
    stageInvocationId: 'stage-package-01',
    stageSubjectHash: sha('stage-subject'),
  }))
  return {
    contents,
    manifest: buildLocalEvidenceManifest({
      subject: {
        packageRevisionHash: sha('revision'),
        originalSha256: sha('original'),
        exportSha256: sha('export'),
        projectionRevisionHash: sha('projection'),
        sourceMapVersion: 'source-map-v1',
        compactedJournalHash: sha('journal'),
        matrix: canonicalMatrixSubject(),
        reasonCodeSubject: subjectReasonCode,
        policyDigest: sha('policy'),
        corpusHash: sha('corpus'),
        commandSetHash: sha('commands'),
        environmentIdentity: { windowsDigest: sha('windows'), officeDigest: sha('office') },
        applicationArtifacts: [{ id: 'portable-exe', sha256: sha('portable') }],
        outputs: [{ id: 'exported-pptx', sha256: sha('output') }],
        thresholds: { digest: sha('thresholds') },
      },
      stage: {
        invocationId: 'stage-package-01',
        rootFlowId: 'flow-01',
        subjectHash: sha('stage-subject'),
      },
      artifacts,
      claimLadder: {
        'original-recovery': { verdict: 'verified', reasons: [] },
        'package-preservation': { verdict: 'verified', reasons: [] },
        'valid-edited-package': { verdict: 'verified', reasons: [] },
        'feature-editability': { verdict: 'unavailable', reasons: ['level4-promotion-unproven'] },
        'powerpoint-compatibility-visual-fidelity': {
          verdict: 'unavailable',
          reasons: ['local-oracle-unavailable'],
        },
      },
    }),
  }
}

describe('local evidence claim contract', () => {
  it('binds every local claim to one complete subject and explicit limitation disclosure', () => {
    const { manifest, contents } = fixture()

    expect(verifyLocalEvidenceManifest(manifest, contents)).toEqual({ verified: true, reasons: [] })
    expect(manifest).toMatchObject({
      authority: 'local',
      subjectHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      limitations: expect.arrayContaining([
        'profile-access-not-proven',
        'network-egress-isolation-not-proven',
        'independent-descendant-containment-not-proven',
        'teardown-attestation-not-proven',
        'separate-approvers-not-proven',
      ]),
    })
  })

  it.each([
    ['missing', undefined],
    ['stale', { ...reasonCodeSubject(), hash: '0'.repeat(64) }],
    ['mismatched', { ...reasonCodeSubject(), version: '0.0.0' }],
  ])('rejects a %s reason-code subject before evidence validation succeeds', (_name, subjectReasonCode) => {
    const { manifest, contents } = fixture({ subjectReasonCode })

    expect(verifyLocalEvidenceManifest(manifest, contents)).toEqual(expect.objectContaining({
      verified: false,
      reasons: expect.arrayContaining(['stale-subject-reason-code-subject']),
    }))
  })

  it.each([
    ['missing exact subject field', (manifest) => delete manifest.subject.compactedJournalHash, 'missing-subject-compacted-journal-hash'],
    ['historical authority', (manifest) => { manifest.authority = 'protected-provider' }, 'historical-authority-not-local'],
    ['unbounded compatibility wording', (manifest) => { manifest.compatibility = 'Compatible everywhere' }, 'unbounded-compatibility-wording'],
    ['missing limitation', (manifest) => { manifest.limitations.pop() }, 'missing-local-limitation'],
    ['mismatched artifact length', (manifest) => { manifest.artifacts[0].byteLength++ }, 'artifact-length-mismatch'],
    ['mixed stage artifact', (manifest) => { manifest.artifacts[1].stageInvocationId = 'other-stage' }, 'mixed-stage-artifact'],
  ])('fails closed for %s', (_name, mutate, reason) => {
    const { manifest, contents } = fixture()
    mutate(manifest)
    expect(verifyLocalEvidenceManifest(manifest, contents).reasons).toContain(reason)
  })

  it('keeps the claim ladder independent and projects only safe private capability fields', () => {
    const { manifest } = fixture()
    const dto = buildPrivateCapabilityDto({
      manifest,
      generation: 4,
      rows: [{ id: 'shape.fill.color', tier: 'native-editable', eligible: true, promoted: false }],
      officeCli: { verdict: 'qualified', age: 'fresh' },
      localOracle: { verdict: 'unavailable' },
      originalAvailable: true,
      environmentSummary: {
        windowsDigest: sha('windows'),
        localUsername: 'secret-user',
        officePath: 'C:\\secret\\office',
      },
      packagePath: 'C:\\secret\\deck.pptx',
      command: 'OfficeCLI validate C:\\secret\\deck.pptx',
    })

    expect(dto).toEqual(expect.objectContaining({
      authority: 'local',
      generation: 4,
      originalAvailable: true,
      claimCeiling: 'valid-edited-package',
    }))
    expect(JSON.stringify(dto)).not.toContain('secret')
    expect(dto.environmentSummary).toEqual({ windowsDigest: sha('windows') })
    expect(dto.claimLadder['feature-editability'].verdict).toBe('unavailable')
    expect(dto.claimLadder['valid-edited-package'].verdict).toBe('verified')
  })

  it('requires all claim-bearing representations to agree on the exact claim core', () => {
    const { manifest } = fixture()
    const capability = buildPrivateCapabilityDto({ manifest, generation: 4, rows: [], originalAvailable: true })
    const release = {
      authority: manifest.authority,
      subjectHash: manifest.subjectHash,
      matrix: manifest.subject.matrix,
      reasonCodeSubject: manifest.subject.reasonCodeSubject,
      claimLadder: manifest.claimLadder,
      limitations: manifest.limitations,
      artifacts: manifest.subject.applicationArtifacts,
    }

    expect(compareClaimRepresentations([capability, release])).toEqual({ matches: true, reasons: [] })
    release.claimLadder['valid-edited-package'] = { verdict: 'failed', reasons: ['semantic-failed'] }
    expect(compareClaimRepresentations([capability, release]).reasons).toContain('claim-representation-mismatch')
    release.claimLadder['valid-edited-package'] = manifest.claimLadder['valid-edited-package']
    release.rows = [{ id: 'primitive.text.run.plain-replacement', verdict: 'verified', reasons: [] }]
    expect(compareClaimRepresentations([capability, release]).reasons).toContain('claim-representation-mismatch')
  })

  it('composes separately admitted stages only through exact lineage hash edges', () => {
    const packageHash = sha('package-output')
    const semanticHash = sha('semantic-output')
    const stages = [
      {
        invocationId: 'package-stage', rootFlowId: 'flow-01', inputSubjectHash: sha('source-input'),
        outputSubjectHash: packageHash,
      },
      {
        invocationId: 'semantic-stage', rootFlowId: 'flow-01', parentInvocationId: 'package-stage',
        inputSubjectHash: packageHash, outputSubjectHash: semanticHash,
      },
    ]

    expect(verifyStageLineage(stages)).toEqual({ valid: true, reasons: [] })
    stages[1].inputSubjectHash = sha('substituted-input')
    expect(verifyStageLineage(stages).reasons).toContain('broken-stage-subject-edge')
  })

  it.each([
    ['missing root', (stages) => { stages[0].parentInvocationId = 'semantic-stage' }, 'missing-root-stage'],
    ['self-parented root', (stages) => { stages[0].parentInvocationId = 'package-stage' }, 'cyclic-stage-lineage'],
  ])('rejects %s stage lineage', (_name, mutate, reason) => {
    const stages = [{
      invocationId: 'package-stage', rootFlowId: 'flow-01', inputSubjectHash: sha('source-input'),
      outputSubjectHash: sha('package-output'),
    }, {
      invocationId: 'semantic-stage', rootFlowId: 'flow-01', parentInvocationId: 'package-stage',
      inputSubjectHash: sha('package-output'), outputSubjectHash: sha('semantic-output'),
    }]
    mutate(stages)
    expect(verifyStageLineage(stages).reasons).toContain(reason)
  })
})
