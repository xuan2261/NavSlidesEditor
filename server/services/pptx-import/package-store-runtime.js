const path = require('node:path')
const { openPackageStore } = require('./package-store')
const { DATA_DIR, withPresentations } = require('../storage')
const {
  acknowledgeCompatibilityOutbox,
  snapshotCompatibilityOutbox,
} = require('./compatibility-outbox')
const { applyCompatibilityWrites } = require('./compatibility-view')

let activeStore = null
let activeRoot = null
let initialization = null
let mutationTail = Promise.resolve()
let compatibilityDrainTail = Promise.resolve()
let shuttingDown = false

function unavailableError() {
  const error = new Error('Package store has not been initialized')
  error.code = 'PACKAGE_STORE_UNAVAILABLE'
  return error
}

async function initializePackageStore({ rootDir }) {
  if (shuttingDown) throw new Error('Package store is shutting down')
  const resolvedRoot = path.resolve(rootDir)
  if (activeStore) {
    if (activeRoot !== resolvedRoot) throw new Error('Package store is already initialized elsewhere')
    return activeStore
  }
  if (initialization) {
    if (activeRoot && activeRoot !== resolvedRoot) {
      throw new Error('Package store is already initializing elsewhere')
    }
    return initialization
  }

  activeRoot = resolvedRoot
  initialization = openPackageStore({ rootDir: resolvedRoot })
    .then(async (store) => {
      await store.acquireWriter()
      activeStore = store
      try {
        await drainPackageCompatibilityOutbox()
        return store
      } catch (error) {
        activeStore = null
        await store.releaseWriter().catch(() => {})
        throw error
      }
    })
    .catch((error) => {
      activeRoot = null
      throw error
    })
    .finally(() => {
      initialization = null
    })
  return initialization
}

function getPackageStore() {
  if (!activeStore) throw unavailableError()
  return activeStore
}

async function getReadablePackageStore() {
  if (activeStore) return activeStore
  if (process.env.NODE_ENV === 'test') {
    return openPackageStore({ rootDir: path.resolve(DATA_DIR) })
  }
  throw unavailableError()
}

async function withPackageStore(action) {
  if (typeof action !== 'function') throw new TypeError('Package store action is required')
  if (shuttingDown) throw new Error('Package store is shutting down')
  if (!activeStore && process.env.NODE_ENV === 'test') {
    const store = await openPackageStore({ rootDir: path.resolve(DATA_DIR) })
    await store.acquireWriter()
    try {
      return await action(store)
    } finally {
      await store.releaseWriter()
    }
  }
  const store = getPackageStore()
  const previous = mutationTail
  let release
  mutationTail = new Promise((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await action(store)
  } catch (error) {
    try {
      await store.metadata.reload()
    } catch (reloadError) {
      error.packageStoreReloadError = reloadError
    }
    throw error
  } finally {
    release()
  }
}

async function drainPackageCompatibilityOutbox() {
  const previous = compatibilityDrainTail
  let release
  compatibilityDrainTail = new Promise((resolve) => { release = resolve })
  await previous
  try {
    const writes = await withPackageStore((store) => snapshotCompatibilityOutbox(store))
    if (!writes.length) return 0

    await withPresentations((presentations) => {
      applyCompatibilityWrites(presentations, writes)
    })

    await withPackageStore((store) => acknowledgeCompatibilityOutbox(store, writes))
    return writes.length
  } finally {
    release()
  }
}

async function shutdownPackageStore() {
  shuttingDown = true
  try {
    if (initialization) await initialization
    await mutationTail
    await compatibilityDrainTail
    const store = activeStore
    activeStore = null
    activeRoot = null
    mutationTail = Promise.resolve()
    compatibilityDrainTail = Promise.resolve()
    if (store) await store.releaseWriter()
  } finally {
    activeStore = null
    activeRoot = null
    mutationTail = Promise.resolve()
    compatibilityDrainTail = Promise.resolve()
    shuttingDown = false
  }
}

module.exports = {
  drainPackageCompatibilityOutbox,
  getPackageStore,
  getReadablePackageStore,
  initializePackageStore,
  shutdownPackageStore,
  withPackageStore,
}
