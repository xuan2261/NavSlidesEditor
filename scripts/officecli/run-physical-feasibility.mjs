import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  assertCanonicalFixturePaths,
  assertPrerequisites,
  assertReviewedManifest,
  assertSafeReceipt,
  failure,
  hostReceipt,
  inspectPinnedBinary,
  parseArguments,
  validateFixture,
} from './physical-feasibility-support.mjs'
import { assertAuthoritativeReceipt } from './physical-feasibility-receipt.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CANONICAL_MANIFEST = path.join(
  ROOT,
  'server/services/pptx-import/officecli/qualification-manifest.json',
)
const require = createRequire(import.meta.url)
const qualification = require('../../server/services/pptx-import/officecli/qualification.js')
const gatewayModule = require('../../server/services/pptx-import/officecli/gateway.js')
const guards = require('../../server/services/pptx-import/pptx-guards.js')
const bounded = require('../../server/services/pptx-import/officecli/bounded-runner.js')
const NO_DEPENDENCIES = Object.freeze({})

async function loadManifest(options, deps) {
  if (deps.manifest) return deps.manifest
  if (!options.manifestPath) {
    throw failure('PHYSICAL_PREREQUISITE_MISSING', 'Qualification manifest is required')
  }
  if (path.resolve(options.manifestPath).toLowerCase() !== CANONICAL_MANIFEST.toLowerCase()) {
    throw failure('MANIFEST_UNTRUSTED', 'Authoritative runs require the checked-in manifest')
  }
  return JSON.parse(await fs.readFile(CANONICAL_MANIFEST, 'utf8'))
}

export async function runPhysicalFeasibility(options = {}, deps = NO_DEPENDENCIES) {
  const started = Date.now()
  const testOnly = deps !== NO_DEPENDENCIES
  assertPrerequisites(options)
  assertCanonicalFixturePaths(options, ROOT)
  const manifest = await loadManifest(options, deps)
  assertReviewedManifest(manifest)
  if ((deps.platform || process.platform) !== 'win32') {
    throw failure('UNSUPPORTED_PLATFORM', 'Physical OfficeCLI feasibility requires Windows')
  }
  const inspectBinary = deps.inspectBinary || inspectPinnedBinary
  const candidate = await inspectBinary(options.binary, manifest)
  if (candidate.sha256 !== manifest.releaseAsset.sha256 ||
      candidate.byteLength !== manifest.releaseAsset.byteLength) {
    throw failure('BINARY_IDENTITY_MISMATCH', 'OfficeCLI binary does not match the pinned identity')
  }
  const ownedRoot = options.executionRoot && options.workspaceRoot
    ? null
    : await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-officecli-'))
  const executionRoot = options.executionRoot || path.join(ownedRoot, 'execution')
  const workspaceRoot = options.workspaceRoot || path.join(ownedRoot, 'workspace')
  const snapshotRoot = path.join(ownedRoot || workspaceRoot, 'fixture-snapshots')
  try {
    await fs.mkdir(workspaceRoot, { recursive: true })
    await fs.mkdir(snapshotRoot, { recursive: true })
    const runBoundedProcess = deps.runBoundedProcess || bounded.runBoundedProcess
    const processes = []
    const auditedRun = async (request) => {
      const processStarted = Date.now()
      const result = await runBoundedProcess(request)
      const digest = (value) => crypto.createHash('sha256').update(value || '').digest('hex').toUpperCase()
      processes.push({
        operation: request.argv[0] === '--version' ? 'version' : 'validate',
        exitCode: result.exitCode,
        stdoutBytes: Buffer.byteLength(result.stdout || ''),
        stderrBytes: Buffer.byteLength(result.stderr || ''),
        stdoutSha256: digest(result.stdout),
        stderrSha256: digest(result.stderr),
        durationMs: Date.now() - processStarted,
      })
      return result
    }
    const executionCopy = await (deps.stageExecutionCopy || qualification.stageExecutionCopy)(
      { identity: { ...candidate, size: candidate.byteLength } },
      { executionRoot, probe: deps.probe || qualification.defaultProbe },
    )
    const env = { ...process.env, OFFICECLI_PATH: executionCopy.canonicalPath }
    const qualify = () => qualification.qualifyOfficeCli({
      env, platform: 'win32', probe: deps.probe || qualification.defaultProbe,
      probeVersion: (request) => qualification.probePinnedVersion({ ...request, run: auditedRun }),
    })
    const qualified = await qualify()
    if (!qualified.available) throw failure(qualified.reasonCodes?.[0] || 'QUALIFICATION_FAILED', qualified.reason)
    const bytesById = new Map()
    const gateway = gatewayModule.createOfficeCliGateway({
      workspaceRoot, platform: 'win32', qualification: qualify,
      readRevision: async (revision) => bytesById.get(revision.id),
      runOfficeCli: auditedRun,
    })
    const context = {
      gateway,
      validatePptxPackage: deps.validatePptxPackage || guards.validatePptxPackage,
      createRevisionDescriptor: (input, bytes) => {
        const revision = gatewayModule.createRevisionDescriptor(input)
        bytesById.set(revision.id, bytes)
        return revision
      },
    }
    const fixtures = [
      await validateFixture(options.valid, 'accept', context, snapshotRoot),
      ...await Promise.all(options.malformed.map((fixture) =>
        validateFixture(fixture, 'reject', context, snapshotRoot))),
    ]
    const receipt = {
      schemaVersion: 1,
      status: testOnly ? 'test-only' : 'passed',
      authoritative: !testOnly,
      acquiredAt: options.acquiredAt,
      upstream: { releasePage: manifest.upstream.releasePage, assetUrl: manifest.releaseAsset.sourceAssetUrl },
      legal: {
        spdx: manifest.license.spdx,
        licenseTextSha256: manifest.license.textSha256,
        upstreamNoticeStatus: manifest.license.upstreamNoticeStatus,
        redistributionReviewStatus: manifest.license.redistributionReviewStatus,
      },
      binary: { version: qualified.candidate.version, sha256: candidate.sha256, byteLength: candidate.byteLength },
      processPolicy: {
        stdoutBounded: true,
        stderrBounded: true,
        shellDisabled: true,
        runtimeDownload: false,
        pathLookup: false,
        memoryLimitEnforced: false,
        descendantProcessLimitEnforced: false,
        limitations: ['memory-limit-unproven', 'descendant-containment-unproven'],
      },
      processes,
      host: hostReceipt(deps.os || os),
      fixtures,
      durationMs: Date.now() - started,
    }
    const safeReceipt = assertSafeReceipt(receipt)
    return testOnly ? safeReceipt : assertAuthoritativeReceipt(safeReceipt, manifest)
  } finally {
    if (ownedRoot) await fs.rm(ownedRoot, { recursive: true, force: true })
  }
}

export { assertSafeReceipt }

async function main() {
  const options = parseArguments(process.argv.slice(2))
  if (!options.out) throw failure('PHYSICAL_PREREQUISITE_MISSING', 'Receipt output path is required')
  const receipt = await runPhysicalFeasibility(options)
  const target = path.resolve(options.out)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`${error?.code || 'PHYSICAL_FEASIBILITY_FAILED'}: ${error?.message || 'failed'}`)
    process.exitCode = 1
  })
}

export default { assertSafeReceipt, runPhysicalFeasibility }
