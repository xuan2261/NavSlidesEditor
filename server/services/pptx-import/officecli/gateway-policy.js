const fs = require('node:fs/promises')
const path = require('node:path')
const { gatewayError } = require('./errors')

const DEFAULT_LIMITS = Object.freeze({
  maxInputBytes: 50 * 1024 * 1024,
  maxTempBytes: 75 * 1024 * 1024,
  maxStdoutBytes: 64 * 1024,
  maxStderrBytes: 64 * 1024,
  timeoutMs: 30_000,
  cleanupGraceMs: 5_000,
  maxMemoryBytes: 512 * 1024 * 1024,
  maxProcesses: 1,
})

function configuredLimits(limits = {}) {
  const merged = { ...DEFAULT_LIMITS, ...limits }
  if (Object.values(merged).some((value) => !Number.isSafeInteger(value) || value <= 0) ||
      merged.maxProcesses !== 1) {
    throw gatewayError('RESOURCE_POLICY_INVALID', 'OfficeCLI resource policy is invalid')
  }
  return Object.freeze(merged)
}

function directQualification(qualified) {
  const receipt = qualified?.receipt
  const candidate = qualified?.candidate
  const binary = candidate?.identity
  if (!qualified?.available || !qualified.validation || !binary ||
      receipt?.kind !== 'officecli-direct-qualification-v1' ||
      receipt?.version !== candidate?.version ||
      receipt?.binary?.canonicalPath !== binary.canonicalPath ||
      receipt?.binary?.sha256 !== binary.sha256 ||
      receipt?.binary?.byteLength !== binary.byteLength) {
    throw gatewayError('QUALIFICATION_REQUIRED', 'OfficeCLI binary qualification is required')
  }
  return Object.freeze({ binary, receipt })
}

function sameBinary(left, right) {
  return left?.canonicalPath === right?.canonicalPath &&
    left?.sha256 === right?.sha256 &&
    left?.byteLength === right?.byteLength &&
    left?.fileId === right?.fileId &&
    left?.volumeIdentity === right?.volumeIdentity
}

async function workspaceBytes(workspace) {
  let total = 0
  for (const entry of await fs.readdir(workspace, { withFileTypes: true })) {
    const target = path.join(workspace, entry.name)
    if (entry.isDirectory()) total += await workspaceBytes(target)
    else if (entry.isFile()) total += (await fs.stat(target)).size
    else throw gatewayError('TEMP_WORKSPACE_UNSAFE', 'OfficeCLI workspace contains an unsafe entry')
  }
  return total
}

async function quarantineWorkspace(workspace) {
  const root = path.dirname(workspace)
  const quarantine = path.join(root, '.quarantine')
  await fs.mkdir(quarantine, { recursive: true, mode: 0o700 })
  await fs.rename(workspace, path.join(quarantine, `${path.basename(workspace)}-${Date.now()}`))
}

function normalizedFailure(error, signal) {
  if (error?.code) return error
  if (signal?.aborted) return gatewayError('CANCELLED', 'OfficeCLI validation was cancelled')
  return gatewayError('OUTPUT_INVALID', 'OfficeCLI output is invalid')
}

module.exports = {
  configuredLimits,
  directQualification,
  normalizedFailure,
  quarantineWorkspace,
  sameBinary,
  workspaceBytes,
}
