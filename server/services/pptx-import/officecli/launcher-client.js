const fs = require('node:fs/promises')
const nodeFs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { runBoundedProcess } = require('./bounded-runner')
const { gatewayError } = require('./errors')
const { parseBoundedJson } = require('./output-parser')

const RECEIPT_KIND = 'officecli-containment-receipt-v1'

function assertNonEmptyString(value, code, message) {
  if (typeof value !== 'string' || value.length === 0) {
    throw gatewayError(code, message)
  }
  return value
}

function assertQualifiedExecution(qualification) {
  const candidate = qualification?.candidate
  const receipt = qualification?.containmentReceipt
  if (!candidate || !receipt || receipt.kind !== RECEIPT_KIND || receipt.verdict !== 'qualified') {
    throw gatewayError('QUALIFICATION_RECEIPT_REQUIRED', 'OfficeCLI containment qualification is required')
  }
  const candidateHash = assertNonEmptyString(candidate.identity?.sha256, 'INVALID_QUALIFICATION', 'OfficeCLI candidate identity is invalid')
  const executionCopy = receipt.executionCopy
  if (!executionCopy || executionCopy.sha256 !== candidateHash || executionCopy.byteLength !== candidate.identity.size) {
    throw gatewayError('RECEIPT_IDENTITY_MISMATCH', 'OfficeCLI receipt is not bound to the execution copy')
  }
  assertNonEmptyString(executionCopy.canonicalPath, 'INVALID_QUALIFICATION', 'OfficeCLI execution copy is invalid')
  assertNonEmptyString(receipt.launcher?.sha256, 'INVALID_QUALIFICATION', 'OfficeCLI launcher identity is invalid')
  assertNonEmptyString(receipt.launcher?.version, 'INVALID_QUALIFICATION', 'OfficeCLI launcher version is invalid')
  assertNonEmptyString(receipt.policyDigest, 'INVALID_QUALIFICATION', 'OfficeCLI containment policy is invalid')
  if (receipt.binary?.sha256 !== candidateHash || receipt.binary?.version !== candidate.version) {
    throw gatewayError('RECEIPT_IDENTITY_MISMATCH', 'OfficeCLI receipt binary identity is invalid')
  }
  return Object.freeze({
    binary: executionCopy.canonicalPath,
    receipt: Object.freeze(receipt),
  })
}

function assertCandidateExecution(qualification) {
  const qualified = assertQualifiedExecution(qualification)
  const receipt = qualification.containmentReceipt
  return Object.freeze({
    executionCopy: receipt.executionCopy,
    binary: receipt.binary,
    launcher: receipt.launcher,
    policyDigest: receipt.policyDigest,
    binaryPath: qualified.binary,
  })
}

function assertLauncherClient(launcherClient) {
  if (!launcherClient || typeof launcherClient.run !== 'function') {
    throw gatewayError('LAUNCHER_REQUIRED', 'OfficeCLI launcher client is required')
  }
  return launcherClient
}

function assertReceiptMatch(receipt, expected) {
  if (!receipt || receipt.kind !== RECEIPT_KIND || !['qualified', 'failed'].includes(receipt.verdict) ||
      receipt.operation !== 'validate' ||
      receipt.executionCopy?.canonicalPath !== expected.executionCopy.canonicalPath ||
      receipt.executionCopy?.sha256 !== expected.executionCopy.sha256 ||
      receipt.executionCopy?.byteLength !== expected.executionCopy.byteLength ||
      receipt.binary?.sha256 !== expected.binary.sha256 ||
      receipt.binary?.version !== expected.binary.version ||
      receipt.launcher?.sha256 !== expected.launcher.sha256 ||
      receipt.launcher?.version !== expected.launcher.version ||
      receipt.policyDigest !== expected.policyDigest ||
      receipt.inputSha256 !== expected.inputSha256 ||
      !Number.isSafeInteger(receipt.exitCode) ||
      !Number.isSafeInteger(expected.launcherExitCode) ||
      (expected.launcherExitCode === 0
        ? receipt.verdict !== 'qualified' || receipt.exitCode !== 0
        : receipt.verdict !== 'failed' || receipt.exitCode === 0) ||
      typeof receipt.launcher?.sha256 !== 'string' || !receipt.launcher.sha256 ||
      typeof receipt.launcher?.version !== 'string' || !receipt.launcher.version) {
    throw gatewayError('LAUNCHER_RECEIPT_INVALID', 'OfficeCLI launcher receipt is invalid')
  }
  return receipt
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  for await (const chunk of nodeFs.createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex').toUpperCase()
}

async function verifyLauncherIdentity(launcherPath, identity) {
  try {
    const stat = await fs.stat(launcherPath)
    return stat.isFile() && (!Number.isSafeInteger(identity.byteLength) || stat.size === identity.byteLength) &&
      await hashFile(launcherPath) === identity.sha256
  } catch {
    return false
  }
}

function createNativeLauncherClient({ launcherPath, launcherIdentity, policyDigest, verifyLauncher = verifyLauncherIdentity, runProcess = runBoundedProcess } = {}) {
  if (typeof launcherPath !== 'string' || !path.win32.isAbsolute(launcherPath)) {
    throw new TypeError('OfficeCLI launcher path must be an absolute Windows path')
  }
  if (typeof launcherIdentity?.sha256 !== 'string' || !launcherIdentity.sha256 ||
      typeof launcherIdentity?.version !== 'string' || !launcherIdentity.version) {
    throw new TypeError('OfficeCLI launcher identity is required')
  }
  if (typeof policyDigest !== 'string' || !policyDigest) throw new TypeError('OfficeCLI containment policy digest is required')
  if (typeof runProcess !== 'function') throw new TypeError('OfficeCLI launcher process runner is required')

  return Object.freeze({
    async run({ operation, qualification, workspace, inputPath, signal }) {
      const execution = assertCandidateExecution(qualification)
      if (execution.policyDigest !== policyDigest) {
        throw gatewayError('POLICY_DIGEST_MISMATCH', 'OfficeCLI containment policy does not match the launcher policy')
      }
      if (execution.launcher?.sha256 !== launcherIdentity.sha256 ||
          execution.launcher?.version !== launcherIdentity.version) {
        throw gatewayError('LAUNCHER_IDENTITY_MISMATCH', 'OfficeCLI containment launcher identity does not match')
      }
      const executionCopy = execution.binaryPath
      if (operation !== 'validate' || typeof executionCopy !== 'string' || !workspace?.path || typeof inputPath !== 'string') {
        throw gatewayError('OPERATION_NOT_ALLOWED', 'OfficeCLI operation is not permitted')
      }
      if (!await verifyLauncher(launcherPath, launcherIdentity)) {
        throw gatewayError('LAUNCHER_IDENTITY_CHANGED', 'OfficeCLI launcher identity changed')
      }
      const root = path.resolve(workspace.path)
      const requestPath = path.join(root, 'officecli-launcher-request.json')
      if (path.dirname(path.resolve(requestPath)) !== root || path.dirname(path.resolve(inputPath)) !== root) {
        throw gatewayError('WORKSPACE_PATH_INVALID', 'OfficeCLI workspace path is invalid')
      }
      let inputSha256
      try {
        inputSha256 = await hashFile(inputPath)
      } catch {
        throw gatewayError('INPUT_IDENTITY_INVALID', 'OfficeCLI input package identity is unavailable')
      }
      const request = {
        operation: 'validate',
        binaryVersion: execution.binary.version,
        executionCopy,
        inputPath,
        workspacePath: root,
        policyDigest: execution.policyDigest || policyDigest,
      }
      const serialized = JSON.stringify(request)
      if (Buffer.byteLength(serialized) > 64 * 1024) {
        throw gatewayError('LAUNCHER_REQUEST_INVALID', 'OfficeCLI launcher request is invalid')
      }
      await fs.writeFile(requestPath, serialized, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
      const result = await runProcess({
        binary: launcherPath,
        argv: ['--request', requestPath],
        cwd: root,
        signal,
        maxStdoutBytes: 64 * 1024,
        maxStderrBytes: 64 * 1024,
      })
      let parsedReceipt
      try {
        parsedReceipt = parseBoundedJson(result.stdout, { maxBytes: 64 * 1024 })
      } catch {
        throw gatewayError('LAUNCHER_RECEIPT_INVALID', 'OfficeCLI launcher receipt is invalid')
      }
      const receipt = assertReceiptMatch(parsedReceipt, {
        executionCopy: execution.executionCopy,
        binary: execution.binary,
        launcher: launcherIdentity,
        policyDigest: execution.policyDigest || policyDigest,
        inputSha256,
        launcherExitCode: result.exitCode,
      })
      return Object.freeze({ ...result, receipt })
    },
  })
}

async function runContainedOfficeCli({ launcherClient, qualification, operation, workspace, inputPath, signal }) {
  const client = assertLauncherClient(launcherClient)
  if (typeof operation !== 'string' || !['validate'].includes(operation)) {
    throw gatewayError('OPERATION_NOT_ALLOWED', 'OfficeCLI operation is not permitted')
  }
  return client.run(Object.freeze({
    operation,
    qualification,
    workspace,
    inputPath,
    signal,
  }))
}

module.exports = { RECEIPT_KIND, assertCandidateExecution, assertLauncherClient, assertQualifiedExecution, createNativeLauncherClient, runContainedOfficeCli }
