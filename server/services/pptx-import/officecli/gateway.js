const fs = require('node:fs/promises')
const path = require('node:path')
const { sharedHostAdmission } = require('../../host-admission-controller')
const { ChildRegistry, buildOfficeCliCommand, runBoundedProcess } = require('./bounded-runner')
const { gatewayError } = require('./errors')
const { parseValidationResult } = require('./output-parser')
const { assertGuardedRevision, createRevisionDescriptor, verifyRevisionBytes } = require('./revision')
const { assertContained, createPrivateWorkspace, removeWorkspace } = require('./workspace')
const {
  configuredLimits,
  directQualification,
  normalizedFailure,
  quarantineWorkspace,
  sameBinary,
  workspaceBytes,
} = require('./gateway-policy')

function createOfficeCliGateway(options) {
  const admission = options.admission || sharedHostAdmission
  const registry = options.registry || new ChildRegistry()
  const qualify = options.qualification
  const readRevision = options.readRevision
  const workspaceRoot = options.workspaceRoot
  const platform = options.platform || process.platform
  const runOfficeCli = options.runOfficeCli || runBoundedProcess
  const cleanupWorkspace = options.cleanupWorkspace || removeWorkspace
  const limits = configuredLimits(options.limits)
  let closing = false
  const activeValidations = new Set()
  async function usableQualification() {
    if (platform !== 'win32') throw gatewayError('CAPABILITY_UNAVAILABLE', 'OfficeCLI is unavailable')
    if (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot)) {
      throw gatewayError('WORKSPACE_INVALID', 'OfficeCLI workspace root is invalid')
    }
    const qualified = await (typeof qualify === 'function' ? qualify() : null)
    return directQualification(qualified)
  }

  async function capability() {
    if (closing) return Object.freeze({ available: false, reason: 'gateway-closed', inspection: false, validation: false, rendering: false, mutation: false, mutationReason: 'gateway-closed', nativeImport: true, originalPreservation: true })
    if (platform !== 'win32' || typeof readRevision !== 'function' || typeof workspaceRoot !== 'string') {
      return Object.freeze({ available: false, reason: 'runtime-dependencies-unavailable', inspection: false, validation: false, rendering: false, mutation: false, mutationReason: 'mutation-disabled', nativeImport: true, originalPreservation: true })
    }
    try {
      await usableQualification()
      return Object.freeze({ available: true, reason: 'direct-local-qualified', inspection: false, validation: true, rendering: false, mutation: false, mutationReason: 'mutation-adapters-unavailable', nativeImport: true, originalPreservation: true })
    } catch {
      return Object.freeze({ available: false, reason: 'qualification-required', inspection: false, validation: false, rendering: false, mutation: false, mutationReason: 'mutation-adapters-unavailable', nativeImport: true, originalPreservation: true })
    }
  }

  async function runValidation(revision, signal) {
    if (platform !== 'win32') throw gatewayError('CAPABILITY_UNAVAILABLE', 'OfficeCLI is unavailable')
    assertGuardedRevision(revision)
    const controller = new AbortController()
    const abort = () => controller.abort(signal?.reason)
    const job = Object.freeze({ cancel: async () => abort() })
    let release
    let workspace
    let result
    let failure
    let success
    registry.add(job)
    try {
      signal?.addEventListener?.('abort', abort, { once: true })
      if (signal?.aborted) abort()
      controller.signal.throwIfAborted()
      release = await admission.reserve({ weight: 1, signal: controller.signal })
      controller.signal.throwIfAborted()
      const before = await usableQualification()
      controller.signal.throwIfAborted()
      const bytes = await readRevision(revision, controller.signal)
      controller.signal.throwIfAborted()
      if (!Buffer.isBuffer(bytes) || bytes.length > limits.maxInputBytes) {
        throw gatewayError('INPUT_LIMIT_EXCEEDED', 'OfficeCLI input exceeds its resource budget')
      }
      verifyRevisionBytes(revision, bytes)
      workspace = await createPrivateWorkspace(workspaceRoot)
      const inputPath = path.join(workspace.path, 'input.pptx')
      await fs.writeFile(inputPath, bytes, { flag: 'wx', mode: 0o600 })
      await assertContained(workspace.path, inputPath)
      verifyRevisionBytes(revision, await fs.readFile(inputPath))
      if (await workspaceBytes(workspace.path) > limits.maxTempBytes) {
        throw gatewayError('TEMP_LIMIT_EXCEEDED', 'OfficeCLI workspace exceeds its resource budget')
      }
      const final = await usableQualification()
      if (!sameBinary(before.binary, final.binary)) {
        throw gatewayError('BINARY_IDENTITY_CHANGED', 'OfficeCLI binary identity changed')
      }
      result = await runOfficeCli({
        binary: final.binary.canonicalPath,
        argv: buildOfficeCliCommand({ operation: 'validate', inputPath }),
        cwd: workspace.path,
        signal: controller.signal,
        timeoutMs: limits.timeoutMs,
        cleanupGraceMs: limits.cleanupGraceMs,
        maxMemoryBytes: limits.maxMemoryBytes,
        maxProcesses: limits.maxProcesses,
        maxStdoutBytes: limits.maxStdoutBytes,
        maxStderrBytes: limits.maxStderrBytes,
      })
      if (result.exitCode !== 0) throw gatewayError('PROCESS_FAILED', 'OfficeCLI validation failed')
      if (await workspaceBytes(workspace.path) > limits.maxTempBytes) {
        throw gatewayError('TEMP_LIMIT_EXCEEDED', 'OfficeCLI workspace exceeds its resource budget')
      }
      success = Object.freeze({
        ok: true,
        data: parseValidationResult(result.stdout, { maxBytes: limits.maxStdoutBytes }),
        metrics: { exitCode: result.exitCode, direct: true },
        receipt: final.receipt,
      })
    } catch (error) {
      failure = normalizedFailure(error, controller.signal)
    } finally {
      registry.delete(job)
      signal?.removeEventListener?.('abort', abort)
      try {
        if (workspace) await cleanupWorkspace(workspace.path)
      } catch {
        try { await quarantineWorkspace(workspace.path) } catch {}
        failure = gatewayError('CLEANUP_UNCERTAIN', 'OfficeCLI cleanup could not be proven')
      } finally {
        release?.()
      }
    }
    if (failure) throw failure
    return success
  }

  async function validate(revision, signal) {
    if (closing) throw gatewayError('GATEWAY_CLOSED', 'OfficeCLI gateway is shutting down')
    const operation = runValidation(revision, signal)
    activeValidations.add(operation)
    try {
      return await operation
    } finally {
      activeValidations.delete(operation)
    }
  }

  const unavailableRead = async () => { throw gatewayError('INSPECTION_UNAVAILABLE', 'OfficeCLI inspection is not integrated') }
  const mutation = async () => { throw gatewayError('MUTATION_DISABLED', 'OfficeCLI mutation adapters are not integrated') }

  return Object.freeze({
    probeCapability: capability,
    inspectPresentation: unavailableRead,
    inventoryObjects: unavailableRead,
    readRawPart: unavailableRead,
    validatePackage: (revision, context = {}) => validate(revision, context.signal),
    renderInformativePreview: async () => { throw gatewayError('RENDERING_UNAVAILABLE', 'OfficeCLI rendering is not integrated') },
    applyTextPatch: mutation,
    applyShapePatch: mutation,
    applyChartPatch: mutation,
    applyRelationshipPatch: mutation,
    applyAllowlistedBatch: mutation,
    shutdown: async () => {
      closing = true
      await registry.cancelAll()
      await Promise.allSettled([...activeValidations])
    },
  })
}

module.exports = { createOfficeCliGateway, createRevisionDescriptor }
