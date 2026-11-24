import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { assertAuthoritativeReceipt } from '../officecli/physical-feasibility-receipt.mjs'
import { assertRun, assertArtifact, fileDigest } from './release-evidence-producer.mjs'
import { sha256, hashCanonical } from './release-receipt-canonical.mjs'
const require = createRequire(import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))

export function createPhysicalReleaseEnvelope({ rawBytes, manifest, admission, expected }) {
  const raw = JSON.parse(rawBytes.toString('utf8'))
  assertAuthoritativeReceipt(raw, manifest, expected.subjectSha)
  assertRun(admission.run, expected)
  assertArtifact(admission.artifact, admission.run, expected.artifactName)
  const rawHash = sha256(rawBytes)
  if (admission.rawHash !== rawHash || admission.clientDigest !== expected.clientDigest) {
    throw new Error('physical admission raw/client digest mismatch')
  }
  return { schemaVersion: 'physical-release-envelope-v1', status: 'passed', kind: 'officecli',
    subjectSha: expected.subjectSha, clientDigest: expected.clientDigest, rawHash, rawCanonicalHash: hashCanonical(raw),
    claimScope: raw.claimScope, limitations: [...raw.processPolicy.limitations],
    executionContext: raw.executionContext, producer: { run: admission.run, artifact: admission.artifact }, raw }
}
function bundlePath(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) throw new Error('physical bundle path is invalid')
  const result = resolve(root, path)
  const delta = relative(resolve(root), result)
  if (delta.startsWith('..') || isAbsolute(delta)) throw new Error('physical bundle path escapes evidence root')
  return result
}
export async function officeEnvelope(root, expected) {
  const admission = await readJson(join(root, 'admission.json'))
  const manifest = await readJson('server/services/pptx-import/officecli/qualification-manifest.json')
  const rawBytes = await readFile(bundlePath(root, admission.rawPath))
  // API run/artifact identities are captured by the release consumer, not asserted by the bundle.
  const captured = await readJson(`evidence/${expected.kind}-admission.json`)
  const artifact = captured.artifacts.filter((item) => item.name === expected.artifactName)
  if (artifact.length !== 1) throw new Error('physical producer artifact completeness mismatch')
  return createPhysicalReleaseEnvelope({ rawBytes, manifest, admission: { ...admission, run: captured.run, artifact: artifact[0] }, expected })
}
export async function fidelityEnvelope(root, expected) {
  const admission = await readJson(join(root, 'admission.json'))
  const captured = await readJson('evidence/fidelity-admission.json')
  assertRun(captured.run, expected)
  const artifacts = captured.artifacts.filter((item) => item.name === expected.artifactName)
  if (artifacts.length !== 1) throw new Error('PowerPoint producer artifact completeness mismatch')
  assertArtifact(artifacts[0], captured.run, expected.artifactName)
  const manifestPath = bundlePath(root, admission.evidenceManifestPath)
  if (await fileDigest(manifestPath) !== admission.rawHash || admission.clientDigest !== expected.clientDigest) {
    throw new Error('PowerPoint raw/client digest mismatch')
  }
  const manifest = await readJson(manifestPath)
  const clientArtifacts = manifest.subject?.applicationArtifacts?.filter((item) => item.id === 'client-dist')
  if (clientArtifacts?.length !== 1 || clientArtifacts[0].sha256 !== expected.clientDigest) {
    throw new Error('PowerPoint application client binding mismatch')
  }
  const { evaluateEvidenceRun } = require('../../server/services/pptx-import/oracle/oracle-evidence-runner.js')
  const result = await evaluateEvidenceRun({ evidenceManifestPath: manifestPath,
    roleReceiptsPath: bundlePath(root, admission.roleReceiptsPath),
    corpusDir: bundlePath(root, admission.corpusDir), goldensDir: bundlePath(root, admission.goldensDir),
    actualsDir: bundlePath(root, admission.actualsDir) })
  if (result.gate.integrity.verdict !== 'passed' || result.gate.qualification.verdict !== 'passed') {
    throw new Error('PowerPoint actual evidence qualification blocked or failed')
  }
  return { schemaVersion: 'physical-release-envelope-v1', status: 'passed', kind: 'fidelity',
    subjectSha: expected.subjectSha, clientDigest: expected.clientDigest, rawHash: admission.rawHash,
    claimScope: 'environment-bounded-powerpoint-visual-oracle', limitations: manifest.limitations,
    producer: { run: captured.run, artifact: artifacts[0] }, evaluation: result, evidenceHash: hashCanonical(result) }
}
