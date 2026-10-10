import { basename, join } from 'node:path'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { canonicalJson, hashCanonical, windowsWorkflowIdentity } from './release-receipt-canonical.mjs'
import { createGreenShaRoot, createHostReceipt, createNotSelectedReceipt, createQualificationId, hashReceipt } from './release-receipts.mjs'
import { assertRun, CI_WORKFLOW, captureRun, fileDigest, produceLinuxEvidence, assertLinuxLeafEvidence } from './release-evidence-producer.mjs'
import { officeEnvelope, fidelityEnvelope } from './physical-release-envelope.mjs'
import { captureAuthenticode, captureGhAttestation, classifyWindowsArtifacts, normalizeWindowsAttestation, validateWindowsSignature, assertWindowsLeafEvidence } from './windows-verification-evidence.mjs'
import { execFileSync } from 'node:child_process'
import { verifyManifest } from './verify-client-dist-manifest.mjs'
import { verifyReleaseSubject } from './release-subject.mjs'
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const windowsAttestationPolicy = () => ({ repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF })
async function findJson(root, includes) {
  const matches = (await readdir(root, { recursive: true })).filter((path) => path.endsWith('.json') && includes.every((word) => path.includes(word))).sort()
  if (matches.length !== 1) throw new Error(`expected one receipt matching ${includes.join(',')}, found ${matches.length}`)
  return readJson(join(root, matches[0]))
}
async function common(subjectSha, clientDigest, policyVersion) {
  const input = { schemaVersion: 'release-receipt-v1', policyVersion, subjectSha, clientDigest,
    lockHashes: { workspace: await fileDigest('package-lock.json'), electron: await fileDigest('electron/server-package-lock.json') } }
  return { ...input, qualificationId: createQualificationId(input) }
}
async function linux(args) {
  const [subjectSha, clientDigest, policyVersion, evidenceRoot] = args
  const base = await common(subjectSha, clientDigest, policyVersion)
  const leaf = await produceLinuxEvidence(evidenceRoot, base, { runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, subjectSha, repository: process.env.GITHUB_REPOSITORY,
    workflow: CI_WORKFLOW, event: 'push', ref: process.env.GITHUB_REF })
  const receipt = createHostReceipt({ ...base, host: 'linux-ci', status: 'passed', ...leaf })
  assertLinuxLeafEvidence(receipt)
  await writeFile('linux-ci-receipt.json', canonicalJson(receipt))
}
async function authenticode(stage, exePath, root) {
  const name = basename(exePath)
  const path = join(root, `${name}.json`)
  const before = stage === 'post' ? await readJson(path) : null
  const captured = await captureAuthenticode(exePath)
  const digest = await fileDigest(exePath)
  const evidence = stage === 'pre'
    ? { path: name, sha256: digest, expectedSha256: digest, preUpload: captured.signature,
      preVerifier: captured.verifier, postDownload: null }
    : { ...before, sha256: digest, postDownload: captured.signature, postVerifier: captured.verifier }
  validateWindowsSignature(stage === 'post' ? evidence : { ...evidence, postDownload: captured.signature })
  await writeFile(path, canonicalJson(evidence))
}
function physicalExpected(base, kind, runId, artifactName) {
  const prefix = kind === 'officecli' ? 'OFFICECLI' : 'FIDELITY'
  return { ...base, kind, runId, artifactName, repository: process.env.GITHUB_REPOSITORY,
    workflow: process.env[`${prefix}_PRODUCER_WORKFLOW`], ref: process.env[`${prefix}_PRODUCER_REF`],
    event: process.env[`${prefix}_PRODUCER_EVENT`] }
}
async function windows(args, physicalOnly = false) {
  const base = await common(...args.slice(0, 3))
  const [linuxRun, officeRun, fidelityRun, officeArtifact, fidelityArtifact] = args.slice(3)
  if (![linuxRun, officeRun, fidelityRun].every((value) => /^[1-9][0-9]*$/.test(value ?? ''))) throw new Error('explicit CI/OfficeCLI/fidelity producer runs are required')
  if (new Set([linuxRun, officeRun, fidelityRun]).size !== 3) throw new Error('CI/OfficeCLI/fidelity producer run IDs must be distinct')
  const linuxReceipt = await findJson('evidence/linux', ['linux-ci'])
  const admitted = await readJson('evidence/linux-admission.json')
  assertRun(admitted.run, { runId: linuxRun, subjectSha: base.subjectSha, repository: process.env.GITHUB_REPOSITORY,
    workflow: CI_WORKFLOW, event: 'push', ref: admitted.repository?.default_branch })
  assertLinuxLeafEvidence(linuxReceipt)
  if (linuxReceipt.qualificationId !== base.qualificationId || linuxReceipt.evidence.run.id !== admitted.run.id ||
      linuxReceipt.evidence.run.run_attempt !== admitted.run.run_attempt) throw new Error('Linux receipt/source admission identity mismatch')
  const office = await officeEnvelope('evidence/officecli', physicalExpected(base, 'officecli', officeRun, officeArtifact))
  const fidelity = await fidelityEnvelope('evidence/fidelity', physicalExpected(base, 'fidelity', fidelityRun, fidelityArtifact))
  await writeFile('evidence/physical-release-admission.json', canonicalJson({ subjectSha: base.subjectSha,
    clientDigest: base.clientDigest, linuxRunId: linuxRun,
    officecli: { runId: officeRun, artifactId: office.producer.artifact.id, rawHash: office.rawHash },
    fidelity: { runId: fidelityRun, artifactId: fidelity.producer.artifact.id, rawHash: fidelity.rawHash } }))
  if (physicalOnly) return
  const version = (await readJson('package.json')).version
  const names = (await readdir('post-download')).filter((path) => path.toLowerCase().endsWith('.exe')).sort()
  const kinds = classifyWindowsArtifacts(names, version)
  const signatures = {}
  const artifacts = {}
  for (const [kind, name] of Object.entries(kinds)) {
    const evidence = await readJson(join('evidence/authenticode', `${name}.json`))
    validateWindowsSignature(evidence)
    if (evidence.sha256 !== await fileDigest(join('post-download', name)) || !evidence.postVerifier) throw new Error('downloaded EXE verification identity mismatch')
    signatures[name] = evidence
    artifacts[kind] = { path: name, sha256: evidence.sha256, evidenceHash: hashCanonical(evidence) }
  }
  const attestation = await readJson('evidence/attestation-policy.json')
  const expectedAttestation = hashCanonical(Object.fromEntries(Object.values(artifacts).map((item) => [item.path, item.sha256])))
  if (attestation.length !== 1 || attestation[0].digest !== expectedAttestation ||
      attestation[0].subjectSha !== base.subjectSha || attestation[0].clientDigest !== base.clientDigest ||
      attestation[0].verified !== true) throw new Error('Windows attestation artifact/source/client mismatch')
  const runtime = await readJson('evidence/runtime-closure.json')
  if (runtime.clientDist !== true || runtime.clientSubject !== base.subjectSha) throw new Error('Windows runtime client identity mismatch')
  const leaf = { office, fidelity, signatures, attestation,
    attestationRaw: await readJson('evidence/attestation-verification.json'), runtimeHash: await fileDigest('evidence/runtime-closure.json') }
  const gates = { 'electron-runtime-closure': leaf.runtimeHash, 'officecli-physical': hashCanonical(office),
    'fidelity-powerpoint': hashCanonical(fidelity), authenticode: hashCanonical(signatures),
    'post-download-authenticode': hashCanonical({ signatures, stage: 'post-download' }), attestation: hashCanonical(attestation) }
  const receipt = createHostReceipt({ ...base, host: 'windows', status: 'passed',
    parentReceiptHash: hashReceipt(linuxReceipt), gates, artifacts, evidence: leaf })
  assertWindowsLeafEvidence(receipt, windowsAttestationPolicy())
  await writeFile('windows-qualification-receipt.json', canonicalJson(receipt))
}
async function createRoot(args) {
  const [subjectSha, clientDigest, policyVersion, releaseTag] = args
  const base = await common(subjectSha, clientDigest, policyVersion)
  const linuxReceipt = await findJson('receipts', ['linux-ci'])
  if (linuxReceipt.qualificationId !== base.qualificationId) throw new Error('root qualification input identity mismatch')
  const optional = (host) => createNotSelectedReceipt({ ...base, host, parentReceiptHash: hashReceipt(linuxReceipt) })
  const linuxDesktopReceipt = optional('linux-desktop')
  const macosDesktopReceipt = optional('macos-desktop')
  const windowsReceipt = await findJson('receipts', ['windows-qualification'])
  const root = createGreenShaRoot({ policy: await readJson('config/release-target-policy.json'), linuxReceipt,
    windowsAttestationPolicy: windowsAttestationPolicy(),
    windowsReceipt, linuxDesktopReceipt, macosDesktopReceipt,
    releaseTag, workflow: { pathRef: process.env.GITHUB_WORKFLOW_REF, runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT } })
  await writeFile('linux-ci-receipt.json', canonicalJson(linuxReceipt))
  await writeFile('windows-qualification-receipt.json', canonicalJson(windowsReceipt))
  await writeFile('linux-desktop-receipt.json', canonicalJson(linuxDesktopReceipt))
  await writeFile('macos-desktop-receipt.json', canonicalJson(macosDesktopReceipt))
  await writeFile('green-sha-root-receipt.json', canonicalJson(root))
}
async function verifyRoot(rootDir) {
  const stored = await readJson(join(rootDir, 'green-sha-root-receipt.json'))
  const rebuilt = createGreenShaRoot({ policy: await readJson('config/release-target-policy.json'),
    windowsAttestationPolicy: windowsAttestationPolicy(),
    linuxReceipt: await readJson(join(rootDir, 'linux-ci-receipt.json')),
    windowsReceipt: await readJson(join(rootDir, 'windows-qualification-receipt.json')),
    linuxDesktopReceipt: await readJson(join(rootDir, 'linux-desktop-receipt.json')),
    macosDesktopReceipt: await readJson(join(rootDir, 'macos-desktop-receipt.json')),
    releaseTag: stored.releaseTag, workflow: stored.workflow })
  if (hashReceipt(stored) !== hashReceipt(rebuilt)) throw new Error('root receipt DAG/leaf/artifact hash mismatch')
}
async function verifyStaged(args) {
  const [subjectSha, releaseTag, ciHead] = args
  const root = await readJson('root-evidence/green-sha-root-receipt.json')
  const manifestPath = 'client-evidence/client-dist-manifest.json'
  const manifest = await readJson(manifestPath)
  const version = (await readJson('package.json')).version
  verifyReleaseSubject({ tag: releaseTag, packageVersion: version, subjectSha,
    tagCommitSha: execFileSync('git', ['rev-parse', `${releaseTag}^{commit}`], { encoding: 'utf8' }).trim(),
    checkoutSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), successfulCiHeadSha: ciHead,
    artifactSubjects: [manifest.subject?.sha], receiptSubjects: [root.subjectSha] })
  await verifyRoot('root-evidence')
  const clientDigest = await fileDigest(manifestPath)
  if (root.clientDigest !== clientDigest || root.releaseTag !== releaseTag) throw new Error('release root client/tag mismatch')
  verifyManifest({ root: 'client-evidence/client/dist', manifest: manifestPath, subject: subjectSha,
    baseDir: process.cwd(), dirty: false, buildCommand: 'npm run build' })
  const kinds = classifyWindowsArtifacts((await readdir('post-download')).filter((name) => name.toLowerCase().endsWith('.exe')), version)
  await mkdir('evidence', { recursive: true })
  const results = []
  for (const [kind, name] of Object.entries(kinds)) {
    if (root.artifacts[kind].path !== name || root.artifacts[kind].sha256 !== await fileDigest(join('post-download', name))) {
      throw new Error('downloaded EXE root digest mismatch')
    }
    await authenticode('post', join('post-download', name), 'post-download/evidence/authenticode')
    results.push(...JSON.parse(captureGhAttestation(join('post-download', name), subjectSha, '.github/workflows/reusable-windows-qualification.yml')))
  }
  await writeFile('attestation-post-download.json', canonicalJson(results))
  const workflowIdentity = windowsWorkflowIdentity(windowsAttestationPolicy())
  const normalized = await normalizeWindowsAttestation('attestation-post-download.json', { subjectSha, clientDigest, workflowIdentity })
  await writeFile('evidence/attestation-policy.json', canonicalJson(normalized.evidence))
}
async function main() {
  const [operation, ...args] = process.argv.slice(2)
  if (operation === 'linux') await linux(args)
  else if (operation === 'windows') await windows(args)
  else if (operation === 'physical-preflight') await windows(args, true)
  else if (operation === 'create-root') await createRoot(args)
  else if (operation === 'verify-root') await verifyRoot(args[0])
  else if (operation === 'verify-staged') await verifyStaged(args)
  else if (operation === 'capture-run') await captureRun(...args)
  else if (operation === 'capture-attestation') {
    const [path, subject, workflow, output] = args
    await writeFile(output, captureGhAttestation(path, subject, workflow))
  }
  else if (operation === 'windows-artifacts') {
    const [root, version] = args
    classifyWindowsArtifacts((await readdir(root)).filter((name) => name.toLowerCase().endsWith('.exe')), version)
  } else if (operation === 'authenticode-pre') await authenticode('pre', ...args)
  else if (operation === 'authenticode-post') await authenticode('post', ...args)
  else if (operation === 'attestation-windows') {
    const [path, subjectSha, clientDigest, workflowIdentity] = args
    // Empty verified output fails on its own domain before any optional artifact setup.
    const raw = await readJson(path)
    if (!Array.isArray(raw) || !raw.flat().length) throw new Error('verified attestation results are empty')
    const result = await normalizeWindowsAttestation(path, { subjectSha, clientDigest, workflowIdentity })
    await writeFile('evidence/attestation-policy.json', canonicalJson(result.evidence))
    await writeFile('evidence/attestation-verification.sha256', `${result.rawHash}\n`)
  } else throw new Error(`unknown workflow operation ${operation}`)
}
main().catch((error) => { console.error(error.message); process.exitCode = 1 })
