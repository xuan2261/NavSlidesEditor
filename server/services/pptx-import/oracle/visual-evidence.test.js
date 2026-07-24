import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import localEvidence from '../evidence/local-evidence-contract.js'
import receiptsModule from '../evidence/local-role-receipts.js'
import matrixModule from '../evidence/matrix-subject.js'
import reasonModule from '../reason-code-contract.js'
import visualEvidence from './visual-evidence.js'

const { buildLocalEvidenceManifest } = localEvidence
const { createRoleReceipt } = receiptsModule
const { canonicalMatrixSubject } = matrixModule
const { reasonCodeSubject } = reasonModule
const { validateVisualEvidenceEnvelope, validateVisualGoldenEnvironment } = visualEvidence
const sha = (value) => createHash('sha256').update(value).digest('hex')

function fixture() {
  const contents = {
    'corpus.json': Buffer.from('corpus'), 'golden.json': Buffer.from('goldens'),
    'actual.json': Buffer.from('actuals'), 'result.json': Buffer.from('result'),
  }
  const visual = {
    schemaVersion: 1,
    corpusManifestDigest: sha(contents['corpus.json']), goldenManifestDigest: sha(contents['golden.json']),
    actualManifestDigest: sha(contents['actual.json']), resultDigest: sha(contents['result.json']), executionDigest: sha('execution'),
    environment: {
      windowsDigest: sha('windows'), officeDigest: sha('office'), fontSetDigest: sha('fonts'), localeDigest: sha('locale'),
      dpiScaleDigest: sha('dpi'), viewportDigest: sha('viewport'), cropLetterboxPolicyDigest: sha('crop'),
      resamplingPolicyDigest: sha('resampling'), capturePolicyDigest: sha('capture'),
    },
    thresholds: { policyId: 'phase08_full', meanSsim: 0.99, minSsim: 0.97, policyDigest: sha('policy') },
    artifacts: { corpus: 'corpus.json', golden: 'golden.json', actual: 'actual.json', result: 'result.json' },
    authorizationPolicyHash: sha('authorization'),
    receiptWindow: { start: '2026-07-22T10:00:00.000Z', publishedAt: '2026-07-22T10:01:00.000Z' },
  }
  const artifacts = Object.entries(contents).map(([alias, bytes]) => ({
    alias, kind: 'visual-evidence', byteLength: bytes.length, sha256: sha(bytes),
    stageInvocationId: 'visual-stage', stageSubjectHash: sha('stage'),
  }))
  const manifest = buildLocalEvidenceManifest({
    subject: {
      packageRevisionHash: sha('revision'), originalSha256: sha('original'), exportSha256: sha('export'),
      projectionRevisionHash: sha('projection'), sourceMapVersion: 'v1', compactedJournalHash: sha('journal'),
      matrix: canonicalMatrixSubject(), reasonCodeSubject: reasonCodeSubject(), policyDigest: sha('policy'),
      corpusHash: visual.corpusManifestDigest, commandSetHash: sha('commands'), environmentIdentity: visual.environment,
      applicationArtifacts: [{ id: 'navslides-build', sha256: sha('application') }],
      outputs: [{ id: 'visual-result', sha256: visual.resultDigest }], thresholds: { digest: visual.thresholds.policyDigest }, visualOracle: visual,
    },
    stage: { invocationId: 'visual-stage', rootFlowId: 'visual-flow', subjectHash: sha('stage') }, artifacts,
    claimLadder: {
      'original-recovery': { verdict: 'verified', reasons: [] }, 'package-preservation': { verdict: 'verified', reasons: [] },
      'valid-edited-package': { verdict: 'verified', reasons: [] }, 'feature-editability': { verdict: 'unavailable', reasons: ['not-proven'] },
      'powerpoint-compatibility-visual-fidelity': { verdict: 'unavailable', reasons: ['visual-gate-pending'] },
    },
  })
  const receipts = ['app-storage', 'security', 'release'].map((role) => createRoleReceipt({
    receiptId: `receipt-${role}`, role, decision: 'approve', subjectHash: manifest.subjectHash,
    observedExecutionHash: visual.executionDigest, terminalMachineResultHash: visual.resultDigest,
    owner: { source: 'local-browser-binding', digest: sha('one-owner') }, authorizationPolicyHash: visual.authorizationPolicyHash,
    invocationId: `invoke-${role}`, decidedAt: '2026-07-22T10:00:30.000Z',
  }))
  return { manifest, contents, receipts }
}

describe('visual local evidence envelope', () => {
  it('binds visual artifacts, fixed policy, environment, and three local role receipts', () => {
    const { manifest, contents, receipts } = fixture()
    expect(validateVisualEvidenceEnvelope({ manifest, contents, receipts })).toEqual({ valid: true, reasons: [] })
  })

  it('requires the envelope environment to match its PowerPoint golden metadata', () => {
    const { manifest } = fixture()
    const environment = manifest.subject.visualOracle.environment
    const goldenManifest = {
      renderer: { officeDigest: environment.officeDigest, windowsDigest: environment.windowsDigest },
      captureEnvironment: {
        fontSetDigest: environment.fontSetDigest, localeDigest: environment.localeDigest,
        dpiScaleDigest: environment.dpiScaleDigest, viewportDigest: environment.viewportDigest,
        cropLetterboxPolicyDigest: environment.cropLetterboxPolicyDigest,
        resamplingPolicyDigest: environment.resamplingPolicyDigest,
      },
    }
    expect(validateVisualGoldenEnvironment({ manifest, goldenManifest })).toEqual({ valid: true, reasons: [] })
    goldenManifest.captureEnvironment.localeDigest = sha('other-locale')
    expect(validateVisualGoldenEnvironment({ manifest, goldenManifest })).toEqual(expect.objectContaining({
      valid: false, reasons: expect.arrayContaining(['visual-golden-environment-mismatch']),
    }))
  })

  it.each([
    ['missing receipts', ({ receipts }) => receipts.splice(2), 'missing-powerpoint-role-receipts'],
    ['candidate threshold', ({ manifest }) => { manifest.subject.visualOracle.thresholds.meanSsim = 0.98 }, 'visual-threshold-policy-mismatch'],
    ['receipt result mismatch', ({ receipts }) => { receipts[0] = { ...receipts[0], terminalMachineResultHash: sha('other') } }, 'role-receipt-result-mismatch'],
    ['unsafe artifact alias', ({ manifest }) => { manifest.subject.visualOracle.artifacts.golden = '../golden.json' }, 'unsafe-visual-artifact-alias'],
  ])('rejects %s as claim evidence', (_name, mutate, reason) => {
    const input = fixture()
    mutate(input)
    expect(validateVisualEvidenceEnvelope(input)).toEqual(expect.objectContaining({
      valid: false, reasons: expect.arrayContaining([reason]),
    }))
  })
})
