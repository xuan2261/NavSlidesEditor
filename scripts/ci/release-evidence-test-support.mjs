import { createRequire } from 'node:module'
import { hashCanonical } from './release-receipt-canonical.mjs'
import { CI_WORKFLOW, REQUIRED_JOB_NAMES, linuxEvidenceGates } from './release-evidence-producer.mjs'
import { normalizeGhAttestations, WINDOWS_CAPTURE_HASH } from './windows-verification-evidence.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { sha256 } from './release-receipt-canonical.mjs'
import { identityFor } from './create-client-dist-manifest.mjs'
import { scanEvidence } from '../trivy-report-evidence.js'
import { verifyContainerSupplyChain } from '../verify-container-supply-chain.js'
import { createHostReceipt, createQualificationId } from './release-receipts.mjs'
const require = createRequire(import.meta.url)
export const pinnedManifest = require('../../server/services/pptx-import/officecli/qualification-manifest.json')
export const syntheticSubject = 'a'.repeat(40)
export const syntheticClient = 'c'.repeat(64)
// All values in this module are test doubles, never genuine qualification receipts.
export function syntheticRun(id = 101, workflow = CI_WORKFLOW, event = 'push') {
  return { id, run_attempt: 1, repository: { full_name: 'example/repo' }, path: workflow, event,
    head_sha: syntheticSubject, head_branch: 'master', status: 'completed', conclusion: 'success',
    run_started_at: '2000-01-01T00:00:00Z' }
}
export function syntheticArtifact(name, run, id = 1) {
  return { id, name, expired: false, digest: 'sha256:' + 'd'.repeat(64), created_at: '2000-01-01T00:01:00Z',
    workflow_run: { id: run.id, head_sha: run.head_sha, head_branch: run.head_branch } }
}
export function syntheticLinuxLeaf(clientDigest = syntheticClient) {
  const run = syntheticRun()
  const names = [`client-dist-v1-${syntheticSubject}`, 'coverage-html', `vitest-ci-budget-v1-${syntheticSubject}`,
    ...[1, 2, 3, 4].map((n) => `playwright-report-chromium-chromium-${n}`),
    ...['pptx-import', 'live', 'mobile', 'visual'].map((lane) => `playwright-report-${lane}`),
    'docker-runtime-qualification', `container-supply-chain-v1-${syntheticSubject}`]
  const evidence = { schemaVersion: 'release-leaf-evidence-v1', subjectSha: syntheticSubject, clientDigest, run,
    jobs: REQUIRED_JOB_NAMES.map((name, id) => ({ id: id + 1, name, run_id: run.id, run_attempt: 1,
      head_sha: syntheticSubject, status: 'completed', conclusion: 'success' })),
    artifacts: names.map((name, index) => syntheticArtifact(name, run, index + 1)),
    files: { client: { 'client-dist-manifest.json': clientDigest },
      docker: { 'docker-attestation-verification.txt': 'd'.repeat(64), 'docker-verified.json': 'e'.repeat(64) },
      supplyChain: { 'container-trivy.json': 'b'.repeat(64) },
      reports: Object.fromEntries(names.slice(1, 11).map((name) => [`${name}/report.json`, 'f'.repeat(64)])) } }
  return { evidence, gates: linuxEvidenceGates(evidence) }
}
export function syntheticPhysicalReceipt() {
  const m = pinnedManifest
  return { schemaVersion: 2, status: 'passed', authoritative: true, claimScope: 'local-physical-feasibility',
    acquiredAt: '2000-01-01T00:00:00Z', subject: { commit: syntheticSubject,
      worktree: { clean: true, trackedClean: true, untrackedClean: true } },
    upstream: { releasePage: m.upstream.releasePage, assetUrl: m.releaseAsset.sourceAssetUrl },
    binary: { version: m.version, sha256: m.releaseAsset.sha256, byteLength: m.releaseAsset.byteLength },
    legal: { spdx: m.license.spdx, licenseTextSha256: m.license.textSha256,
      upstreamNoticeStatus: m.license.upstreamNoticeStatus, redistributionReviewStatus: m.license.redistributionReviewStatus },
    processPolicy: { stdoutBounded: true, stderrBounded: true, shellDisabled: true, runtimeDownload: false,
      pathLookup: false, memoryLimitEnforced: false, descendantProcessLimitEnforced: false,
      limitations: ['memory-limit-unproven', 'descendant-containment-unproven'] },
    executionContext: { account: 'invoking-account', accountIsolationClaim: false, egressDenialClaim: false,
      containmentClaim: false, riskCode: 'invoking-account-file-and-network-access' },
    processes: ['version', 'validate'].map((operation) => ({ operation, exitCode: 0, stdoutBytes: 1,
      stderrBytes: 0, durationMs: 1, stdoutSha256: 'A'.repeat(64), stderrSha256: 'B'.repeat(64) })),
    host: { platform: 'win32', release: '10', arch: 'x64', identityHash: 'C'.repeat(64) }, durationMs: 1,
    fixtures: [
      { name: 'officecli-positive-powerpoint-16.pptx', sha256: '29B2D6F12E922204C4A914D3C3BC427FF48B0915231DFF37DCF3F91A21D00FC2', actual: 'accepted', validationPath: 'production-preflight-and-gateway', reasonCode: null, exitCode: 0, ok: true },
      { name: 'bad-crc.pptx', sha256: '9D572715870493397798E82473593F4CF373B01DDDEB8175EAB034C131274607', actual: 'rejected', validationPath: 'production-preflight', reasonCode: 'zip-crc-mismatch', exitCode: null, ok: true },
      { name: 'malformed-xml.pptx', sha256: '4F3B3BC9E807BAF99ECD2C462BBB95D7212457AC24CA424B69903DF73425E55C', actual: 'rejected', validationPath: 'production-preflight', reasonCode: 'xml-dtd-prohibited', exitCode: null, ok: true },
    ] }
}
export function syntheticGhResult(digests, identity) {
  return { attestation: { bundle: { testDouble: true } }, verificationResult: {
    verifiedTimestamps: [{ type: 'synthetic-test-double', timestamp: '2000-01-01T00:00:00Z' }],
    signature: { certificate: { issuer: 'https://token.actions.githubusercontent.com',
      subjectAlternativeName: identity, buildSignerURI: identity, sourceRepositoryURI: 'https://github.com/example/repo',
      sourceRepositoryDigest: syntheticSubject } },
    statement: { predicateType: 'https://slsa.dev/provenance/v1',
      subject: Object.entries(digests).map(([name, sha256]) => ({ name, digest: { sha256 } })) } } }
}
export function syntheticWindowsLeaf(clientDigest = syntheticClient) {
  const signature = { status: 'Valid', signerSubject: 'CN=Synthetic unit signer', signerThumbprint: 'A'.repeat(40),
    chainTrusted: true, certificate: { notBefore: '1999-01-01T00:00:00Z', notAfter: '2001-01-01T00:00:00Z' },
    timestamp: { type: 'RFC3161', trusted: true, value: '2000-01-01T00:00:00Z' } }
  const verifier = { version: 'synthetic', scriptHash: WINDOWS_CAPTURE_HASH, executableHash: '2'.repeat(64),
    signtoolHash: '3'.repeat(64), signtoolOutputHash: '4'.repeat(64), captureHash: '5'.repeat(64) }
  const signatures = Object.fromEntries(['NavSlides Editor Setup 1.17.0.exe', 'NavSlides Editor 1.17.0.exe'].map((path) =>
    [path, { path, sha256: '6'.repeat(64), expectedSha256: '6'.repeat(64), preUpload: signature,
      postDownload: signature, preVerifier: verifier, postVerifier: verifier }]))
  const artifacts = Object.fromEntries(Object.entries(signatures).map(([path, evidence], index) =>
    [index === 0 ? 'nsis-exe' : 'portable-exe', { path, sha256: evidence.sha256, evidenceHash: hashCanonical(evidence) }]))
  const evaluation = { gate: { integrity: { verdict: 'passed' }, qualification: { verdict: 'passed' } }, testDouble: true }
  const physical = (kind) => {
    const run = syntheticRun(kind === 'officecli' ? 202 : 303, `.github/workflows/synthetic-${kind}-test-double.yml`, 'workflow_dispatch')
    const raw = syntheticPhysicalReceipt()
    return { schemaVersion: 'physical-release-envelope-v1', kind, status: 'passed',
      subjectSha: syntheticSubject, clientDigest, rawHash: '8'.repeat(64),
      claimScope: kind === 'officecli' ? 'local-physical-feasibility' : 'environment-bounded-powerpoint-visual-oracle',
      producer: { run, artifact: syntheticArtifact(`${kind}-synthetic-test-double`, run) },
      ...(kind === 'officecli' ? { raw, rawCanonicalHash: hashCanonical(raw) } : { evaluation, evidenceHash: hashCanonical(evaluation) }),
      limitations: ['unit-test-double'] }
  }
  const digests = Object.fromEntries(Object.values(artifacts).map((artifact) => [artifact.path, artifact.sha256]))
  const identity = 'https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/tags/v1.17.0'
  const attestationRaw = [syntheticGhResult(digests, identity)]
  const attestation = normalizeGhAttestations(attestationRaw, digests,
    { subjectSha: syntheticSubject, clientDigest, workflowIdentity: identity })
  const evidence = { office: physical('officecli'), fidelity: physical('fidelity'), signatures, attestation, attestationRaw, runtimeHash: '7'.repeat(64) }
  const gates = { 'electron-runtime-closure': evidence.runtimeHash, 'officecli-physical': hashCanonical(evidence.office),
    'fidelity-powerpoint': hashCanonical(evidence.fidelity), authenticode: hashCanonical(signatures),
    'post-download-authenticode': hashCanonical({ signatures, stage: 'post-download' }), attestation: hashCanonical(attestation) }
  return { artifacts, gates, evidence }
}
export function stageSyntheticLinuxCli(root) {
  // Complete public wire inputs, but entirely test doubles: no CI/scanner/attestation provenance.
  const put = (path, value) => {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value))
  }
  put('package-lock.json', '{}')
  put('electron/server-package-lock.json', '{}')
  put('package.json', { version: '1.17.0' })
  const index = '<h1>Synthetic client</h1>'
  put('evidence/client/client/dist/index.html', index)
  const manifest = { schemaVersion: 1, subject: { sha: syntheticSubject, dirty: false },
    build: { command: 'npm run build', node: '22.22.0', npm: '10', vite: '6' },
    locks: [{ name: 'electron', path: 'electron/server-package-lock.json', bytes: 2, sha256: sha256('{}') },
      { name: 'workspace', path: 'package-lock.json', bytes: 2, sha256: sha256('{}') }],
    files: [{ path: 'index.html', bytes: Buffer.byteLength(index), sha256: sha256(index) }],
    artifact: { files: 1, bytes: Buffer.byteLength(index) } }
  manifest.artifact.identity = identityFor(manifest)
  const clientDigest = sha256(JSON.stringify(manifest))
  put('evidence/client/client-dist-manifest.json', manifest)
  const leaf = syntheticLinuxLeaf(clientDigest)
  put('evidence/linux-admission.json', { run: leaf.evidence.run, jobs: leaf.evidence.jobs, artifacts: leaf.evidence.artifacts })
  for (const path of Object.keys(leaf.evidence.files.reports)) put(`evidence/reports/${path}`, { testDouble: true })
  const imageID = 'sha256:' + 'a'.repeat(64)
  put('evidence/docker/docker-image-digest.txt', imageID)
  put('evidence/docker/docker-runtime-closure.json', { clientDist: true, clientSubject: syntheticSubject })
  const tar = 'Synthetic tar bytes, not an actual container artifact'
  put('evidence/docker/navslides-editor-image.tar', tar)
  put('evidence/docker/docker-verified.json', [syntheticGhResult({ 'navslides-editor-image.tar': sha256(tar) },
    'https://github.com/example/repo/.github/workflows/reusable-docker-qualification.yml@refs/heads/master')])
  const report = { SchemaVersion: 2, Trivy: { Version: '0.74.0' }, ArtifactName: imageID, ArtifactType: 'container_image',
    Metadata: { ImageID: imageID, OS: { Family: 'debian', Name: '12' }, ImageConfig: { os: 'linux' } },
    Results: [{ Target: `${imageID} (debian 12)`, Class: 'os-pkgs', Type: 'debian', Packages: [{ Name: 'libc6', Version: '2.36' }] },
      { Target: 'Node.js', Class: 'lang-pkgs', Type: 'node-pkg', Packages: [{ Name: 'playwright', Version: '1.63.0' }] }] }
  const sbom = { spdxVersion: 'SPDX-2.3', packages: [
    { name: 'libc6', versionInfo: '2.36', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:deb/debian/libc6@2.36' }] },
    { name: 'playwright', versionInfo: '1.63.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:npm/playwright@1.63.0' }] }] }
  const browser = { playwrightVersion: '1.63.0', chromium: { revision: '1243', executablePath: '/synthetic/chrome' } }
  const policy = { schemaVersion: 1, failSeverities: ['HIGH', 'CRITICAL'], exceptions: [] }
  const input = { report, sbom, browser, policy, actualImageID: imageID,
    expected: { imageID, artifactName: imageID, osFamily: 'debian', requiredLanguageTypes: ['node-pkg'],
      playwrightVersion: '1.63.0', chromiumRevision: '1243' } }
  const now = Date.now()
  const scanner = { Version: '0.74.0', VulnerabilityDB: { Version: 2, UpdatedAt: new Date(now - 3600000).toISOString(),
    NextUpdate: new Date(now + 86400000).toISOString(), DownloadedAt: new Date(now - 1000).toISOString() } }
  input.scanEvidence = scanEvidence(input, scanner, { target: imageID, exitCode: 0, listAllPkgs: true,
    ignoreUnfixed: false, scanners: ['vuln'], pkgTypes: ['os', 'library'], severities: ['HIGH', 'CRITICAL'] })
  put('config/container-vulnerability-policy.json', policy)
  for (const [name, value] of Object.entries({ 'container-trivy.json': report, 'container-sbom.spdx.json': sbom,
    'container-browser-inventory.json': browser, 'container-scan-evidence.json': input.scanEvidence,
    'container-supply-chain-receipt.json': verifyContainerSupplyChain(input, now) })) put(`evidence/supply-chain/${name}`, value)
  return { clientDigest, put, admission: leaf.evidence }
}

export function stageSyntheticWindowsCli(root) {
  const fixture = stageSyntheticLinuxCli(root)
  const base = { schemaVersion: 'release-receipt-v1', policyVersion: 'release-target-policy-v1',
    subjectSha: syntheticSubject, clientDigest: fixture.clientDigest,
    lockHashes: { workspace: sha256('{}'), electron: sha256('{}') } }
  base.qualificationId = createQualificationId(base)
  const linuxLeaf = syntheticLinuxLeaf(fixture.clientDigest)
  const linuxReceipt = createHostReceipt({ ...base, host: 'linux-ci', status: 'passed', ...linuxLeaf })
  fixture.put('evidence/linux/linux-ci-receipt.json', linuxReceipt)
  fixture.put('evidence/linux-admission.json', { run: linuxLeaf.evidence.run, repository: { default_branch: 'master' } })
  const { evidence } = syntheticWindowsLeaf(fixture.clientDigest)
  const digests = {}
  for (const [name, signature] of Object.entries(evidence.signatures)) {
    const bytes = `Synthetic EXE test double: ${name}`
    fixture.put(`post-download/${name}`, bytes)
    digests[name] = sha256(bytes)
    fixture.put(`evidence/authenticode/${name}.json`, { ...signature,
      sha256: digests[name], expectedSha256: digests[name] })
  }
  const identity = 'https://github.com/example/repo/.github/workflows/reusable-windows-qualification.yml@refs/tags/v1.17.0'
  const raw = [syntheticGhResult(digests, identity)]
  fixture.put('evidence/attestation-verification.json', raw)
  fixture.put('evidence/attestation-policy.json', normalizeGhAttestations(raw, digests,
    { subjectSha: syntheticSubject, clientDigest: fixture.clientDigest, workflowIdentity: identity }))
  fixture.put('evidence/runtime-closure.json', { clientDist: true, clientSubject: syntheticSubject })
  // Only physical envelope acquisition is replaced. The actual Windows CLI consumes
  // runtime JSON, EXE bytes, signatures, attestations and writes/validates the receipt.
  // These envelopes remain synthetic test doubles, never physical qualification.
  const physicalModule = new URL('./physical-release-envelope.mjs', import.meta.url).href
  const source = `export async function officeEnvelope() { return ${JSON.stringify(evidence.office)} }
export async function fidelityEnvelope() { return ${JSON.stringify(evidence.fidelity)} }`
  fixture.put('physical-test-double-loader.mjs', `export async function load(url, context, nextLoad) {
  if (url === ${JSON.stringify(physicalModule)}) return { format: 'module', shortCircuit: true, source: ${JSON.stringify(source)} }
  return nextLoad(url, context)
}`)
  fixture.put('register-physical-test-double.mjs', `import { register } from 'node:module'
register(new URL('./physical-test-double-loader.mjs', import.meta.url))`)
  return { ...fixture, linuxReceipt }
}
