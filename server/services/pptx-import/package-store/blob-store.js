const crypto = require('node:crypto')
const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const { pipeline } = require('node:stream/promises')
const { Readable, Transform } = require('node:stream')
const { syncDirectory } = require('./durable-fs')
const { SCHEMA_VERSION, validateBlob } = require('./schemas')

function sourceStream(source) {
  if (Buffer.isBuffer(source)) return Readable.from(source)
  if (typeof source === 'string') return fs.createReadStream(source)
  throw new TypeError('Blob source must be a Buffer or file path')
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256')
  let byteLength = 0
  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk)
      byteLength += chunk.length
      callback(null, chunk)
    },
  })
  await pipeline(fs.createReadStream(filePath), counter, new Transform({
    transform(_chunk, _encoding, callback) {
      callback()
    },
  }))
  return { sha256: hash.digest('hex'), byteLength }
}

class BlobStore {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.blobsDir = path.join(rootDir, 'blobs')
    this.stagingDir = path.join(rootDir, 'staging')
    this.lastDirectorySync = null
  }

  async init() {
    await fsp.mkdir(this.blobsDir, { recursive: true })
    await fsp.mkdir(this.stagingDir, { recursive: true })
  }

  blobPath(sha256) {
    return path.join(this.blobsDir, `${sha256}.blob`)
  }

  async stage(source, { expectedSha256 } = {}) {
    await this.init()
    const stagePath = path.join(this.stagingDir, `${crypto.randomUUID()}.stage`)
    const hash = crypto.createHash('sha256')
    let byteLength = 0
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk)
        byteLength += chunk.length
        callback(null, chunk)
      },
    })
    await pipeline(sourceStream(source), counter, fs.createWriteStream(stagePath, { flags: 'wx' }))
    const handle = await fsp.open(stagePath, process.platform === 'win32' ? 'r+' : 'r')
    await handle.sync()
    await handle.close()
    const sha256 = hash.digest('hex')
    if (expectedSha256 && expectedSha256.toLowerCase() !== sha256) {
      await fsp.unlink(stagePath)
      throw new Error(`Blob hash mismatch: expected ${expectedSha256}, got ${sha256}`)
    }
    return { stagePath, sha256, byteLength }
  }

  async commit(staged) {
    const target = this.blobPath(staged.sha256)
    try {
      await fsp.access(target)
      const existing = await hashFile(target)
      if (existing.sha256 !== staged.sha256 || existing.byteLength !== staged.byteLength) {
        const error = new Error('Existing deduplicated blob failed integrity verification')
        error.code = 'CORRUPT_EXISTING_BLOB'
        error.stagingPreserved = true
        throw error
      }
      await fsp.unlink(staged.stagePath)
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await fsp.rename(staged.stagePath, target)
      this.lastDirectorySync = await syncDirectory(this.blobsDir)
    }
    const verified = await hashFile(target)
    if (verified.sha256 !== staged.sha256 || verified.byteLength !== staged.byteLength) {
      throw new Error('Committed blob reread verification failed')
    }
    return validateBlob({
      schemaVersion: SCHEMA_VERSION,
      sha256: staged.sha256,
      byteLength: staged.byteLength,
      committedAt: new Date().toISOString(),
    })
  }

  read(sha256) {
    return fsp.readFile(this.blobPath(sha256))
  }

  async list() {
    return (await fsp.readdir(this.blobsDir)).filter((name) => name.endsWith('.blob'))
  }
}

module.exports = { BlobStore, hashFile }
