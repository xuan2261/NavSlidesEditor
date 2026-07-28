/**
 * Policy-guarded EMF/WMF conversion (no shell; spawns only when enabled).
 * Default: conversion disabled — surface as import failure in strict mode, not permanent placeholder.
 * When enabled: hash-pinned absolute executables stay inside a trusted root; the
 * child environment is narrow. This is not an OS/network sandbox guarantee.
 */
const { spawn } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { StringDecoder } = require('node:string_decoder')

const ALLOWED_BINARIES = new Set(['magick', 'convert', 'inkscape'])

function assertSafeInputPath(filePath) {
  const resolved = path.resolve(filePath)
  if (resolved.includes('\0')) throw new Error('Invalid path')
  return resolved
}

function resolveConverterBinary(options = {}) {
  const binary = options.binary || process.env.PPTX_EMF_BINARY || 'magick'
  if (!path.isAbsolute(binary)) {
    return {
      ok: false,
      error: 'emf-binary-must-be-absolute',
      code: 'POLICY',
    }
  }

  const base = path.basename(binary).replace(/\.exe$/i, '')
  if (!ALLOWED_BINARIES.has(base)) {
    return { ok: false, error: 'binary-not-allowlisted', code: 'POLICY' }
  }

  const trustedRoot = options.trustedRoot || process.env.PPTX_EMF_BINARY_ROOT
  if (typeof trustedRoot !== 'string' || !trustedRoot || !path.isAbsolute(trustedRoot)) {
    return { ok: false, error: 'emf-binary-root-must-be-absolute', code: 'POLICY' }
  }
  const expectedHash = String(options.sha256 || process.env.PPTX_EMF_BINARY_SHA256 || '').toLowerCase()
  if (!/^[a-f0-9]{64}$/u.test(expectedHash)) {
    return { ok: false, error: 'emf-binary-hash-required', code: 'POLICY' }
  }

  let rootStat
  let binaryStat
  let canonicalRoot
  let canonicalBinary
  try {
    rootStat = fs.lstatSync(trustedRoot)
    binaryStat = fs.lstatSync(binary)
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
      return { ok: false, error: 'emf-binary-root-invalid', code: 'POLICY' }
    }
    if (!binaryStat.isFile() || binaryStat.isSymbolicLink() || binaryStat.nlink > 1) {
      return { ok: false, error: 'emf-binary-file-invalid', code: 'POLICY' }
    }
    canonicalRoot = fs.realpathSync.native(trustedRoot)
    canonicalBinary = fs.realpathSync.native(binary)
  } catch {
    return { ok: false, error: 'emf-binary-not-found', code: 'POLICY' }
  }

  const relative = path.relative(canonicalRoot, canonicalBinary)
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return { ok: false, error: 'emf-binary-outside-root', code: 'POLICY' }
  }

  let actualHash
  try {
    actualHash = crypto.createHash('sha256').update(fs.readFileSync(canonicalBinary)).digest('hex')
  } catch {
    return { ok: false, error: 'emf-binary-unreadable', code: 'POLICY' }
  }
  if (actualHash !== expectedHash) {
    return { ok: false, error: 'emf-binary-hash-mismatch', code: 'POLICY' }
  }
  return { ok: true, binary: canonicalBinary, sha256: actualHash }
}

function narrowConverterEnv() {
  // Do not inherit full process.env (secrets, tokens, arbitrary host config).
  const env = {
    PATH: process.env.PATH || '',
    SystemRoot: process.env.SystemRoot,
    windir: process.env.windir,
    TMP: process.env.TMP || process.env.TEMP,
    TEMP: process.env.TEMP || process.env.TMP,
    LANG: process.env.LANG,
  }
  // Drop undefined keys so spawn does not stringify them oddly.
  for (const key of Object.keys(env)) {
    if (env[key] == null) delete env[key]
  }
  return env
}

// Enough of a failed converter's complaint to diagnose it, without letting a
// chatty binary grow the buffer without bound.
const MAX_STDERR_BYTES = 8 * 1024

/**
 * Convert EMF/WMF → PNG via a verified binary. Never uses shell:true.
 * The child runs asynchronously: this process also serves live presentations,
 * import progress, and the REST API, so a slow converter must not stall them.
 * @returns {Promise<{ ok: boolean, outPath?: string, error?: string, code?: string }>}
 */
async function convertVectorImage(inputPath, outputPath, options = {}) {
  if (process.env.PPTX_EMF_CONVERT !== '1' && !options.force) {
    return { ok: false, error: 'emf-convert-disabled', code: 'DISABLED' }
  }
  const resolvedBinary = resolveConverterBinary(options)
  if (!resolvedBinary.ok) return resolvedBinary
  const input = assertSafeInputPath(inputPath)
  const output = assertSafeInputPath(outputPath)
  return new Promise((resolve) => {
    let child
    try {
      child = spawn(resolvedBinary.binary, [input, output], {
        shell: false,
        windowsHide: true,
        timeout: options.timeoutMs || 30_000,
        env: narrowConverterEnv(),
        // Discard stdout rather than piping it. Nothing reads it, and an undrained
        // pipe stalls a converter that reports progress there until the timeout
        // kills a conversion that would have succeeded.
        stdio: ['ignore', 'ignore', 'pipe'],
        // Cancelling an import kills the child instead of leaving one running per
        // image until its own timeout expires.
        signal: options.signal,
      })
    } catch (error) {
      // spawn validates its options synchronously. Callers await this for the
      // documented result object and do not guard it, so an escaping throw would
      // fail an entire deck over one unconvertible image.
      resolve({ ok: false, error: error.message, code: 'CONVERT_FAILED' })
      return
    }
    let settled = false
    const stderrChunks = []
    let stderrBytes = 0
    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    child.stderr?.on('data', (chunk) => {
      const room = MAX_STDERR_BYTES - stderrBytes
      if (room <= 0) return
      const slice = chunk.length > room ? chunk.subarray(0, room) : chunk
      stderrChunks.push(slice)
      stderrBytes += slice.length
    })
    // Decode once at the end: a chunk or cap boundary can fall inside a
    // multi-byte sequence, and StringDecoder withholds an incomplete trailing
    // one instead of emitting a replacement character.
    const readStderr = () =>
      new StringDecoder('utf8').write(Buffer.concat(stderrChunks, stderrBytes)).trim()
    const settleWith = (status, signal) => {
      if (status === 0) return finish({ ok: true, outPath: output })
      finish({
        // A timeout arrives as a kill signal rather than an exit code, so name
        // it instead of reporting an empty failure.
        error: signal ? `convert-killed-${signal}` : readStderr() || 'convert-failed',
        ok: false,
        code: 'CONVERT_FAILED',
      })
    }
    child.on('error', (error) => finish({ ok: false, error: error.message, code: 'CONVERT_FAILED' }))
    // Prefer 'close', which means stderr is fully drained. But 'close' waits for
    // every holder of that pipe, and a converter that leaves a grandchild behind
    // would never release it — stalling the one import slot this server allows
    // until the import-wide timeout. So 'exit' arms a short grace period and then
    // settles with whatever diagnostics arrived.
    child.on('close', settleWith)
    child.on('exit', (status, signal) => {
      const grace = setTimeout(() => settleWith(status, signal), 500)
      grace.unref?.()
    })
  })
}

module.exports = {
  ALLOWED_BINARIES,
  convertVectorImage,
  assertSafeInputPath,
  resolveConverterBinary,
  narrowConverterEnv,
}
