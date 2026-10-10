import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { classifyWindowsArtifacts, normalizeGhAttestations } from './windows-verification-evidence.mjs'
import { createPhysicalReleaseEnvelope } from './physical-release-envelope.mjs'
import { sha256 } from './release-receipt-canonical.mjs'
import { syntheticSubject, syntheticClient, syntheticGhResult, syntheticRun, syntheticArtifact, syntheticPhysicalReceipt, pinnedManifest } from './release-evidence-test-support.mjs'
import genuineGh from './fixtures/gh-v2.83.2-upstream-success.json'
import genuineProvenance from './fixtures/gh-v2.83.2-upstream-success.provenance.json'
const cli = resolve('scripts/ci/release-receipt-workflow.mjs')
const roots = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })
describe('independent Windows verification producer', () => {
  it.skipIf(process.platform !== 'win32')('emits one JSON document at the real PowerShell capture output seam', () => {
    // Exercise only real .NET collection output and the production serialization block.
    // Synthetic certificate fields/bytes do not prove signature, chain or RFC3161 trust.
    const source = readFileSync(resolve('scripts/ci/windows-verification-evidence.mjs'), 'utf8')
    const capture = source.match(/const CAPTURE = String\.raw`([\s\S]*?)`/)[1]
    const policyAdd = capture.split('\n').find((line) => line.includes('ApplicationPolicy.Add('))
    const output = capture.slice(capture.indexOf("@{ status='Valid';"))
    const root = mkdtempSync(join(tmpdir(), 'navslides-powershell-output-'))
    roots.push(root)
    const exe = join(root, 'synthetic-output-seam.exe')
    writeFileSync(exe, 'Not a signed executable; serialization seam only')
    const script = `$ErrorActionPreference = 'Stop'
      $at = [datetime]::Parse('2000-01-01T00:00:00Z').ToUniversalTime()
      $s = @{SignerCertificate=@{Subject='CN=Output seam';Thumbprint='synthetic';NotBefore=$at;NotAfter=$at}}
      foreach ($oid in @('1.3.6.1.5.5.7.3.3', '1.3.6.1.5.5.7.3.8')) {
        $chain = [Security.Cryptography.X509Certificates.X509Chain]::new()
        $pair = @($null, $oid)
        ${policyAdd}
        $chain.Dispose()
      }
      ${output}`
    const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8', env: { ...process.env, NS_VERIFY_EXE: exe },
    })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    const signature = JSON.parse(result.stdout)
    expect(signature).toEqual({ status: 'Valid', signerSubject: 'CN=Output seam', signerThumbprint: 'synthetic',
      certificate: { notBefore: '2000-01-01T00:00:00.0000000Z', notAfter: '2000-01-01T00:00:00.0000000Z' },
      chainTrusted: true, timestamp: { type: 'RFC3161', trusted: true, value: '2000-01-01T00:00:00.0000000Z' },
      sha256: sha256(readFileSync(exe)) })
    expect(result.stdout.trim()).toMatch(/^\{.*\}$/)
  })
  it('rejects post-download signer declarations without running an independent verifier', () => {
    const root = mkdtempSync(join(tmpdir(), 'navslides-signature-negative-'))
    roots.push(root)
    mkdirSync(join(root, 'evidence/signer'), { recursive: true })
    const name = 'NavSlides Editor Setup 1.17.0.exe'
    writeFileSync(join(root, name), 'Synthetic bytes; not a signed executable')
    const signature = { status: 'Valid', signerSubject: 'Synthetic signer', signerThumbprint: 'A'.repeat(40),
      timestamp: { type: 'RFC3161', trusted: true, value: '2000-01-01T00:00:00Z' } }
    writeFileSync(join(root, 'evidence/signer', name + '.json'), JSON.stringify({ signature }))
    writeFileSync(join(root, 'evidence', name + '.json'), JSON.stringify({ path: name, preUpload: signature }))
    const result = spawnSync(process.execPath, [cli, 'authenticode-post', name, 'evidence'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, WINDOWS_VERIFIER_SCRIPT: '', WINDOWS_VERIFIER_SHA256: '' },
    })
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(existsSync(join(root, 'evidence', name + '.verification.json'))).toBe(false)
  })
  it('parses gh2.83.2 certificate identity and statement subjects, not predicate declarations', () => {
    const identity = 'https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/tags/v1.17.0'
    const digests = { 'installer.exe': 'd'.repeat(64), 'portable.exe': 'e'.repeat(64) }
    const expected = { subjectSha: syntheticSubject, clientDigest: syntheticClient, workflowIdentity: identity }
    const raw = [syntheticGhResult(digests, identity)]
    expect(normalizeGhAttestations(raw, digests, expected)).toMatchObject([{ verified: true, subjectSha: syntheticSubject }])
    for (const key of ['issuer', 'subjectAlternativeName', 'buildSignerURI', 'sourceRepositoryURI', 'sourceRepositoryDigest']) {
      const wrong = structuredClone(raw)
      wrong[0].verificationResult.signature.certificate[key] = 'unauthorized'
      expect(() => normalizeGhAttestations(wrong, digests, expected)).toThrow()
    }
    const wrongDigest = structuredClone(raw)
    wrongDigest[0].verificationResult.statement.subject[1].digest.sha256 = 'f'.repeat(64)
    expect(() => normalizeGhAttestations(wrongDigest, digests, expected)).toThrow()
    const noBundle = structuredClone(raw)
    noBundle[0].attestation.bundle = {}
    expect(() => normalizeGhAttestations(noBundle, digests, expected)).toThrow()
  })
  it('accepts the actual pinned gh verified upstream wire shape under an exact source policy', () => {
    // Authentically verified upstream Python-wheel output, not Windows qualification.
    const expected = { subjectSha: genuineProvenance.sourceRepositoryDigest,
      workflowIdentity: genuineProvenance.workflowIdentity, clientDigest: '0'.repeat(64) }
    const digests = { [genuineProvenance.artifactName]: genuineProvenance.artifactSha256 }
    expect(normalizeGhAttestations(genuineGh, digests, expected)).toMatchObject([{ verified: true }])
  })
  it.each([
    [['NavSlides Editor Setup 1.17.0.exe']], [['NavSlides Editor 1.17.0.exe']],
    [['NavSlides Editor Setup 1.16.0.exe', 'NavSlides Editor 1.17.0.exe']],
    [['NavSlides Editor Setup 1.17.0.exe', 'NavSlides Editor 1.17.0.exe', 'extra.exe']],
  ])('rejects incomplete or wrong-version Windows artifacts %j', (names) => {
    expect(() => classifyWindowsArtifacts(names, '1.17.0')).toThrow(/completeness/)
  })
  it('retains authoritative schema2 OfficeCLI raw bytes scope and limitations', () => {
    const raw = syntheticPhysicalReceipt()
    const rawBytes = Buffer.from(JSON.stringify(raw))
    const run = syntheticRun(202, '.github/workflows/synthetic-officecli-test-double.yml', 'workflow_dispatch')
    const artifact = syntheticArtifact('officecli-test-double', run)
    const expected = { subjectSha: syntheticSubject, clientDigest: syntheticClient, runId: run.id,
      workflow: run.path, ref: 'master', event: run.event, repository: run.repository.full_name, artifactName: artifact.name }
    const admission = { run, artifact, rawHash: sha256(rawBytes), clientDigest: syntheticClient }
    const input = { rawBytes, manifest: pinnedManifest, admission, expected }
    const envelope = createPhysicalReleaseEnvelope(input)
    expect(envelope.raw).toEqual(raw)
    expect(envelope.rawHash).toBe(sha256(rawBytes))
    expect(envelope.claimScope).toBe('local-physical-feasibility')
    expect(envelope.limitations).toEqual(raw.processPolicy.limitations)
    const wrong = structuredClone(raw)
    wrong.subject.commit = 'b'.repeat(40)
    expect(() => createPhysicalReleaseEnvelope({ ...input, rawBytes: Buffer.from(JSON.stringify(wrong)) })).toThrow()
    expect(() => createPhysicalReleaseEnvelope({ ...input, admission: { ...admission, rawHash: 'f'.repeat(64) } })).toThrow()
    expect(() => createPhysicalReleaseEnvelope({ ...input, expected: { ...expected, runId: 303 } })).toThrow()
  })
})
