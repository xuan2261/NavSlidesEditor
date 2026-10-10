import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { hashCanonical } from './release-receipt-canonical.mjs'
import { verifyManifest } from './verify-client-dist-manifest.mjs'
import { verifyContainerSupplyChain } from '../verify-container-supply-chain.js'

export const CI_WORKFLOW = '.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml'
// GitHub names include the reusable job suffix; these are the actual caller names.
export const REQUIRED_JOB_NAMES = [
  'Lint / quality', 'Unit + Coverage Gate / quality', 'Vitest performance budget / quality',
  'Build client / client', ...[1, 2, 3, 4].map((n) => `E2E chromium (shard ${n}/4) / playwright`),
  'E2E PPTX import (workers:1) / playwright', 'E2E live (workers:1) / playwright',
  'E2E mobile-chromium (Phase 7 a11y) / playwright',
  'E2E visual regression (Linux baseline only) / playwright', 'PPTX corpus metrics / quality',
  'k6 load smoke (api + ws) / load', 'Docker artifact qualification / docker',
  'Container supply chain / scan',
]
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))
export async function fileDigest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
function numeric(value) { return Number.isSafeInteger(Number(value)) && Number(value) > 0 }
export function assertRun(run, expected, completed = true) {
  if (!numeric(run?.id) || !numeric(run.run_attempt) || String(run.id) !== String(expected.runId) ||
      (expected.runAttempt && String(run.run_attempt) !== String(expected.runAttempt)) ||
      run.head_sha !== expected.subjectSha || run.repository?.full_name !== expected.repository ||
      run.path !== expected.workflow || !expected.ref || run.head_branch !== expected.ref.replace(/^refs\/heads\//, '') ||
      run.event !== expected.event || (completed && (run.status !== 'completed' || run.conclusion !== 'success'))) {
    throw new Error('producer run/source/workflow/event/ref/attempt identity mismatch')
  }
}
export function assertArtifact(artifact, run, name) {
  if (!numeric(artifact?.id) || artifact.name !== name || artifact.expired !== false ||
      artifact.workflow_run?.id !== run.id || artifact.workflow_run?.head_sha !== run.head_sha ||
      artifact.workflow_run?.head_branch !== run.head_branch ||
      !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') ||
      !Number.isFinite(Date.parse(artifact.created_at)) ||
      Date.parse(artifact.created_at) < Date.parse(run.run_started_at)) {
    throw new Error(`artifact producer identity/attempt mismatch: ${name}`)
  }
  return artifact
}
function api(path, paginated = false) {
  const args = ['api', path, ...(paginated ? ['--paginate', '--slurp'] : [])]
  try { return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })) }
  catch { throw new Error('GitHub evidence capture failed; no qualification evidence admitted') }
}
export async function captureRun(root, runId, label, repository = process.env.GITHUB_REPOSITORY) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !numeric(runId)) throw new Error('repository/run ID required')
  const base = `repos/${repository}/actions/runs/${runId}`
  const run = api(base)
  const jobs = api(`${base}/attempts/${run.run_attempt}/jobs?per_page=100`, true).flatMap((page) => page.jobs)
  const artifacts = api(`${base}/artifacts?per_page=100`, true).flatMap((page) => page.artifacts)
  const repositoryInfo = api(`repos/${repository}`)
  await mkdir(root, { recursive: true })
  await writeFile(join(root, `${label}-admission.json`), JSON.stringify({ run, jobs, artifacts, repository: repositoryInfo }))
}
async function inventory(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort()
  if (!files.length) throw new Error('artifact evidence files missing')
  const digests = {}
  for (const path of files) digests[relative(root, path).replaceAll('\\', '/')] = await fileDigest(path)
  return digests
}
export async function produceLinuxEvidence(root, base, expected) {
  if (!root) throw new Error('Linux evidence root is required')
  const admission = await json(join(root, 'linux-admission.json'))
  assertRun(admission.run, expected, false) // This producer runs before its containing run can complete.
  const run = admission.run
  const jobs = REQUIRED_JOB_NAMES.map((name) => {
    const matches = admission.jobs.filter((job) => job.name === name)
    if (matches.length !== 1 || matches[0].run_id !== run.id || matches[0].head_sha !== base.subjectSha ||
        matches[0].run_attempt !== run.run_attempt || matches[0].status !== 'completed' ||
        matches[0].conclusion !== 'success') throw new Error(`required job/shard evidence missing or failed: ${name}`)
    return matches[0]
  })
  const names = [`client-dist-v1-${base.subjectSha}`, 'coverage-html', `vitest-ci-budget-v1-${base.subjectSha}`,
    ...[1, 2, 3, 4].map((n) => `playwright-report-chromium-chromium-${n}`),
    ...['pptx-import', 'live', 'mobile', 'visual'].map((lane) => `playwright-report-${lane}`),
    'docker-runtime-qualification', `container-supply-chain-v1-${base.subjectSha}`]
  const artifacts = names.map((name) => {
    const matches = admission.artifacts.filter((item) => item.name === name)
    if (matches.length !== 1) throw new Error(`artifact completeness mismatch: ${name}`)
    return assertArtifact(matches[0], run, name)
  })
  const clientPath = join(root, 'client', 'client-dist-manifest.json')
  const manifest = await json(clientPath)
  if (await fileDigest(clientPath) !== base.clientDigest || manifest.subject?.sha !== base.subjectSha) {
    throw new Error('client manifest identity mismatch')
  }
  verifyManifest({ root: join(root, 'client', 'client/dist'), manifest: clientPath, subject: base.subjectSha,
    baseDir: process.cwd(), dirty: false, buildCommand: 'npm run build' })
  const leaf = { schemaVersion: 'release-leaf-evidence-v1', subjectSha: base.subjectSha,
    clientDigest: base.clientDigest, run, jobs, artifacts,
    files: { client: await inventory(join(root, 'client')), docker: await inventory(join(root, 'docker')),
      supplyChain: await inventory(join(root, 'supply-chain')), reports: await inventory(join(root, 'reports')) } }
  const runtime = await json(join(root, 'docker', 'docker-runtime-closure.json'))
  if (runtime.clientDist !== true || runtime.clientSubject !== base.subjectSha) throw new Error('Docker runtime closure evidence did not pass')
  const chain = await json(join(root, 'supply-chain', 'container-supply-chain-receipt.json'))
  const image = (await readFile(join(root, 'docker', 'docker-image-digest.txt'), 'utf8')).trim()
  if (chain.status !== 'passed' || chain.imageID !== image) throw new Error('supply-chain evidence identity failed')
  const verifiedChain = verifyContainerSupplyChain({ policy: await json('config/container-vulnerability-policy.json'),
    report: await json(join(root, 'supply-chain', 'container-trivy.json')),
    sbom: await json(join(root, 'supply-chain', 'container-sbom.spdx.json')),
    browser: await json(join(root, 'supply-chain', 'container-browser-inventory.json')),
    scanEvidence: await json(join(root, 'supply-chain', 'container-scan-evidence.json')),
    expected: { imageID: image, playwrightVersion: '1.63.0', chromiumRevision: '1243', artifactName: image,
      osFamily: 'debian', requiredLanguageTypes: ['node-pkg'] }, actualImageID: image })
  if (hashCanonical(verifiedChain) !== hashCanonical(chain)) throw new Error('scanner receipt/report/SBOM/policy binding mismatch')
  const { normalizeGhAttestations } = await import('./windows-verification-evidence.mjs')
  normalizeGhAttestations(await json(join(root, 'docker', 'docker-verified.json')),
    { 'navslides-editor-image.tar': await fileDigest(join(root, 'docker', 'navslides-editor-image.tar')) },
    { subjectSha: base.subjectSha, clientDigest: base.clientDigest,
      workflowIdentity: `https://github.com/${expected.repository}/.github/workflows/reusable-docker-qualification.yml@refs/heads/${run.head_branch}` })
  const gates = linuxEvidenceGates(leaf)
  return { gates, evidence: leaf }
}

export function linuxEvidenceGates(leaf) {
  return {
    'client-manifest': leaf.clientDigest,
    'unit-coverage': hashCanonical({ jobs: leaf.jobs.slice(0, 3), reports: leaf.files.reports }),
    playwright: hashCanonical({ jobs: leaf.jobs.slice(4, 12), reports: leaf.files.reports }),
    load: hashCanonical(leaf.jobs.find((job) => job.name.endsWith('/ load'))),
    docker: hashCanonical(leaf.files.docker), 'supply-chain': hashCanonical(leaf.files.supplyChain),
    attestation: leaf.files.docker['docker-verified.json'],
  }
}
export function assertLinuxLeafEvidence(receipt) {
  const leaf = receipt.evidence
  if (leaf?.schemaVersion !== 'release-leaf-evidence-v1' || leaf.subjectSha !== receipt.subjectSha ||
      leaf.clientDigest !== receipt.clientDigest || leaf.run?.head_sha !== receipt.subjectSha ||
      leaf.run?.path !== CI_WORKFLOW || leaf.run?.event !== 'push' || !numeric(leaf.run?.run_attempt) ||
      !leaf.run?.repository?.full_name || !leaf.run?.head_branch || !Array.isArray(leaf.jobs) ||
      leaf.jobs.length !== REQUIRED_JOB_NAMES.length) throw new Error('Linux actual leaf/run evidence is required')
  for (const [index, name] of REQUIRED_JOB_NAMES.entries()) {
    const job = leaf.jobs[index]
    if (job?.name !== name || job.run_id !== leaf.run.id || job.run_attempt !== leaf.run.run_attempt ||
        job.head_sha !== receipt.subjectSha || job.status !== 'completed' || job.conclusion !== 'success') {
      throw new Error(`required leaf/shard evidence mismatch: ${name}`)
    }
  }
  for (const kind of ['client', 'docker', 'supplyChain', 'reports']) {
    const files = leaf.files?.[kind]
    if (!files || !Object.keys(files).length || Object.values(files).some((digest) => !/^[a-f0-9]{64}$/.test(digest))) {
      throw new Error(`actual artifact files missing: ${kind}`)
    }
  }
  if (leaf.files.client['client-dist-manifest.json'] !== receipt.clientDigest || !Array.isArray(leaf.artifacts)) {
    throw new Error('client/producer artifact evidence mismatch')
  }
  for (const artifact of leaf.artifacts) assertArtifact(artifact, leaf.run, artifact.name)
  const names = [`client-dist-v1-${receipt.subjectSha}`, 'coverage-html', `vitest-ci-budget-v1-${receipt.subjectSha}`,
    ...[1, 2, 3, 4].map((n) => `playwright-report-chromium-chromium-${n}`),
    ...['pptx-import', 'live', 'mobile', 'visual'].map((lane) => `playwright-report-${lane}`),
    'docker-runtime-qualification', `container-supply-chain-v1-${receipt.subjectSha}`]
  if (leaf.artifacts.length !== names.length || names.some((name) => leaf.artifacts.filter((item) => item.name === name).length !== 1)) {
    throw new Error('Linux producer artifact manifest is incomplete')
  }
  for (const name of names.slice(1, 11)) {
    if (!Object.keys(leaf.files.reports).some((path) => path.startsWith(`${name}/`))) throw new Error(`actual report artifact files missing: ${name}`)
  }
  const expected = linuxEvidenceGates(leaf)
  for (const gate of Object.keys(expected)) {
    if (receipt.gates[gate] !== expected[gate]) throw new Error(`Linux gate leaf hash mismatch: ${gate}`)
  }
}
