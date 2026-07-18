const { spawn } = require('node:child_process')
const { buildSpawnOptions } = require('./process-contract')
const { gatewayError } = require('./errors')

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_OUTPUT_BYTES = 1_048_576

class ChildRegistry {
  constructor() { this.children = new Set() }
  add(child) { this.children.add(child) }
  delete(child) { this.children.delete(child) }
  async cancelAll() {
    await Promise.allSettled([...this.children].map(async (child) => {
      if (typeof child.cancel === 'function') await child.cancel()
    }))
  }
  get size() { return this.children.size }
}

function buildOfficeCliCommand({ operation, inputPath }) {
  if (operation === 'version' && inputPath === undefined) return Object.freeze(['--version'])
  if (operation === 'validate' && typeof inputPath === 'string' && inputPath.length > 0) {
    return Object.freeze(['validate', inputPath, '--json'])
  }
  throw gatewayError('OPERATION_NOT_ALLOWED', 'OfficeCLI operation is not permitted')
}

function runBoundedProcess({
  binary,
  argv,
  cwd,
  env,
  signal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxStdoutBytes = DEFAULT_MAX_OUTPUT_BYTES,
  maxStderrBytes = DEFAULT_MAX_OUTPUT_BYTES,
  spawnImpl = spawn,
} = {}) {
  if (typeof binary !== 'string' || !binary || !Array.isArray(argv) || !cwd) {
    return Promise.reject(gatewayError('PROCESS_REQUEST_INVALID', 'OfficeCLI process request is invalid'))
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 ||
      !Number.isSafeInteger(maxStdoutBytes) || maxStdoutBytes <= 0 ||
      !Number.isSafeInteger(maxStderrBytes) || maxStderrBytes <= 0) {
    return Promise.reject(gatewayError('PROCESS_LIMIT_INVALID', 'OfficeCLI process limits are invalid'))
  }
  if (signal?.aborted) return Promise.reject(gatewayError('PROCESS_ABORTED', 'OfficeCLI process was cancelled'))

  return new Promise((resolve, reject) => {
    let child
    let settled = false
    let failure = null
    let stdoutBytes = 0
    let stderrBytes = 0
    const stdout = []
    const stderr = []
    const abort = () => fail('PROCESS_ABORTED', 'OfficeCLI process was cancelled')
    const timeout = setTimeout(() => fail('PROCESS_TIMEOUT', 'OfficeCLI process exceeded its time limit'), timeoutMs)

    function finishFailure() {
      if (settled || !failure) return
      settled = true
      clearTimeout(timeout)
      signal?.removeEventListener?.('abort', abort)
      reject(failure)
    }

    function stop() {
      clearTimeout(timeout)
      signal?.removeEventListener?.('abort', abort)
      if (!child || child.killed) {
        finishFailure()
        return
      }
      child.kill()
    }

    function fail(code, message) {
      if (settled || failure) return
      failure = gatewayError(code, message)
      stop()
    }

    function collect(chunks, limit, kind) {
      return (chunk) => {
        if (settled || failure) return
        const buffer = Buffer.from(chunk)
        if (kind === 'stdout') stdoutBytes += buffer.length
        else stderrBytes += buffer.length
        if ((kind === 'stdout' ? stdoutBytes : stderrBytes) > limit) {
          fail('OUTPUT_LIMIT_EXCEEDED', 'OfficeCLI process output exceeded its limit')
          return
        }
        chunks.push(buffer)
      }
    }

    try {
      child = spawnImpl(binary, argv, buildSpawnOptions({ env, cwd }))
    } catch {
      fail('PROCESS_SPAWN_FAILED', 'OfficeCLI process could not start')
      return
    }
    signal?.addEventListener?.('abort', abort, { once: true })
    child.once('error', () => fail('PROCESS_SPAWN_FAILED', 'OfficeCLI process could not start'))
    child.stdout?.on('data', collect(stdout, maxStdoutBytes, 'stdout'))
    child.stderr?.on('data', collect(stderr, maxStderrBytes, 'stderr'))
    child.once('close', (exitCode, terminationSignal) => {
      if (settled) return
      if (failure) {
        finishFailure()
        return
      }
      settled = true
      clearTimeout(timeout)
      signal?.removeEventListener?.('abort', abort)
      resolve(Object.freeze({
        exitCode,
        signal: terminationSignal,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }))
    })
  })
}

module.exports = { ChildRegistry, buildOfficeCliCommand, runBoundedProcess }
