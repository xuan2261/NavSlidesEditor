const DB_NAME = 'navslides-editor-drafts'
const STORE_NAME = 'drafts'
const DB_VERSION = 1
const LOCAL_PREFIX = 'navslides-editor-draft:'

export function editorDraftKey(id, isTemplate = false) {
  return `${isTemplate ? 'template' : 'presentation'}:${id || ''}`
}

function localKey(key) {
  return `${LOCAL_PREFIX}${key}`
}

function readLocal(key) {
  try {
    const value = localStorage.getItem(localKey(key))
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function writeLocal(record) {
  try {
    localStorage.setItem(localKey(record.key), JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

function draftTime(record) {
  const time = Date.parse(record?.updatedAt || '')
  return Number.isFinite(time) ? time : 0
}

function draftAttempt(record) {
  const attempt = Number(record?.attemptId)
  if (Number.isSafeInteger(attempt)) return attempt
  const match = String(record?.draftId || '').match(/:(\d+)$/)
  return match ? Number(match[1]) : 0
}

function compareDrafts(left, right) {
  const timeDifference = draftTime(left) - draftTime(right)
  if (timeDifference) return timeDifference
  const attemptDifference = draftAttempt(left) - draftAttempt(right)
  if (attemptDifference) return attemptDifference
  return String(left?.draftId || '').localeCompare(String(right?.draftId || ''))
}

function matchesIdentity(current, identity) {
  if (!current || !identity) return true
  if (typeof identity === 'string') return current.idempotencyKey === identity
  if (identity.draftId && current.draftId && current.draftId !== identity.draftId) return false
  if (identity.idempotencyKey && current.idempotencyKey !== identity.idempotencyKey) return false
  if (
    !identity.idempotencyKey &&
    identity.attemptId !== undefined &&
    current.attemptId !== identity.attemptId
  ) return false
  return true
}

function canClear(current, identity) {
  if (matchesIdentity(current, identity)) return true
  return Boolean(
    identity && typeof identity === 'object' && identity.updatedAt &&
    compareDrafts(current, identity) <= 0
  )
}

function removeLocal(key, identity) {
  try {
    const current = readLocal(key)
    if (!canClear(current, identity)) return false
    localStorage.removeItem(localKey(key))
    return Boolean(current)
  } catch {
    return false
  }
}

function removeLocalIfOlder(record) {
  try {
    const current = readLocal(record.key)
    if (current && compareDrafts(current, record) < 0) {
      localStorage.removeItem(localKey(record.key))
    }
  } catch {
    // The IndexedDB copy remains available when localStorage is unavailable.
  }
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('Unable to open draft storage'))
  })
}

function runTransaction(mode, operation) {
  return openDatabase().then((database) => {
    if (!database) return null
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const store = transaction.objectStore(STORE_NAME)
      let request
      try {
        request = operation(store)
      } catch (error) {
        reject(error)
        return
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Draft storage request failed'))
      transaction.onerror = () => reject(transaction.error || new Error('Draft storage transaction failed'))
    }).finally(() => database.close())
  })
}

function removeIndexedDbIfAllowed(key, identity) {
  return openDatabase().then((database) => {
    if (!database) return false
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      let removed = false
      const request = store.get(key)
      request.onsuccess = () => {
        const current = request.result
        if (canClear(current, identity)) {
          removed = Boolean(current)
          store.delete(key)
        }
      }
      request.onerror = () => reject(request.error || new Error('Draft storage request failed'))
      transaction.oncomplete = () => resolve(removed)
      transaction.onerror = () => reject(transaction.error || new Error('Draft storage transaction failed'))
      transaction.onabort = () => reject(transaction.error || new Error('Draft storage transaction aborted'))
    }).finally(() => database.close())
  })
}

function removeOlderIndexedDb(record) {
  return openDatabase().then((database) => {
    if (!database) return false
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      let removed = false
      const request = store.get(record.key)
      request.onsuccess = () => {
        const current = request.result
        if (current && compareDrafts(current, record) <= 0) {
          removed = true
          store.delete(record.key)
        }
      }
      request.onerror = () => reject(request.error || new Error('Draft storage request failed'))
      transaction.oncomplete = () => resolve(removed)
      transaction.onerror = () => reject(transaction.error || new Error('Draft storage transaction failed'))
      transaction.onabort = () => reject(transaction.error || new Error('Draft storage transaction aborted'))
    }).finally(() => database.close())
  })
}

let writeChain = Promise.resolve()

export function writeEditorDraft(record) {
  if (!record?.key || !record.snapshot?.id) return Promise.resolve(false)
  const localWritten = writeLocal(record)
  writeChain = writeChain.then(async () => {
    if (localWritten) {
      try {
        await removeOlderIndexedDb(record)
      } catch {
        // localStorage is still the newest readable copy.
      }
      return true
    }
    try {
      await runTransaction('readwrite', (store) => store.put(record))
      removeLocalIfOlder(record)
      return true
    } catch {
      return false
    }
  })
  return writeChain
}

export async function readEditorDraft(id, isTemplate = false) {
  const key = editorDraftKey(id, isTemplate)
  const local = readLocal(key)
  let indexed = null
  try {
    indexed = await runTransaction('readonly', (store) => store.get(key))
  } catch {
    indexed = null
  }
  if (!local) {
    if (indexed) removeLocalIfOlder(indexed)
    return indexed
  }
  if (!indexed || compareDrafts(local, indexed) >= 0) return local
  removeLocalIfOlder(indexed)
  return indexed
}

export function clearEditorDraft(id, isTemplate = false, identity) {
  const key = editorDraftKey(id, isTemplate)
  const removedLocal = removeLocal(key, identity)
  writeChain = writeChain.then(async () => {
    try {
      const removedIndexed = await removeIndexedDbIfAllowed(key, identity)
      return removedIndexed || removedLocal
    } catch {
      return removedLocal
    }
  })
  return writeChain
}

export function createEditorDraft({ snapshot, isTemplate, attemptId, draftId }) {
  return {
    key: editorDraftKey(snapshot?.id, isTemplate),
    id: snapshot?.id,
    isTemplate: Boolean(isTemplate),
    snapshot,
    idempotencyKey: snapshot?.idempotencyKey || null,
    aggregateGeneration: Number.isSafeInteger(snapshot?.aggregateGeneration)
      ? snapshot.aggregateGeneration
      : null,
    attemptId,
    ...(draftId ? { draftId } : {}),
    updatedAt: new Date().toISOString(),
  }
}
