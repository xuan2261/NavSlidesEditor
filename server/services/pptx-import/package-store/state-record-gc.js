const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { StateRecordStore } = require('./state-record-store')
const { hashRecord } = require('./schemas')
const { validatePackageStoreRoot, loadPackageStoreState } = require('./state-migrations')
const { STATE_MANIFEST_TYPE, decodeStateManifest, collectManifestReferences } = require('./state-manifest')

async function regularJson(file, signal) {
  signal?.throwIfAborted()
  const stat = await fs.lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('GC evidence must be a regular file')
  const bytes = await fs.readFile(file, { signal })
  return { bytes, value: JSON.parse(bytes.toString('utf8')) }
}

async function directoryNames(dir) {
  try {
    const stat = await fs.lstat(dir)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Invalid GC directory')
    return await fs.readdir(dir)
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

/**
 * Writer-only, offline mark/sweep. The caller MUST serialize this entire call
 * against index/root/WAL publication AND record preparation, under its writer
 * ownership. In particular, never call while a publication is active: records
 * may already exist before any index or prepared WAL references them. This
 * module installs no global mutex and is intentionally not wired into StateStore.
 * pins and activeReferences are explicit {hash, bytes} record references (not
 * authorization booleans); their contents are verified just like manifest refs.
 * Candidate .tmp files are not recovery evidence and are never swept.
 */
async function collectStateRecords(rootDir, { assertWriter, pins = [], activeReferences = [], signal } = {}) {
  if (typeof assertWriter !== 'function') throw new TypeError('GC requires assertWriter')
  if (!Array.isArray(pins) || !Array.isArray(activeReferences)) throw new TypeError('Invalid GC references')
  const fence = async () => {
    signal?.throwIfAborted()
    await assertWriter()
    signal?.throwIfAborted()
  }
  // Own options before the first await; caller aliases cannot remove pins.
  const explicit = structuredClone([...pins, ...activeReferences])
  await fence()
  rootDir = path.resolve(rootDir)
  const store = new StateRecordStore(rootDir)
  const marked = new Set()
  const markRoot = async (root, depth = 0) => {
    signal?.throwIfAborted()
    if (depth > 3) throw new Error('Unbounded GC predecessor chain')
    validatePackageStoreRoot(root)
    const file = path.join(rootDir, 'indexes', `${root.stateHash}.json`)
    const { bytes, value } = await regularJson(file, signal)
    const manifest = value?.type === STATE_MANIFEST_TYPE ||
      (value !== null && typeof value === 'object' && Object.hasOwn(value, 'stateManifestVersion'))
    const digest = manifest ? crypto.createHash('sha256').update(bytes).digest('hex') : hashRecord(value)
    if (digest !== root.stateHash) throw new Error('State index hash mismatch')
    // Decode resolves EVERY record through get, including all mutation history,
    // and validates the reconstructed state before any unlink can occur.
    const state = await decodeStateManifest(value, store, { signal })
    loadPackageStoreState(root, state)
    if (manifest) for (const hash of collectManifestReferences(value)) marked.add(hash)
    if (root.predecessor !== null && root.predecessor !== undefined) {
      await markRoot(root.predecessor, depth + 1)
    }
  }
  await markRoot((await regularJson(path.join(rootDir, 'state-root.json'), signal)).value)
  const walDir = path.join(rootDir, 'wal')
  for (const name of await directoryNames(walDir)) {
    if (name.endsWith('.prepared.json')) {
      await markRoot((await regularJson(path.join(walDir, name), signal)).value)
    }
  }
  for (const ref of explicit) {
    await store.get(ref, { signal })
    marked.add(ref.hash)
  }
  // Complete inventory before deleting anything. Only regular recognized names
  // are eligible; directories, links, candidates and unrelated files stay put.
  const candidates = []
  for (const name of await directoryNames(store.recordsDir)) {
    const match = /^([a-f0-9]{64})\.json$/.exec(name)
    if (!match || marked.has(match[1])) continue
    const file = path.join(store.recordsDir, name)
    const stat = await fs.lstat(file)
    if (stat.isFile() && !stat.isSymbolicLink()) {
      await store.get({ hash: match[1], bytes: stat.size }, { signal })
      candidates.push({ hash: match[1], file })
    }
  }
  await fence()
  const deleted = []
  for (const { hash, file } of candidates) {
    await fence()
    await fs.unlink(file)
    deleted.push(hash)
  }
  return { marked: [...marked].sort(), deleted: deleted.sort() }
}

module.exports = { collectStateRecords }
