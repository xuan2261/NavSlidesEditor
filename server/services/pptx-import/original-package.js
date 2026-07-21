const crypto = require('node:crypto')
const path = require('node:path')
const fs = require('fs-extra')
const { DATA_DIR } = require('../storage')
const { MAX_FILE_BYTES } = require('./constants')
const { PptxImportError } = require('./diagnostics')

const ORIGINALS_SUBDIR = 'pptx-originals'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getOriginalsDir(baseDir = DATA_DIR) {
  return path.join(baseDir, ORIGINALS_SUBDIR)
}

function assertSafeOriginalId(id) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new PptxImportError('Invalid original package id', { status: 400, type: 'import-failed' })
  }
}

/**
 * Resolve stored path under originals dir; realpath jail blocks traversal.
 * @returns {Promise<string>} absolute path to {id}.pptx
 */
async function resolveOriginalPath(id, { baseDir = DATA_DIR, ensureDir = false } = {}) {
  assertSafeOriginalId(id)
  const originalsDir = path.resolve(getOriginalsDir(baseDir))
  if (ensureDir) await fs.ensureDir(originalsDir)
  const candidate = path.resolve(originalsDir, `${id}.pptx`)
  const rel = path.relative(originalsDir, candidate)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new PptxImportError('Original package path escape rejected', { status: 400, type: 'import-failed' })
  }
  return candidate
}

async function pathExistsStrict(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function verifySha256(buf, expectedHex) {
  const actual = sha256Buffer(buf)
  if (typeof expectedHex !== 'string' || actual !== expectedHex.toLowerCase()) {
    return { ok: false, actual, expected: expectedHex }
  }
  return { ok: true, actual, expected: expectedHex }
}

async function readSourceBuffer(source) {
  if (Buffer.isBuffer(source)) return source
  if (typeof source === 'string') return fs.readFile(source)
  throw new PptxImportError('Original package source must be a Buffer or file path', {
    status: 400,
    type: 'import-failed',
  })
}

/**
 * Persist original .pptx bytes under server/data/pptx-originals/{uuid}.pptx
 * @param {Buffer|string} source - buffer or absolute path to temp upload
 * @param {{ baseDir?: string, id?: string, maxBytes?: number }} [options]
 * @returns {Promise<{ id: string, sha256: string, byteLength: number, uploadedAt: string, filePath: string }>}
 */
async function persistOriginalPptx(source, options = {}) {
  const baseDir = options.baseDir || DATA_DIR
  const maxBytes = options.maxBytes ?? MAX_FILE_BYTES
  const id = options.id || crypto.randomUUID()
  assertSafeOriginalId(id)

  const buffer = await readSourceBuffer(source)
  if (buffer.byteLength > maxBytes) {
    const err = new PptxImportError('Original package exceeds size limit', {
      status: 413,
      type: 'parse-failed',
    })
    err.code = 'LIMIT_FILE_SIZE'
    throw err
  }

  const filePath = await resolveOriginalPath(id, { baseDir, ensureDir: true })
  const sha256 = sha256Buffer(buffer)
  await fs.writeFile(filePath, buffer)
  return {
    id,
    sha256,
    byteLength: buffer.byteLength,
    uploadedAt: new Date().toISOString(),
    filePath,
  }
}

async function deleteOriginalPptx(id, { baseDir = DATA_DIR, strict = false } = {}) {
  if (!id) return false
  try {
    assertSafeOriginalId(id)
  } catch (error) {
    if (strict) throw error
    return false
  }
  const filePath = await resolveOriginalPath(id, { baseDir })
  const existed = await pathExistsStrict(filePath)
  if (existed) {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      if (strict) throw error
    }
  }
  return existed
}

async function readOriginalPptx(id, { baseDir = DATA_DIR } = {}) {
  const filePath = await resolveOriginalPath(id, { baseDir })
  if (!(await pathExistsStrict(filePath))) return null
  return fs.readFile(filePath)
}

function toPptxOriginalMeta(artifact) {
  return {
    id: artifact.id,
    sha256: artifact.sha256,
    byteLength: artifact.byteLength,
    uploadedAt: artifact.uploadedAt,
  }
}

async function migrateLegacyOriginal(meta, owner, { baseDir = DATA_DIR } = {}) {
  const { openPackageStore } = require('./package-store')
  const { withPackageStore } = require('./package-store-runtime')
  if (path.resolve(baseDir) === path.resolve(DATA_DIR)) {
    return withPackageStore((store) => store.migrateLegacyOriginal(meta, owner))
  }
  const store = await openPackageStore({ rootDir: path.resolve(baseDir) })
  await store.acquireWriter()
  try {
    return await store.migrateLegacyOriginal(meta, owner)
  } finally {
    await store.releaseWriter()
  }
}

module.exports = {
  ORIGINALS_SUBDIR,
  getOriginalsDir,
  resolveOriginalPath,
  sha256Buffer,
  verifySha256,
  persistOriginalPptx,
  deleteOriginalPptx,
  readOriginalPptx,
  toPptxOriginalMeta,
  assertSafeOriginalId,
  migrateLegacyOriginal,
}
