/**
 * Phase 07: sandboxed EMF/WMF conversion policy (no shell; execFile only when enabled).
 * Default: conversion disabled — surface as import failure in strict mode, not permanent placeholder.
 */
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const ALLOWED_BINARIES = new Set(['magick', 'convert', 'inkscape'])

function assertSafeInputPath(filePath) {
  const resolved = path.resolve(filePath)
  if (resolved.includes('\0')) throw new Error('Invalid path')
  return resolved
}

/**
 * Convert EMF/WMF → PNG via allowlisted binary. Never uses shell:true.
 * @returns {{ ok: boolean, outPath?: string, error?: string, code?: string }}
 */
function convertVectorImage(inputPath, outputPath, options = {}) {
  if (process.env.PPTX_EMF_CONVERT !== '1' && !options.force) {
    return { ok: false, error: 'emf-convert-disabled', code: 'DISABLED' }
  }
  const binary = options.binary || process.env.PPTX_EMF_BINARY || 'magick'
  if (!ALLOWED_BINARIES.has(binary)) {
    return { ok: false, error: 'binary-not-allowlisted', code: 'POLICY' }
  }
  const input = assertSafeInputPath(inputPath)
  const output = assertSafeInputPath(outputPath)
  const args = binary === 'magick' ? [input, output] : [input, output]
  const result = spawnSync(binary, args, {
    shell: false,
    windowsHide: true,
    timeout: options.timeoutMs || 30_000,
    env: { ...process.env, PATH: process.env.PATH },
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
}
