const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { hashRecord, validateState } = require('./schemas')
const { validatePackageStoreRoot, loadPackageStoreState } = require('./state-migrations')
const { decodeStateManifest, STATE_MANIFEST_TYPE } = require('./state-manifest')
const { StateRecordStore } = require('./state-record-store')

// One authority check for recovery and post-publication compensation. Legacy
// indexes keep their historical parsed/canonical hash; manifests bind exact bytes.
async function loadStateIndex(rootDir, root, { recordStore = new StateRecordStore(rootDir), highWater = null, signal } = {}) {
  signal?.throwIfAborted()
  validatePackageStoreRoot(root)
  const bytes = await fs.readFile(path.join(rootDir, 'indexes', `${root.stateHash}.json`), { signal })
  const index = JSON.parse(bytes.toString('utf8'))
  const manifest = index?.type === STATE_MANIFEST_TYPE || Object.hasOwn(index || {}, 'stateManifestVersion')
  const digest = manifest ? crypto.createHash('sha256').update(bytes).digest('hex') : hashRecord(index)
  if (digest !== root.stateHash) throw new Error('State index hash mismatch')
  const resolved = await decodeStateManifest(index, recordStore, { signal })
  if (resolved?.generation !== root.storeGeneration || resolved?.fencingEpoch !== root.fencingEpoch) {
    throw new Error('State index generation/fencing ownership mismatch')
  }
  const loaded = loadPackageStoreState(root, resolved, { highWater })
  validateState(loaded.state)
  signal?.throwIfAborted()
  return loaded
}

module.exports = { loadStateIndex }
