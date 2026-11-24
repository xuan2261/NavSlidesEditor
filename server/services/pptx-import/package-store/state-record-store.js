const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { types } = require('node:util')
const { canonicalJson, sealCanonicalData, isSealedCanonicalData, emitCanonicalChunks } = require('./canonical-json')
const { writeHashedCandidate, validateExistingCandidate, syncFile, syncDirectory } = require('./durable-fs')

const HASH = /^[a-f0-9]{64}$/
const NAME = /^([a-f0-9]{64})\.json$/

// Descriptor-only detached projection: historical canonical JSON omitted own
// undefined object fields, but never normalized array slots to null. Do not use
// structuredClone here: it invokes getters and can erase non-plain prototypes.
function canonicalProjection(value, active = new Set()) {
  if (!value || typeof value !== 'object') {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))) return value
    throw new TypeError('State record must be plain JSON data')
  }
  if (isSealedCanonicalData(value)) return value
  if (types.isProxy(value) || active.has(value)) throw new TypeError('State record must be plain JSON data')
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('State record must be plain JSON data')
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (array && keys.length !== descriptors.length.value + 1) throw new TypeError('State record must be plain JSON data')
  const result = array ? [] : Object.create(null)
  active.add(value)
  try {
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = descriptors[key]
      if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
          (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= descriptors.length.value))) {
        throw new TypeError('State record must be plain JSON data')
      }
      if (!array && descriptor.value === undefined) continue
      Object.defineProperty(result, key, { value: canonicalProjection(descriptor.value, active),
        enumerable: true, writable: true, configurable: true })
    }
    return result
  } finally { active.delete(value) }
}

// Internal state data only: no media blobs, manifest publication, or GC authority.
// Admission budgets remain the caller's existing state budgets (no smaller cap).
class StateRecordStore {
  #receipts = new WeakMap()
  constructor(rootDir) {
    Object.defineProperties(this, {
      rootDir: { value: path.resolve(rootDir), enumerable: true },
      recordsDir: { value: path.join(path.resolve(rootDir), 'state-records'), enumerable: true },
    })
  }

  async directory(create = false) {
    if (create) await fs.mkdir(this.recordsDir, { recursive: true })
    const stat = await fs.lstat(this.recordsDir)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid state records directory')
  }

  recordPath(ref) {
    if (!ref || typeof ref.hash !== 'string' || !HASH.test(ref.hash) ||
        !Number.isSafeInteger(ref.bytes) || ref.bytes < 0) {
      throw new TypeError('Invalid state record reference')
    }
    return path.join(this.recordsDir, `${ref.hash}.json`)
  }

  async regular(file) {
    const stat = await fs.lstat(file)
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('State record is not a regular file')
    return stat
  }

  // Snapshot before the first await. Only an already-proven immutable caller
  // root may own a receipt; cloning/sealing must never freeze caller aliases.
  async put(value, { signal, assertWriter } = {}) {
    signal?.throwIfAborted()
    const proven = value && typeof value === 'object' && isSealedCanonicalData(value)
    const receipt = proven && this.#receipts.get(value)
    let chunks
    if (!receipt) {
      const owned = proven ? value : canonicalProjection(value)
      if (!sealCanonicalData(owned)) throw new TypeError('State record must be plain JSON data')
      if (owned && typeof owned === 'object') {
        const stream = emitCanonicalChunks(owned)
        const first = stream.next() // dispatch proof before asynchronous I/O
        chunks = (function* () { if (!first.done) yield first.value; yield* stream })()
      } else {
        chunks = [canonicalJson(owned)]
      }
    }
    if (typeof assertWriter !== 'function') throw new TypeError('State record write requires assertWriter')
    await assertWriter()
    signal?.throwIfAborted()
    await this.directory(true)
    if (receipt) {
      await this.#verifyReferenceBytes(receipt, signal) // receipts never hide disk corruption
      await syncFile(this.recordPath(receipt))
      await syncDirectory(this.recordsDir)
      await syncDirectory(this.rootDir)
      signal?.throwIfAborted()
      await assertWriter()
      signal?.throwIfAborted()
      return receipt
    }
    const candidate = path.join(this.recordsDir, `.candidate-${crypto.randomUUID()}.tmp`)
    let ownsCandidate = false
    try {
      const hash = await writeHashedCandidate(candidate, chunks, {
        signal, onOwned: () => { ownsCandidate = true },
      })
      const ref = Object.freeze({ hash, bytes: (await fs.stat(candidate)).size })
      const target = this.recordPath(ref)
      await assertWriter()
      signal?.throwIfAborted()
      // Hard-link publication is atomic and never replaces an existing name.
      try {
        await fs.link(candidate, target)
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
      await this.regular(target)
      if (!await validateExistingCandidate(target, candidate, hash, { signal })) {
        throw new Error('State record disappeared during verification')
      }
      await syncFile(target)
      await syncDirectory(this.recordsDir)
      await syncDirectory(this.rootDir)
      signal?.throwIfAborted()
      await assertWriter()
      signal?.throwIfAborted()
      if (proven) this.#receipts.set(value, ref)
      return ref
    } finally {
      if (ownsCandidate) await fs.rm(candidate, { force: true })
    }
  }

  // Receipt reuse needs the complete on-disk byte proof, not a parsed copy of
  // the already-sealed value. Keep memory bounded even for historical records.
  async #verifyReferenceBytes(ref, signal) {
    signal?.throwIfAborted()
    const file = this.recordPath(ref)
    await this.directory()
    const stat = await this.regular(file)
    if (stat.size !== ref.bytes) throw new Error('State record byte count mismatch')
    const handle = await fs.open(file, 'r')
    try {
      const opened = await handle.stat()
      if (!opened.isFile()) throw new Error('State record is not a regular file')
      if (opened.size !== ref.bytes) throw new Error('State record byte count mismatch')
      const buffer = Buffer.allocUnsafe(64 * 1024)
      const hash = crypto.createHash('sha256')
      let bytes = 0
      while (true) {
        signal?.throwIfAborted()
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, null)
        signal?.throwIfAborted()
        if (!bytesRead) break
        bytes += bytesRead
        hash.update(buffer.subarray(0, bytesRead))
      }
      if (bytes !== ref.bytes || hash.digest('hex') !== ref.hash) {
        throw new Error('State record hash/byte count mismatch')
      }
    } finally {
      await handle.close()
    }
  }

  // Always read/verify/parse anew: callers never share a mutable cached identity.
  async get(ref, { signal } = {}) {
    signal?.throwIfAborted()
    const file = this.recordPath(ref)
    await this.directory()
    const stat = await this.regular(file)
    if (stat.size !== ref.bytes) throw new Error('State record byte count mismatch')
    const data = await fs.readFile(file, { signal })
    signal?.throwIfAborted()
    if (data.length !== ref.bytes || crypto.createHash('sha256').update(data).digest('hex') !== ref.hash) {
      throw new Error('State record hash/byte count mismatch')
    }
    return JSON.parse(data.toString('utf8'))
  }

  // Inventory only. Reachability and deletion require a separate future design.
  async listRecords() {
    try {
      await this.directory()
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
    const hashes = []
    for (const name of await fs.readdir(this.recordsDir)) {
      const match = NAME.exec(name)
      if (!match) continue // crash candidates are not records
      await this.regular(path.join(this.recordsDir, name))
      hashes.push(match[1])
    }
    return hashes.sort()
  }
}

module.exports = { StateRecordStore, canonicalProjection }
