const crypto = require('crypto')
const fs = require('fs')
const fsp = require('fs/promises')
const path = require('path')
const manifest = require('./qualification-manifest.json')
const { buildOfficeCliCommand, runBoundedProcess } = require('./bounded-runner')
const { canonicalReasonCodes, reasonCodeSubject } = require('../reason-code-contract')

const OPERATION_POLICY_VERSION = 'officecli-direct-v1'
const DIRECT_LIMITATIONS = Object.freeze([
  'restricted-identity-not-proven',
  'launcher-identity-absent',
  'profile-isolation-not-proven',
  'egress-isolation-not-proven',
  'independent-descendant-containment-not-proven',
  'teardown-attestation-not-proven',
  'separation-of-duties-not-proven',
])

function isAbsoluteForPlatform(candidate, platform) {
  const pathApi = platform === 'win32' ? path.win32 : path.posix
  return pathApi.isAbsolute(candidate)
}

function discoverConfiguredPath({ env = process.env, platform = process.platform } = {}) {
  const configured = env.OFFICECLI_PATH
  if (typeof configured !== 'string' || configured.length === 0) return null
  return isAbsoluteForPlatform(configured, platform) ? configured : null
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex').toUpperCase()
}

const defaultProbe = {
  lstatFile: (filePath) => fsp.lstat(filePath),
  realpath: (filePath) => fsp.realpath(filePath),
  statFile: (filePath) => fsp.stat(filePath),
  hashFile,
}

function isUnsafeWindowsPath(candidate) {
  return /^\\\\|^[a-z]:[^\\]/i.test(candidate) || /:[^\\]+$/i.test(candidate)
}

function freezeIdentity({ canonicalPath, stat, sha256 }) {
  return Object.freeze({
    canonicalPath,
    volumeIdentity: stat.dev ?? null,
    fileId: stat.ino ?? null,
    linkCount: stat.nlink ?? null,
    byteLength: stat.size,
    sha256,
  })
}

function sameIdentity(left, right) {
  return left?.canonicalPath === right?.canonicalPath &&
    left?.volumeIdentity === right?.volumeIdentity &&
    left?.fileId === right?.fileId &&
    left?.linkCount === right?.linkCount &&
    left?.byteLength === right?.byteLength &&
    left?.sha256 === right?.sha256
}

async function readPinnedIdentity(configuredPath, probe) {
  if (isUnsafeWindowsPath(configuredPath)) return { reason: 'path-unsafe' }
  const linkStat = await probe.lstatFile(configuredPath)
  if (!linkStat.isFile?.() || linkStat.isSymbolicLink?.() || linkStat.isReparsePoint?.()) return { reason: 'path-unsafe' }
  const canonicalPath = await probe.realpath(configuredPath)
  if (path.win32.normalize(canonicalPath).toLowerCase() !== path.win32.normalize(configuredPath).toLowerCase()) {
    return { reason: 'path-unsafe' }
  }
  const stat = await probe.statFile(configuredPath)
  if (!stat.isFile?.() || stat.isReparsePoint?.() || (Number.isSafeInteger(stat.nlink) && stat.nlink !== 1)) {
    return { reason: 'path-unsafe' }
  }
  if (stat.size !== manifest.releaseAsset.byteLength) return { reason: 'size-mismatch' }
  const sha256 = (await probe.hashFile(configuredPath)).toUpperCase()
  if (sha256 !== manifest.releaseAsset.sha256) return { reason: 'hash-mismatch' }
  return { identity: freezeIdentity({ canonicalPath, stat, sha256 }) }
}

async function probePinnedVersion({ binary, operation = 'version', env = process.env, run = runBoundedProcess } = {}) {
  const result = await run({
    binary,
    argv: buildOfficeCliCommand({ operation }),
    cwd: path.win32.dirname(binary),
    env,
    maxStdoutBytes: 4096,
    maxStderrBytes: 4096,
  })
  const version = typeof result.stdout === 'string' ? result.stdout.trim() : ''
  if (result.exitCode !== 0 || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('OfficeCLI version probe output is invalid')
  }
  return Object.freeze({
    version,
    exitCode: result.exitCode,
    resultHash: crypto.createHash('sha256').update(version).digest('hex').toUpperCase(),
  })
}

const QUALIFICATION_REASONS = Object.freeze({
  'unsupported-platform': 'OFFICECLI_UNSUPPORTED_PLATFORM',
  'not-configured': 'OFFICECLI_NOT_CONFIGURED',
  'path-not-absolute': 'OFFICECLI_PATH_INVALID',
  'path-unsafe': 'OFFICECLI_PATH_UNSAFE',
  'binary-not-found': 'OFFICECLI_BINARY_NOT_FOUND',
  'size-mismatch': 'OFFICECLI_SIZE_MISMATCH',
  'hash-mismatch': 'OFFICECLI_HASH_MISMATCH',
  'version-mismatch': 'OFFICECLI_VERSION_MISMATCH',
  'binary-drift': 'OFFICECLI_BINARY_DRIFT',
  'probe-failed': 'OFFICECLI_PROBE_FAILED',
})

function unavailable(reason, configuredPath = null) {
  return Object.freeze({
    available: false,
    candidateAvailable: false,
    reason,
    configuredPath,
    inspection: false,
    validation: false,
    mutation: false,
    nativeImport: true,
    originalPreservation: true,
    reasonCodes: canonicalReasonCodes([QUALIFICATION_REASONS[reason]]),
    reasonCodeSubject: reasonCodeSubject(),
  })
}

async function stageExecutionCopy(candidate, { executionRoot, probe = defaultProbe } = {}) {
  if (!executionRoot || !path.isAbsolute(executionRoot)) {
    throw new TypeError('OfficeCLI execution root must be absolute')
  }
  await fsp.mkdir(executionRoot, { recursive: true, mode: 0o700 })
  const root = await fsp.realpath(executionRoot)
  const directory = path.join(root, candidate.identity.sha256)
  const executionCopy = path.join(directory, 'officecli.exe')
  try {
    await fsp.mkdir(directory, { mode: 0o700 })
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    await fsp.chmod(executionCopy, 0o500).catch(() => {})
    const existing = { canonicalPath: executionCopy, sha256: candidate.identity.sha256, byteLength: candidate.identity.size }
    if (await verifyExecutionCopy(existing, { root, probe })) return Object.freeze(existing)
    const exists = new Error('OfficeCLI execution-copy target already exists')
    exists.code = 'EXECUTION_COPY_EXISTS'
    throw exists
  }
  await fsp.copyFile(candidate.identity.canonicalPath, executionCopy, fs.constants.COPYFILE_EXCL)
  await fsp.chmod(executionCopy, 0o500)
  const copyStat = await probe.statFile(executionCopy)
  const copyHash = (await probe.hashFile(executionCopy)).toUpperCase()
  if (!copyStat.isFile() || copyStat.nlink > 1 || copyStat.size !== candidate.identity.size || copyHash !== candidate.identity.sha256 ||
      await probe.realpath(executionCopy) !== executionCopy) {
    throw new Error('OfficeCLI execution-copy identity mismatch')
  }
  if (!await verifyExecutionCopy({ canonicalPath: executionCopy, sha256: copyHash, byteLength: copyStat.size }, { root, probe })) {
    throw new Error('OfficeCLI execution-copy safety verification failed')
  }
  return Object.freeze({ canonicalPath: executionCopy, sha256: copyHash, byteLength: copyStat.size })
}

async function qualifyOfficeCli({
  env = process.env,
  platform = process.platform,
  probe = defaultProbe,
  probeVersion = probePinnedVersion,
  matrixSubject = null,
  now = () => new Date().toISOString(),
} = {}) {
  if (platform !== manifest.distribution.supportedPlatform) return unavailable('unsupported-platform')
  const rawPath = env.OFFICECLI_PATH
  if (!rawPath) return unavailable('not-configured')
  const configuredPath = discoverConfiguredPath({ env, platform })
  if (!configuredPath) return unavailable('path-not-absolute')
  try {
    const before = await readPinnedIdentity(configuredPath, probe)
    if (before.reason) return unavailable(before.reason, configuredPath)
    const versionResult = await probeVersion({ binary: before.identity.canonicalPath, operation: 'version', env })
    if (versionResult?.exitCode !== 0 || versionResult?.version !== manifest.version ||
      typeof versionResult.resultHash !== 'string' || !/^[A-F0-9]{64}$/.test(versionResult.resultHash)) {
      return unavailable('version-mismatch', configuredPath)
    }
    const after = await readPinnedIdentity(configuredPath, probe)
    if (after.reason) return unavailable(after.reason, configuredPath)
    if (!sameIdentity(before.identity, after.identity)) return unavailable('binary-drift', configuredPath)
    const receipt = Object.freeze({
      kind: 'officecli-direct-qualification-v1',
      authority: 'local',
      receiptId: crypto.createHash('sha256').update(`${after.identity.sha256}:${versionResult.resultHash}:${now()}`).digest('hex').toUpperCase(),
      operationPolicyVersion: OPERATION_POLICY_VERSION,
      operationTemplateIds: Object.freeze(['officecli.version.v1', 'officecli.validate.v1']),
      binary: after.identity,
      version: manifest.version,
      versionProbeResultHash: versionResult.resultHash,
      matrixSubject: matrixSubject ? Object.freeze({ ...matrixSubject }) : null,
      environmentPolicy: 'officecli-filtered-env-v1',
      limitsPolicy: 'officecli-bounded-run-v1',
      agePolicy: 'fresh-per-operation',
      reasonCodeSubject: reasonCodeSubject(),
      windowsOnly: true,
      issuedAt: now(),
      limitations: DIRECT_LIMITATIONS,
    })
    return Object.freeze({
      available: true,
      candidateAvailable: true,
      reason: 'direct-local-qualified',
      configuredPath,
      candidate: Object.freeze({ identity: after.identity, version: manifest.version }),
      inspection: false,
      validation: true,
      mutation: false,
      nativeImport: true,
      originalPreservation: true,
      receipt,
    })
  } catch (error) {
    if (error?.code === 'ENOENT') return unavailable('binary-not-found', configuredPath)
    return unavailable('probe-failed', configuredPath)
  }
}

async function verifyExecutionCopy(executionCopy, { root = null, probe = defaultProbe } = {}) {
  if (!executionCopy?.canonicalPath || !executionCopy.sha256 || !Number.isSafeInteger(executionCopy.byteLength)) return false
  try {
    const linkStat = await probe.lstatFile?.(executionCopy.canonicalPath)
    if (linkStat?.isSymbolicLink?.()) return false
    const stat = await probe.statFile(executionCopy.canonicalPath)
    if (!stat.isFile() || (Number.isSafeInteger(stat.nlink) && stat.nlink > 1) || stat.size !== executionCopy.byteLength) return false
    const canonicalPath = await probe.realpath(executionCopy.canonicalPath)
    if (canonicalPath !== executionCopy.canonicalPath) return false
    if (root) {
      const canonicalRoot = await probe.realpath(root)
      const relative = path.relative(canonicalRoot, canonicalPath)
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
    }
    return (await probe.hashFile(canonicalPath)).toUpperCase() === executionCopy.sha256
  } catch { return false }
}

module.exports = {
  DIRECT_LIMITATIONS,
  OPERATION_POLICY_VERSION,
  defaultProbe,
  discoverConfiguredPath,
  qualifyOfficeCli,
  probePinnedVersion,
  sameIdentity,
  stageExecutionCopy,
  verifyExecutionCopy,
}
