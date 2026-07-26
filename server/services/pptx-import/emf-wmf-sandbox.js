/**
 * Sandboxed EMF/WMF conversion policy (no shell; spawnSync only when enabled).
 * Default: conversion disabled — surface as import failure in strict mode, not permanent placeholder.
 * When enabled: bare allowlisted names or absolute paths only; environment is narrow (no full process.env).
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const ALLOWED_BINARIES = new Set(['magick', 'convert', 'inkscape'])

function assertSafeInputPath(filePath) {
  const resolved = path.resolve(filePath)
  if (resolved.includes('\0')) throw new Error('Invalid path')
  return resolved
}

function resolveConverterBinary(options = {}) {
  const binary = options.binary || process.env.PPTX_EMF_BINARY || 'magick'
  if (path.isAbsolute(binary)) {
    const base = path.basename(binary).replace(/\.exe$/i, '')
    if (!ALLOWED_BINARIES.has(base)) {
      return { ok: false, error: 'binary-not-allowlisted', code: 'POLICY' }
    }
    return { ok: true, binary }
  }
  if (!ALLOWED_BINARIES.has(binary)) {
    return { ok: false, error: 'binary-not-allowlisted', code: 'POLICY' }
  }
  return { ok: true, binary }
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

/**
 * Convert EMF/WMF → PNG via allowlisted binary. Never uses shell:true.
 * @returns {{ ok: boolean, outPath?: string, error?: string, code?: string }}
 */
function convertVectorImage(inputPath, outputPath, options = {}) {
  if (process.env.PPTX_EMF_CONVERT !== '1' && !options.force) {
    return { ok: false, error: 'emf-convert-disabled', code: 'DISABLED' }
  }
  const resolvedBinary = resolveConverterBinary(options)
  if (!resolvedBinary.ok) return resolvedBinary
  const input = assertSafeInputPath(inputPath)
  const output = assertSafeInputPath(outputPath)
  const args = [input, output]
  const result = spawnSync(resolvedBinary.binary, args, {
    shell: false,
    windowsHide: true,
    timeout: options.timeoutMs || 30_000,
    env: narrowConverterEnv(),
  })
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      error: result.error?.message || result.stderr?.toString() || 'convert-failed',
      code: 'CONVERT_FAILED',
    }
  }
  return { ok: true, outPath: output }
}

module.exports = {
  ALLOWED_BINARIES,
  convertVectorImage,
  assertSafeInputPath,
  resolveConverterBinary,
  narrowConverterEnv,
}
