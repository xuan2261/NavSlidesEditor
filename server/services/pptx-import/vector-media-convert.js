/**
 * EMF/WMF → browser-safe PNG conversion (Phase 07).
 * Uses sandboxed execFile allowlist; injectable convertFn for tests.
 */
const fs = require('fs-extra')
const path = require('node:path')
const os = require('node:os')
const crypto = require('node:crypto')
const { convertVectorImage } = require('./emf-wmf-sandbox')
const { persistImageBuffer } = require('./media')

function defaultConvert(inputPath, outputPath, options = {}) {
  return convertVectorImage(inputPath, outputPath, {
    force: options.force === true || process.env.PPTX_EMF_CONVERT === '1',
    binary: options.binary,
    timeoutMs: options.timeoutMs,
  })
}

/**
 * Convert EMF/WMF buffer to PNG buffer.
 * @returns {Promise<{ ok: boolean, buffer?: Buffer, mime?: string, error?: string, code?: string }>}
 */
async function convertEmfWmfBuffer(sourceBuffer, options = {}) {
  if (!Buffer.isBuffer(sourceBuffer) || sourceBuffer.length === 0) {
    return { ok: false, error: 'empty-buffer', code: 'INVALID' }
  }
  const convertFn = options.convertFn || defaultConvert
  const tmpRoot = options.tmpDir || path.join(os.tmpdir(), 'pptx-emf-convert')
  await fs.ensureDir(tmpRoot)
  const id = crypto.randomUUID()
  const inPath = path.join(tmpRoot, `${id}.emf`)
  const outPath = path.join(tmpRoot, `${id}.png`)
  await fs.writeFile(inPath, sourceBuffer)
  try {
    const result = convertFn(inPath, outPath, options)
    if (!result?.ok) {
      return {
        ok: false,
        error: result?.error || 'convert-failed',
        code: result?.code || 'CONVERT_FAILED',
      }
    }
    if (!(await fs.pathExists(outPath))) {
      return { ok: false, error: 'output-missing', code: 'CONVERT_FAILED' }
    }
    const buffer = await fs.readFile(outPath)
    if (!buffer.length) return { ok: false, error: 'empty-output', code: 'CONVERT_FAILED' }
    return { ok: true, buffer, mime: 'image/png' }
  } finally {
    await fs.unlink(inPath).catch(() => {})
    await fs.unlink(outPath).catch(() => {})
  }
}

/**
 * Convert + persist as /uploads PNG for import pipeline.
 */
async function convertAndPersistVectorImage(sourceBuffer, uploadsDir, options = {}) {
  const converted = await convertEmfWmfBuffer(sourceBuffer, options)
  if (!converted.ok) return { url: null, warning: { code: converted.code || 'emf-convert-failed', message: converted.error } }
  const persisted = await persistImageBuffer(converted.buffer, 'image/png', uploadsDir, {
    signal: options.signal,
  })
  if (!persisted.url) {
    return { url: null, warning: persisted.warning || { code: 'emf-persist-failed' } }
  }
  return {
    url: persisted.url,
    warning: { code: 'emf-converted-to-png', source: 'emf-wmf' },
    converted: true,
  }
}

module.exports = {
  convertEmfWmfBuffer,
  convertAndPersistVectorImage,
  defaultConvert,
}
