const fs = require('node:fs/promises')
const path = require('node:path')
const { sharedHostAdmission } = require('../../host-admission-controller')
const { ChildRegistry, buildOfficeCliCommand, runBoundedProcess } = require('./bounded-runner')
const { gatewayError } = require('./errors')
const { assertLauncherClient, assertQualifiedExecution, runContainedOfficeCli } = require('./launcher-client')
const { parseBoundedJson } = require('./output-parser')
const { verifyExecutionCopy } = require('./qualification')
const { assertGuardedRevision, createRevisionDescriptor, verifyRevisionBytes } = require('./revision')
const { assertContained, createPrivateWorkspace, removeWorkspace } = require('./workspace')

function createOfficeCliGateway(options) {
  const admission = options.admission || sharedHostAdmission
  const registry = options.registry || new ChildRegistry()
  const qualify = options.qualification
  const readRevision = options.readRevision
  const workspaceRoot = options.workspaceRoot
  const platform = options.platform || process.platform
  const runOfficeCli = options.runOfficeCli || runBoundedProcess
  const executionRoot = options.executionRoot || null
  const executionCopyVerifier = options.executionCopyVerifier || ((copy) => verifyExecutionCopy(copy, { root: executionRoot }))
  const cleanupWorkspace = options.cleanupWorkspace || removeWorkspace
  const launcherClient = options.launcherClient ? assertLauncherClient(options.launcherClient) : null
  let closing = false
  const activeValidations = new Set()
  async function usableQualification() {
    if (platform !== 'win32') throw gatewayError('CAPABILITY_UNAVAILABLE', 'OfficeCLI is unavailable')
    if (typeof workspaceRoot !== 'string' || !path.isAbsolute(workspaceRoot)) {
      throw gatewayError('WORKSPACE_INVALID', 'OfficeCLI workspace root is invalid')
    }
    const qualified = await (typeof qualify === 'function' ? qualify() : null)
    if (!qualified?.available || !qualified.candidate?.identity) {
      throw gatewayError('QUALIFICATION_REQUIRED', 'OfficeCLI binary qualification is required')
    }
    if (qualified.receipt?.kind === 'officecli-direct-qualification-v1' &&
        qualified.receipt.binary?.canonicalPath === qualified.candidate.identity?.canonicalPath &&
        qualified.receipt.binary?.sha256 === qualified.candidate.identity?.sha256 &&
        qualified.receipt.binary?.byteLength === qualified.candidate.identity?.byteLength &&
        qualified.receipt.version === qualified.candidate.version) {
      return { qualified, executionCopy: qualified.receipt.binary, direct: true }
    }
    assertQualifiedExecution(qualified)
    const receiptCopy = qualified.containmentReceipt.executionCopy
    if (qualified.executionCopy && (
      qualified.executionCopy.canonicalPath !== receiptCopy.canonicalPath ||
      qualified.executionCopy.sha256 !== receiptCopy.sha256 ||
      qualified.executionCopy.byteLength !== receiptCopy.byteLength
    )) {
      throw gatewayError('RECEIPT_IDENTITY_MISMATCH', 'OfficeCLI receipt is not bound to the execution copy')
    }
    const executionCopy = receiptCopy
    if (!executionCopy || !await executionCopyVerifier(executionCopy)) {
      throw gatewayError('BINARY_IDENTITY_CHANGED', 'OfficeCLI execution copy identity changed')
    }
    return { qualified: Object.freeze({ ...qualified, executionCopy }), executionCopy }
  }

  async function capability() {
    if (closing) return Object.freeze({ available: false, reason: 'gateway-closed', inspection: false, validation: false, rendering: false, mutation: false, mutationReason: 'gateway-closed', nativeImport: true, originalPreservation: true })
    if (platform !== 'win32' || typeof readRevision !== 'function' || typeof workspaceRoot !== 'string') {
      return Object.freeze({ available: false, reason: 'runtime-dependencies-unavailable', inspection: false, validation: false, rendering: false, mutation: false, mutationReason: 'mutation-disabled', nativeImport: true, originalPreservation: true })
    }
    try {
      await usableQualification()
      return Object.freeze({ available: true, reason: 'contained-execution-verified', inspection: false, validation: true, rendering: false, mutation: false, mutationReason: 'mutation-adapters-unavailable', nativeImport: true, originalPreservation: true })
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
    registry.add(job)
    try {
      signal?.addEventListener?.('abort', abort, { once: true })
      if (signal?.aborted) abort()
      controller.signal.throwIfAborted()
      release = await admission.reserve({ weight: 1, signal: controller.signal })
      controller.signal.throwIfAborted()
      const { qualified } = await usableQualification()
      controller.signal.throwIfAborted()
      const bytes = await readRevision(revision, controller.signal)
      controller.signal.throwIfAborted()
      verifyRevisionBytes(revision, bytes)
      workspace = await createPrivateWorkspace(workspaceRoot)
      const inputPath = path.join(workspace.path, 'input.pptx')
      await fs.writeFile(inputPath, bytes, { flag: 'wx', mode: 0o600 })
      await assertContained(workspace.path, inputPath)
      verifyRevisionBytes(revision, await fs.readFile(inputPath))
      const final = await usableQualification()
      if (final.direct && (final.executionCopy.sha256 !== qualified.receipt?.binary?.sha256 ||
          final.executionCopy.canonicalPath !== qualified.receipt?.binary?.canonicalPath)) {
        throw gatewayError('BINARY_IDENTITY_CHANGED', 'OfficeCLI binary identity changed')
      }
      const result = final.direct
        ? await runOfficeCli({
          binary: final.executionCopy.canonicalPath,
          argv: buildOfficeCliCommand({ operation: 'validate', inputPath }),
          cwd: workspace.path,
          signal: controller.signal,
          maxStdoutBytes: 64 * 1024,
          maxStderrBytes: 64 * 1024,
        })
        : await runContainedOfficeCli({
          launcherClient,
          qualification: final.qualified,
          operation: 'validate',
          workspace,
          inputPath,
          signal: controller.signal,
        })
      if (result.exitCode !== 0) throw gatewayError('PROCESS_FAILED', 'OfficeCLI validation failed')
      return Object.freeze({
        ok: true,
        data: result.receipt || parseBoundedJson(result.stdout),
        metrics: { exitCode: result.exitCode, direct: final.direct },
        receipt: final.direct ? final.qualified.receipt : undefined,
      })
    } finally {
      registry.delete(job)
      signal?.removeEventListener?.('abort', abort)
      try {
        if (workspace) await cleanupWorkspace(workspace.path)
      } finally {
        release?.()
      }
    }
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
