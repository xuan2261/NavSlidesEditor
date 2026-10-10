import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { stageSyntheticLinuxCli, syntheticWindowsLeaf, syntheticSubject } from '../../../scripts/ci/release-evidence-test-support.mjs'
import { createHostReceipt, hashReceipt } from '../../../scripts/ci/release-receipts.mjs'
import { sha256 } from '../../../scripts/ci/release-receipt-canonical.mjs'
const repo = process.cwd()
function capture() {
  const names = ['scripts/ci/release-receipts.mjs', 'scripts/ci/release-receipt-workflow.mjs', 'scripts/ci/release-receipt-canonical.mjs', 'scripts/ci/release-evidence-producer.mjs', 'scripts/ci/release-evidence-test-support.mjs', 'scripts/ci/windows-verification-evidence.mjs', 'config/release-target-policy.json', 'config/container-vulnerability-policy.json', 'package-lock.json', 'electron/server-package-lock.json']
  const inputs = Object.fromEntries(names.map(name => [name, sha256(readFileSync(path.resolve(name)))]))
  return { scope: 'Actual root and host producers, canonical verifier, synthetic support, trusted target/scan policies and locked inputs', inputs, sha256: sha256(JSON.stringify(inputs)) }
}
const cli = path.resolve('scripts/ci/release-receipt-workflow.mjs')
const out = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports/release-root-gap-proof-after.json')
const root = mkdtempSync(path.join(tmpdir(), 'navslides-root-gap-'))
const rows = []
const run = (...args) => {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env,
    GITHUB_REPOSITORY: 'example/repo', GITHUB_RUN_ID: '101', GITHUB_RUN_ATTEMPT: '1',
    GITHUB_REF: args[0] === 'linux' ? 'refs/heads/master' : 'refs/tags/v1.17.0' } })
  if (result.error) throw result.error
  return { args, exitCode: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() }
}
let receipt = { status: 'running', scope: 'Synthetic inputs through actual current producer/root CLI; NOT hosted, signing, physical or release qualification.', rows, sourceBefore: capture() }
try {
  const fixture = stageSyntheticLinuxCli(root)
  const positive = run('linux', syntheticSubject, fixture.clientDigest, 'release-target-policy-v1', 'evidence')
  assert.equal(positive.exitCode, 0, JSON.stringify(positive))
  const linux = JSON.parse(readFileSync(path.join(root, 'linux-ci-receipt.json'), 'utf8'))
  const windows = createHostReceipt({ ...linux, host: 'windows', parentReceiptHash: hashReceipt(linux), ...syntheticWindowsLeaf(fixture.clientDigest) })
  const policy = JSON.parse(readFileSync(path.join(repo, 'config/release-target-policy.json'), 'utf8'))
  fixture.put('receipts/linux-ci-receipt.json', linux)
  fixture.put('receipts/windows-qualification-receipt.json', windows)
  fixture.put('config/release-target-policy.json', policy)
  const created = run('create-root', syntheticSubject, fixture.clientDigest, policy.policyVersion, 'v1.17.0')
  assert.equal(created.exitCode, 0, JSON.stringify(created))
  const verified = run('verify-root', '.')
  assert.equal(verified.exitCode, 0, JSON.stringify(verified))
  const frozen = readFileSync(path.join(root, 'green-sha-root-receipt.json'))
  rows.push({ scenario: 'positive-control', positive, created, verified, rootSha256: sha256(frozen) })
  for (const [scenario, mutate] of [
    ['missing-parent', value => { delete value.parentReceiptHash }],
    ['attempted-child-self-back-edge-parent', value => { value.parentReceiptHash = hashReceipt(value) }],
    ['wrong-policy-version', value => { value.policyVersion = 'release-target-policy-v2' }],
  ]) {
    const changed = structuredClone(windows)
    mutate(changed)
    fixture.put('windows-qualification-receipt.json', changed)
    const result = run('verify-root', '.')
    assert.equal(result.exitCode, 1, JSON.stringify(result))
    assert.equal(sha256(readFileSync(path.join(root, 'green-sha-root-receipt.json'))), sha256(frozen))
    rows.push({ scenario, result, preservedFrozenRoot: true })
    fixture.put('windows-qualification-receipt.json', windows)
  }
  const changedLinux = structuredClone(linux)
  changedLinux.evidence.files.docker['docker-image-digest.txt'] = 'b'.repeat(64)
  fixture.put('linux-ci-receipt.json', changedLinux)
  const imageResult = run('verify-root', '.')
  assert.equal(imageResult.exitCode, 1, JSON.stringify(imageResult))
  rows.push({ scenario: 'well-formed-wrong-image-file-digest', result: imageResult })
  fixture.put('linux-ci-receipt.json', linux)
  const changedPolicy = structuredClone(policy)
  changedPolicy.authenticode.requireRfc3161Timestamp = false
  fixture.put('config/release-target-policy.json', changedPolicy)
  const policyResult = run('verify-root', '.')
  rows.push({ scenario: 'same-version-changed-policy', oldPolicySha256: sha256(JSON.stringify(policy)), changedPolicySha256: sha256(JSON.stringify(changedPolicy)), result: policyResult, expectedExitCode: 1, rootPresent: existsSync(path.join(root, 'green-sha-root-receipt.json')) })
  assert.equal(policyResult.exitCode, 1, 'P16-03/P16-12: changed shipped policy must invalidate frozen root')
  assert.equal(sha256(readFileSync(path.join(root, 'green-sha-root-receipt.json'))), sha256(frozen))
  const recreated = run('create-root', syntheticSubject, fixture.clientDigest, policy.policyVersion, 'v1.17.0')
  assert.equal(recreated.exitCode, 0, JSON.stringify(recreated))
  const requalified = run('verify-root', '.')
  assert.equal(requalified.exitCode, 0, JSON.stringify(requalified))
  const newRoot = JSON.parse(readFileSync(path.join(root, 'green-sha-root-receipt.json'), 'utf8'))
  assert.equal(newRoot.policyDigest, hashReceipt(changedPolicy))
  rows.push({ scenario: 'explicit-requalification-after-policy-change', recreated, result: requalified, policyDigest: newRoot.policyDigest, previousPolicyDigest: JSON.parse(frozen).policyDigest })
  fixture.put('config/release-target-policy.json', policy)
  const restoredPolicyRefusal = run('verify-root', '.')
  assert.equal(restoredPolicyRefusal.exitCode, 1, JSON.stringify(restoredPolicyRefusal))
  rows.push({ scenario: 'restored-policy-invalidates-requalified-root', result: restoredPolicyRefusal })
  for (const [scenario, policyDigest] of [['legacy-root-without-policy-digest', undefined], ['well-formed-wrong-policy-digest', 'b'.repeat(64)]]) {
    fixture.put('green-sha-root-receipt.json', { ...JSON.parse(frozen), policyDigest })
    const result = run('verify-root', '.')
    assert.equal(result.exitCode, 1, JSON.stringify(result))
    rows.push({ scenario, result })
  }
  fixture.put('green-sha-root-receipt.json', frozen.toString('utf8'))
  const restored = run('verify-root', '.')
  assert.equal(restored.exitCode, 0, JSON.stringify(restored))
  rows.push({ scenario: 'matching-original-policy-root-restored', result: restored })
  receipt.sourceAfter = capture()
  receipt.sourceUnchanged = receipt.sourceBefore.sha256 === receipt.sourceAfter.sha256
  assert(receipt.sourceUnchanged, 'Root smoke production inputs changed during execution')
  receipt.status = 'passed'
} catch (error) {
  receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1
} finally {
  rmSync(root, { recursive: true, force: true })
  receipt.fixtureRemoved = !existsSync(root)
  writeFileSync(out, JSON.stringify(receipt, null, 2), { flag: 'wx' })
  console.log(JSON.stringify({ status: receipt.status, rows: rows.map(({ scenario, result }) => ({ scenario, exitCode: result?.exitCode })), failure: receipt.failure, receipt: out }))
}
