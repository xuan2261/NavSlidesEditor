import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { createGreenShaRoot, createHostReceipt, createNotSelectedReceipt, createQualificationId, hashReceipt } from './release-receipts.mjs'
import { syntheticSubject, syntheticClient, syntheticLinuxLeaf, syntheticWindowsLeaf } from './release-evidence-test-support.mjs'
import { normalizeGhAttestations } from './windows-verification-evidence.mjs'
const policy = createRequire(import.meta.url)('../../config/release-target-policy.json')
const common = { schemaVersion: 'release-receipt-v1', policyVersion: policy.policyVersion,
  subjectSha: syntheticSubject, clientDigest: syntheticClient,
  lockHashes: { workspace: 'd'.repeat(64), electron: 'e'.repeat(64) } }
function fixture() {
  const qualificationId = createQualificationId(common)
  const linuxReceipt = createHostReceipt({ ...common, qualificationId, host: 'linux-ci', status: 'passed', ...syntheticLinuxLeaf() })
  const parentReceiptHash = hashReceipt(linuxReceipt)
  const child = { ...common, qualificationId, parentReceiptHash }
  return { policy: structuredClone(policy), linuxReceipt,
    windowsAttestationPolicy: { repository: 'example/repo', ref: 'refs/tags/v1.17.0' },
    windowsReceipt: createHostReceipt({ ...child, host: 'windows', status: 'passed', ...syntheticWindowsLeaf() }),
    linuxDesktopReceipt: createNotSelectedReceipt({ ...child, host: 'linux-desktop' }),
    macosDesktopReceipt: createNotSelectedReceipt({ ...child, host: 'macos-desktop' }) }
}
describe('release receipt DAG (synthetic validator fixtures only)', () => {
  it('uses a deterministic non-circular qualification identity', () => {
    expect(createQualificationId(common)).toBe(createQualificationId({ ...common }))
  })
  it('joins leaf-bound Linux Windows and explicit unselected targets', () => {
    const input = fixture()
    const root = createGreenShaRoot(input)
    expect(root.status).toBe('passed')
    expect(root.children.windows.hash).toBe(hashReceipt(input.windowsReceipt))
    expect(root.children['linux-desktop'].status).toBe('not-selected')
    expect(root.artifacts).toEqual(input.windowsReceipt.artifacts)
  })
  it.each(['workflow', 'ref', 'repository'])('rejects internally consistent wrong %s Windows attestation at root', (field) => {
    const input = fixture()
    const leaf = input.windowsReceipt.evidence
    let identity = leaf.attestation[0].workflowIdentity
    if (field === 'workflow') identity = identity.replace('reusable-windows-qualification.yml', 'unauthorized.yml')
    if (field === 'ref') identity = identity.replace('refs/tags/v1.17.0', 'refs/heads/unapproved')
    if (field === 'repository') identity = identity.replace('example/repo', 'example/other')
    for (const result of leaf.attestationRaw) {
      const cert = result.verificationResult.signature.certificate
      cert.subjectAlternativeName = identity
      cert.buildSignerURI = identity
      if (field === 'repository') cert.sourceRepositoryURI = 'https://github.com/example/other'
    }
    const digests = Object.fromEntries(Object.values(input.windowsReceipt.artifacts).map((item) => [item.path, item.sha256]))
    leaf.attestation = normalizeGhAttestations(leaf.attestationRaw, digests,
      { subjectSha: input.windowsReceipt.subjectSha, clientDigest: input.windowsReceipt.clientDigest, workflowIdentity: identity })
    input.windowsReceipt.gates.attestation = hashReceipt(leaf.attestation)
    expect(() => createGreenShaRoot(input)).toThrow(/workflow|certificate/)
  })
  it.each(['source SHA', 'artifact digest', 'issuer', 'client digest'])('retains exact %s Windows attestation binding at root', (field) => {
    const input = fixture()
    const leaf = input.windowsReceipt.evidence
    const result = leaf.attestationRaw[0].verificationResult
    if (field === 'source SHA') result.signature.certificate.sourceRepositoryDigest = 'b'.repeat(40)
    if (field === 'artifact digest') result.statement.subject[0].digest.sha256 = 'b'.repeat(64)
    if (field === 'issuer') result.signature.certificate.issuer = 'https://untrusted.example'
    if (field === 'client digest') leaf.attestation[0].clientDigest = 'b'.repeat(64)
    input.windowsReceipt.gates.attestation = hashReceipt(leaf.attestation)
    expect(() => createGreenShaRoot(input)).toThrow(/attestation/)
  })
  it('rejects missing independently supplied Windows attestation policy', () => {
    const input = fixture()
    delete input.windowsAttestationPolicy
    expect(() => createGreenShaRoot(input)).toThrow(/workflow.*policy|policy.*workflow/)
  })
  it.each(['master', 'refs/pull/123/merge', 'refs/tags/', 'refs/heads/branch with spaces'])('rejects unapproved policy ref %s', (ref) => {
    const input = fixture()
    input.windowsAttestationPolicy.ref = ref
    expect(() => createGreenShaRoot(input)).toThrow(/workflow policy/)
  })
  it('accepts canonical Windows workflow identity at an independently approved branch ref', () => {
    const input = fixture()
    input.windowsAttestationPolicy.ref = 'refs/heads/release'
    const leaf = input.windowsReceipt.evidence
    const workflowIdentity = 'https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/heads/release'
    const cert = leaf.attestationRaw[0].verificationResult.signature.certificate
    cert.subjectAlternativeName = workflowIdentity
    cert.buildSignerURI = workflowIdentity
    const digests = Object.fromEntries(Object.values(input.windowsReceipt.artifacts).map((item) => [item.path, item.sha256]))
    leaf.attestation = normalizeGhAttestations(leaf.attestationRaw, digests,
      { subjectSha: input.windowsReceipt.subjectSha, clientDigest: input.windowsReceipt.clientDigest, workflowIdentity })
    input.windowsReceipt.gates.attestation = hashReceipt(leaf.attestation)
    expect(createGreenShaRoot(input).status).toBe('passed')
  })
  it.each(['skipped', 'blocked', 'failed', 'not-selected'])('rejects selected Windows status %s', (status) => {
    const input = fixture()
    input.windowsReceipt.status = status
    expect(() => createGreenShaRoot(input)).toThrow(/windows must be passed/)
  })
  it('rejects omitted required gates and selected optional hosts', () => {
    const input = fixture()
    delete input.windowsReceipt.gates['officecli-physical']
    expect(() => createGreenShaRoot(input)).toThrow(/missing required gate officecli/)
    const optional = fixture()
    optional.policy.targets['linux-desktop'].selected = true
    expect(() => createGreenShaRoot(optional)).toThrow(/linux-desktop must be passed/)
  })
  it('rejects declaration hashes with no actual Linux leaves', () => {
    const input = fixture()
    delete input.linuxReceipt.evidence
    expect(() => createGreenShaRoot(input)).toThrow(/actual leaf/)
  })
  it.each(['chromium shard', 'stale source', 'attempt', 'leaf hash'])('rejects %s Linux evidence', (scenario) => {
    const input = fixture()
    if (scenario === 'chromium shard') input.linuxReceipt.evidence.jobs.splice(5, 1)
    if (scenario === 'stale source') input.linuxReceipt.evidence.run.head_sha = 'b'.repeat(40)
    if (scenario === 'attempt') input.linuxReceipt.evidence.jobs[0].run_attempt = 2
    if (scenario === 'leaf hash') input.linuxReceipt.gates.playwright = 'f'.repeat(64)
    expect(() => createGreenShaRoot(input)).toThrow(/leaf|shard|hash/)
  })
  it.each(['nsis-exe', 'portable-exe'])('requires Windows artifact %s', (kind) => {
    const input = fixture()
    delete input.windowsReceipt.artifacts[kind]
    expect(() => createGreenShaRoot(input)).toThrow(/artifact kind/)
  })
  it('rejects wrong child subject client and parent edges', () => {
    for (const field of ['subjectSha', 'clientDigest', 'parentReceiptHash']) {
      const input = fixture()
      input.windowsReceipt[field] = 'b'.repeat(field === 'subjectSha' ? 40 : 64)
      expect(() => createGreenShaRoot(input)).toThrow(/mismatch/)
    }
  })
  it('rejects invalid gate digests instead of checking their truthiness', () => {
    const input = fixture()
    input.windowsReceipt.gates.authenticode = 'passed'
    expect(() => createGreenShaRoot(input)).toThrow(/hexadecimal/)
  })
  it('rejects missing independent signature and declaration-only attestation leaves', () => {
    const input = fixture()
    delete Object.values(input.windowsReceipt.evidence.signatures)[0].postVerifier
    expect(() => createGreenShaRoot(input)).toThrow(/signature leaf/)
    const attestation = fixture()
    attestation.windowsReceipt.evidence.attestationRaw = []
    expect(() => createGreenShaRoot(attestation)).toThrow(/attestation results are empty/)
  })
  it('requires both mandatory release targets even when no target is selected', () => {
    const input = fixture()
    input.policy.targets.windows.selected = false
    input.policy.targets['linux-ci'].selected = false
    expect(() => createGreenShaRoot(input)).toThrow(/mandatory release targets/)
  })
})
