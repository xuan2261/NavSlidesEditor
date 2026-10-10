import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { stageSyntheticLinuxCli, stageSyntheticWindowsCli, syntheticGhResult, syntheticWindowsLeaf } from './release-evidence-test-support.mjs'
import { createHostReceipt, hashReceipt } from './release-receipts.mjs'
import { sha256 } from './release-receipt-canonical.mjs'

const cli = resolve('scripts/ci/release-receipt-workflow.mjs')
const subject = 'a'.repeat(40)
const client = 'c'.repeat(64)
const roots = []
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'navslides-release-producer-test-'))
  roots.push(root)
  mkdirSync(join(root, 'electron'))
  writeFileSync(join(root, 'package-lock.json'), '{}')
  writeFileSync(join(root, 'electron/server-package-lock.json'), '{}')
  return root
}
function put(root, path, value) {
  mkdirSync(resolve(root, path, '..'), { recursive: true })
  writeFileSync(join(root, path), typeof value === 'string' ? value : JSON.stringify(value))
}
function run(root, ...args) {
  const nodeArgs = args[0] === 'windows'
    ? ['--import', pathToFileURL(join(root, 'register-physical-test-double.mjs')).href] : []
  return spawnSync(process.execPath, [...nodeArgs, cli, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env,
    GITHUB_REPOSITORY: 'example/repo', GITHUB_RUN_ID: '101', GITHUB_RUN_ATTEMPT: '1',
    WINDOWS_SIGNING_SUBJECT: 'CN=Synthetic unit signer', WINDOWS_SIGNING_THUMBPRINT: 'A'.repeat(40),
    GITHUB_REF: args[0] === 'linux' ? 'refs/heads/master' : 'refs/tags/v1.17.0' } })
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('release producer boundary (synthetic negative inputs, not qualification evidence)', () => {
  it('rejects declaration-only Linux gates even when legacy evidence files exist', () => {
    const root = sandbox()
    const fixture = stageSyntheticLinuxCli(root)
    fixture.put('evidence/supply-chain/container-supply-chain-receipt.json', { status: 'passed' })
    const result = run(root, 'linux', subject, fixture.clientDigest, 'release-target-policy-v1', 'evidence')
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(existsSync(join(root, 'linux-ci-receipt.json'))).toBe(false)
  })

  it('rejects Linux qualification without an evidence root', () => {
    const root = sandbox()
    const result = run(root, 'linux', subject, client, 'release-target-policy-v1')
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(existsSync(join(root, 'linux-ci-receipt.json'))).toBe(false)
  })

  it('does not normalize empty gh verification results into verified attestations', () => {
    const root = sandbox()
    put(root, 'verification.json', [])
    put(root, 'post-download/NavSlides Editor Setup 1.17.0.exe', 'synthetic installer bytes')
    put(root, 'post-download/NavSlides Editor 1.17.0.exe', 'synthetic portable bytes')
    mkdirSync(join(root, 'evidence'))
    const result = run(root, 'attestation-windows', 'verification.json', subject, client,
      'https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/tags/v1.17.0')
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(existsSync(join(root, 'evidence/attestation-policy.json'))).toBe(false)
  })
  it('Audit regression: Linux accepts the runtime producer string subject through the actual CLI', () => {
    const root = sandbox()
    const fixture = stageSyntheticLinuxCli(root)
    const result = run(root, 'linux', subject, fixture.clientDigest, 'release-target-policy-v1', 'evidence')
    expect(result.error).toBeUndefined()
    expect(result.stderr).not.toContain('Docker runtime closure evidence did not pass')
    expect(result.status).toBe(0)
    const receipt = JSON.parse(readFileSync(join(root, 'linux-ci-receipt.json'), 'utf8'))
    expect(receipt.status).toBe('passed')
    expect(receipt.evidence.files.client['client-dist-manifest.json']).toBe(fixture.clientDigest)
    expect(receipt.evidence.jobs).toHaveLength(16)
  })
  it.each([
    ['mismatched string', 'b'.repeat(40)],
    ['missing subject', undefined],
    ['null subject', null],
    ['empty string', ''],
    ['short SHA', 'a'.repeat(39)],
    ['legacy object shape', { sha: subject }],
  ])('Audit regression: Linux rejects runtime %s without issuing a receipt', (_, clientSubject) => {
    const root = sandbox()
    const fixture = stageSyntheticLinuxCli(root)
    fixture.put('evidence/docker/docker-runtime-closure.json', { clientDist: true, clientSubject })
    const result = run(root, 'linux', subject, fixture.clientDigest, 'release-target-policy-v1', 'evidence')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Docker runtime closure evidence did not pass')
    expect(existsSync(join(root, 'linux-ci-receipt.json'))).toBe(false)
  })
  it('Audit regression: Windows accepts the runtime producer string through the actual receipt consumer', () => {
    const root = sandbox()
    const fixture = stageSyntheticWindowsCli(root)
    const result = run(root, 'windows', subject, fixture.clientDigest, 'release-target-policy-v1',
      '101', '202', '303', 'officecli-synthetic-test-double', 'fidelity-synthetic-test-double')
    expect(result.error).toBeUndefined()
    expect(result.stderr).not.toContain('Windows runtime client identity mismatch')
    expect(result.status).toBe(0)
    const receipt = JSON.parse(readFileSync(join(root, 'windows-qualification-receipt.json'), 'utf8'))
    const runtimeHash = sha256(readFileSync(join(root, 'evidence/runtime-closure.json')))
    expect(receipt.status).toBe('passed')
    expect(receipt.host).toBe('windows')
    expect(receipt.subjectSha).toBe(subject)
    expect(receipt.clientDigest).toBe(fixture.clientDigest)
    expect(receipt.parentReceiptHash).toBe(hashReceipt(fixture.linuxReceipt))
    expect(receipt.evidence.runtimeHash).toBe(runtimeHash)
    expect(receipt.gates['electron-runtime-closure']).toBe(runtimeHash)
    expect(Object.keys(receipt.artifacts).sort()).toEqual(['nsis-exe', 'portable-exe'])
    expect(receipt.evidence.office.limitations).toContain('unit-test-double')
    expect(receipt.evidence.fidelity.limitations).toContain('unit-test-double')
  })
  it.each([
    ['mismatched string', 'b'.repeat(40)],
    ['legacy object shape', { sha: subject }],
  ])('Audit regression: Windows rejects runtime %s without issuing a receipt', (_, clientSubject) => {
    const root = sandbox()
    const fixture = stageSyntheticWindowsCli(root)
    fixture.put('evidence/runtime-closure.json', { clientDist: true, clientSubject })
    const result = run(root, 'windows', subject, fixture.clientDigest, 'release-target-policy-v1',
      '101', '202', '303', 'officecli-synthetic-test-double', 'fidelity-synthetic-test-double')
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('Windows runtime client identity mismatch')
    expect(existsSync(join(root, 'windows-qualification-receipt.json'))).toBe(false)
  })
  it.each(['stale run', 'missing shard', 'expired artifact', 'client bytes', 'scanner invocation'])('rejects %s through CLI', (failure) => {
    const root = sandbox()
    const fixture = stageSyntheticLinuxCli(root)
    const admission = { run: fixture.admission.run, jobs: fixture.admission.jobs, artifacts: fixture.admission.artifacts }
    if (failure === 'stale run') admission.run.head_sha = 'b'.repeat(40)
    if (failure === 'missing shard') admission.jobs.splice(5, 1)
    if (failure === 'expired artifact') admission.artifacts[0].expired = true
    if (failure === 'client bytes') fixture.put('evidence/client/client/dist/index.html', 'tampered actual bytes')
    if (failure === 'scanner invocation') fixture.put('evidence/supply-chain/container-scan-evidence.json', { exitCode: 0 })
    fixture.put('evidence/linux-admission.json', admission)
    const result = run(root, 'linux', subject, fixture.clientDigest, 'release-target-policy-v1', 'evidence')
    expect(result.error).toBeUndefined()
    expect(result.status).not.toBe(0)
    expect(result.stderr).not.toMatch(/Cannot find|ERR_MODULE_NOT_FOUND|ENOENT/)
    expect(existsSync(join(root, 'linux-ci-receipt.json'))).toBe(false)
  })
  it('normalizes full synthetic gh wire results bound to actual sandbox EXE bytes', () => {
    const root = sandbox()
    put(root, 'package.json', { version: '1.17.0' })
    mkdirSync(join(root, 'evidence'))
    const names = ['NavSlides Editor Setup 1.17.0.exe', 'NavSlides Editor 1.17.0.exe']
    for (const name of names) put(root, `post-download/${name}`, `Synthetic bytes: ${name}`)
    const identity = 'https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/tags/v1.17.0'
    const digests = Object.fromEntries(names.map((name) => [name, sha256(`Synthetic bytes: ${name}`)]))
    put(root, 'verification.json', [syntheticGhResult(digests, identity)])
    const result = run(root, 'attestation-windows', 'verification.json', subject, client, identity)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(JSON.parse(readFileSync(join(root, 'evidence/attestation-policy.json'), 'utf8'))[0].verified).toBe(true)
  })
  it('round-trips full synthetic receipt DAG and rejects a changed child through current CLI', () => {
    const root = sandbox()
    const fixture = stageSyntheticLinuxCli(root)
    const linux = run(root, 'linux', subject, fixture.clientDigest, 'release-target-policy-v1', 'evidence')
    expect(linux.status).toBe(0)
    const linuxReceipt = JSON.parse(readFileSync(join(root, 'linux-ci-receipt.json'), 'utf8'))
    const windowsReceipt = createHostReceipt({ ...linuxReceipt, host: 'windows', parentReceiptHash: hashReceipt(linuxReceipt),
      ...syntheticWindowsLeaf(fixture.clientDigest) })
    fixture.put('receipts/linux-ci-receipt.json', linuxReceipt)
    fixture.put('receipts/windows-qualification-receipt.json', windowsReceipt)
    fixture.put('config/release-target-policy.json', JSON.parse(readFileSync(resolve('config/release-target-policy.json'), 'utf8')))
    const created = run(root, 'create-root', subject, fixture.clientDigest, 'release-target-policy-v1', 'v1.17.0')
    expect(created.status).toBe(0)
    const verified = run(root, 'verify-root', '.')
    expect(verified.status).toBe(0)
    const policyPath = 'config/release-target-policy.json'
    const rootPath = 'green-sha-root-receipt.json'
    const frozenRoot = readFileSync(join(root, rootPath), 'utf8')
    const originalPolicy = JSON.parse(readFileSync(join(root, policyPath), 'utf8'))
    fixture.put(policyPath, {
      ...originalPolicy,
      authenticode: { ...originalPolicy.authenticode, requireRfc3161Timestamp: false },
    })
    expect(run(root, 'verify-root', '.').status).toBe(1)
    expect(readFileSync(join(root, rootPath), 'utf8')).toBe(frozenRoot)
    expect(run(root, 'create-root', subject, fixture.clientDigest, 'release-target-policy-v1', 'v1.17.0').status).toBe(0)
    expect(run(root, 'verify-root', '.').status).toBe(0)
    fixture.put(policyPath, originalPolicy)
    expect(run(root, 'verify-root', '.').status).toBe(1)
    fixture.put(rootPath, frozenRoot)
    expect(run(root, 'verify-root', '.').status).toBe(0)
    for (const policyDigest of [undefined, 'b'.repeat(64)]) {
      fixture.put(rootPath, { ...JSON.parse(frozenRoot), policyDigest })
      expect(run(root, 'verify-root', '.').status).toBe(1)
    }
    fixture.put(rootPath, frozenRoot)
    for (const policy of [
      { GITHUB_REPOSITORY: '', GITHUB_REF: 'refs/tags/v1.17.0' },
      { GITHUB_REPOSITORY: 'example/repo', GITHUB_REF: '' },
      { GITHUB_REPOSITORY: 'example/repo', GITHUB_REF: 'refs/heads/unapproved' },
    ]) {
      const denied = spawnSync(process.execPath, [cli, 'verify-root', '.'], {
        cwd: root, encoding: 'utf8', env: { ...process.env, ...policy },
      })
      expect(denied.error).toBeUndefined()
      expect(denied.status).not.toBe(0)
      expect(denied.stderr).toMatch(/workflow|certificate/)
    }
    windowsReceipt.artifacts['portable-exe'].sha256 = 'f'.repeat(64)
    fixture.put('windows-qualification-receipt.json', windowsReceipt)
    const tampered = run(root, 'verify-root', '.')
    expect(tampered.status).not.toBe(0)
  })
})
