const path = require('node:path')
const { openPackageStore } = require('./package-store')
const { DATA_DIR, withPresentations } = require('../storage')
const {
  acknowledgeCompatibilityOutbox,
  snapshotCompatibilityOutbox,
} = require('./compatibility-outbox')
const { applyCompatibilityWrites, hasExactCompatibilityHead } = require('./compatibility-view')
const { hashRecord } = require('./package-store/schemas')

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
    if (activeRoot !== resolvedRoot)
      throw new Error('Package store is already initialized elsewhere')
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
      return store
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
      await store.reload()
    } catch (reloadError) {
      error.packageStoreReloadError = reloadError
    }
    throw error
  } finally {
    release()
  }
}

function isCapturedWriteCurrent(store, write) {
  const state = store.getCompatibilityState()
  const queued = state.compatibilityOutbox.find((record) => record.id === write.id)
  if (!queued || hashRecord(queued) !== hashRecord(write)) return false
  const head = state.heads.find((item) => item.presentationId === write.presentationId)
  if (write.operation === 'remove') return !head
  return hasExactCompatibilityHead(write.presentation, head)
}

async function withCompatibilityDrain(action) {
  if (typeof action !== 'function') throw new TypeError('Compatibility drain action is required')
  const previous = compatibilityDrainTail
  let release
  compatibilityDrainTail = new Promise((resolve) => {
    release = resolve
  })
  await previous
  try {
    return await action()
  } finally {
    release()
  }
}

/** Isolate poisoned writes without acquiring package serialization under JSON locks. */
async function drainPackageCompatibilityOutbox({ signal } = {}) {
  return withCompatibilityDrain(async () => {
    signal?.throwIfAborted()
    const writes = await withPackageStore((store) => {
      signal?.throwIfAborted()
      return snapshotCompatibilityOutbox(store)
    })
    if (!writes.length) return 0

    const applied = []
    const obsolete = []
    const poisoned = []
    const candidateWrites = []
    for (const write of writes) {
      if (isCapturedWriteCurrent(getPackageStore(), write)) {
        candidateWrites.push(write)
      } else {
        obsolete.push(write)
      }
    }
    if (candidateWrites.length === 1) {
      const write = candidateWrites[0]
      signal?.throwIfAborted()
      try {
        const didApply = await withPresentations(
          (presentations) => {
            signal?.throwIfAborted()
            if (!isCapturedWriteCurrent(getPackageStore(), write)) return false
            applyCompatibilityWrites(presentations, [write])
            return true
          },
          { signal }
        )
        if (didApply) applied.push(write)
        else obsolete.push(write)
      } catch (error) {
        if (signal?.aborted) throw error
        poisoned.push({
          write: structuredClone(write),
          id: write?.id,
          presentationId: write?.presentationId,
          code: error?.code || 'COMPATIBILITY_APPLY_FAILED',
          message: String(error?.message || error).slice(0, 240),
          deadLetteredAt: new Date().toISOString(),
        })
      }
    } else if (candidateWrites.length > 1) {
      signal?.throwIfAborted()
      try {
        await withPresentations(
          (presentations) => {
            signal?.throwIfAborted()
            const stillCurrent = candidateWrites.filter((w) => isCapturedWriteCurrent(getPackageStore(), w))
            applyCompatibilityWrites(presentations, stillCurrent)
            return true
          },
          { signal }
        )
        for (const write of candidateWrites) {
          if (isCapturedWriteCurrent(getPackageStore(), write)) applied.push(write)
          else obsolete.push(write)
        }
      } catch (error) {
        if (signal?.aborted) throw error
        for (const write of candidateWrites) {
          try {
            const didApply = await withPresentations(
              (presentations) => {
                if (!isCapturedWriteCurrent(getPackageStore(), write)) return false
                applyCompatibilityWrites(presentations, [write])
                return true
              },
              { signal }
            )
            if (didApply) applied.push(write)
            else obsolete.push(write)
          } catch (innerError) {
            poisoned.push({
              write: structuredClone(write),
              id: write?.id,
              presentationId: write?.presentationId,
              code: innerError?.code || 'COMPATIBILITY_APPLY_FAILED',
              message: String(innerError?.message || innerError).slice(0, 240),
              deadLetteredAt: new Date().toISOString(),
            })
          }
        }
      }
    }

    if (applied.length || obsolete.length) {
      await withPackageStore((store) => {
        signal?.throwIfAborted()
        return acknowledgeCompatibilityOutbox(store, [...applied, ...obsolete], { signal })
      })
    }
    if (poisoned.length) {
      await withPackageStore(async (store) => {
        signal?.throwIfAborted()
        await store.mutate(
          (next) => {
            if (!Array.isArray(next.compatibilityDeadLetter)) next.compatibilityDeadLetter = []
            for (const item of poisoned) {
              if (next.compatibilityDeadLetter.some((entry) => entry.id === item.id)) continue
              next.compatibilityDeadLetter.push(item)
            }
            // Remove poisoned writes from active outbox so startup is not permanently blocked.
            const poisonedIds = new Set(poisoned.map((item) => item.id).filter(Boolean))
            next.compatibilityOutbox = (next.compatibilityOutbox || []).filter(
              (record) => !poisonedIds.has(record.id)
            )
          },
          { signal }
        )
      })
    }
    return applied.length
  })
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
  withCompatibilityDrain,
}
