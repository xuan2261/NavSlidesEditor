import {
  captureOwnedDraft, capturedDraftBytes, compactDraft, checkpointNeeded, checkpointRecord,
  acceptCheckpoint, expandDraft, draftMetadata, fullDraftEnvelope,
} from './editor-draft-semantic-envelope'

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

function writeLocal(record, encoded) {
  try {
    const current = readLocal(record.key)
    if (current && compareDrafts(current, record) > 0) return false
    localStorage.setItem(localKey(record.key), encoded ?? JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

function draftTime(record) {
  record = draftMetadata(record)
  const time = Date.parse(record?.updatedAt || '')
  return Number.isFinite(time) ? time : 0
}

function draftAttempt(record) {
  record = draftMetadata(record)
  const attempt = Number(record?.attemptId)
  if (Number.isSafeInteger(attempt)) return attempt
  const match = String(record?.draftId || '').match(/:(\d+)$/)
  return match ? Number(match[1]) : 0
}

function compareDrafts(left, right) {
  left = draftMetadata(left)
  right = draftMetadata(right)
  const timeDifference = draftTime(left) - draftTime(right)
  if (timeDifference) return timeDifference
  const attemptDifference = draftAttempt(left) - draftAttempt(right)
  if (attemptDifference) return attemptDifference
  return String(left?.draftId || '').localeCompare(String(right?.draftId || ''))
}

function matchesIdentity(current, identity) {
  current = draftMetadata(current)
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
  if (current && identity && typeof identity === 'object' &&
      (identity.attemptId !== undefined || /:\d+$/.test(identity.draftId || '')) &&
      draftAttempt(current) > draftAttempt(identity)) return false
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
    let failed = false
    request.onblocked = () => {
      failed = true
      reject(new Error('Draft storage open blocked'))
    }
    request.onupgradeneeded = () => {
      // An open request cannot be cancelled while blocked. If it resumes after
      // rejection, abort the upgrade and close any eventual connection.
      if (failed) { request.transaction?.abort(); return }
      request.result.createObjectStore(STORE_NAME, { keyPath: 'key' })
    }
    request.onsuccess = () => {
      if (failed) request.result.close()
      else resolve(request.result)
    }
    request.onerror = () => {
      failed = true
      reject(request.error || new Error('Unable to open draft storage'))
    }
  })
}

function runTransaction(mode, operation) {
  return openDatabase().then((database) => {
    if (!database) {
      if (mode === 'readwrite') throw new Error('Draft storage unavailable')
      return null
    }
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
      // Request success does not imply commit: the transaction can still abort.
      transaction.oncomplete = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('Draft storage request failed'))
      transaction.onerror = () => reject(transaction.error || new Error('Draft storage transaction failed'))
      transaction.onabort = () => reject(transaction.error || new Error('Draft storage transaction aborted'))
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

// Module-local write queues cannot serialize other tabs. Compare and replace
// the head under the same IndexedDB readwrite lock, and acknowledge only commit.
function putIndexedDbIfNotNewer(record) {
  return openDatabase().then((database) => {
    if (!database) throw new Error('Draft storage unavailable')
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      let written = false
      const request = store.get(record.key)
      request.onsuccess = () => {
        const current = request.result
        if (!current || compareDrafts(current, record) <= 0) {
          const put = store.put(record)
          put.onerror = () => reject(put.error || new Error('Draft storage request failed'))
          written = true
        }
      }
      request.onerror = () => reject(request.error || new Error('Draft storage request failed'))
      transaction.oncomplete = () => resolve(written)
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

// Preparation never publishes or removes a draft HEAD, and never joins the
// durability queue: edits while it is pending still publish full snapshots.
const preparations = new Map()
export async function prepareEditorDraftBaseline(snapshot, isTemplate = false, isCurrent = () => true) {
  const key = editorDraftKey(snapshot?.id, isTemplate)
  const token = {}
  preparations.set(key, token)
  try {
    if (!snapshot?.id || typeof indexedDB === 'undefined' || !isCurrent()) return false
    // Retain the producer's certified root, not a normalized copy: replacing
    // dictionary identities here prevents every subsequent edit from compacting.
    // Persistence is not semantic admission; recovery validates independently.
    const captured = captureOwnedDraft({ key, snapshot })
    if (!captured.semantic || !checkpointNeeded(captured)) return false
    const checkpoint = checkpointRecord(captured)
    await runTransaction('readwrite', (store) => store.put(checkpoint))
    if (preparations.get(key) !== token || !isCurrent()) return false
    acceptCheckpoint(captured, checkpoint.key)
    return true
  } catch {
    return false // Optional acceleration; full durable writes remain unchanged.
  } finally {
    if (preparations.get(key) === token) preparations.delete(key)
  }
}

let writeChain = Promise.resolve()

export function writeEditorDraft(input, { acknowledgeLocalPublication = false } = {}) {
  if (!input?.key || !input.snapshot?.id ||
      !['presentation', 'template'].some(kind => input.key === `${kind}:${input.snapshot.id}`)) return Promise.resolve(false)
  let captured
  try { captured = captureOwnedDraft(input) } catch { return Promise.resolve(false) }
  const compactHead = typeof indexedDB !== 'undefined' && compactDraft(captured)
  const record = compactHead || fullDraftEnvelope(captured.record)
  // Capture and synchronous publication precede scheduling. A compact head only
  // references an immutable checkpoint whose transaction has already committed.
  const localWritten = writeLocal(record, capturedDraftBytes(captured, compactHead))
  let acknowledge
  const durablePublication = new Promise((resolve) => { acknowledge = resolve })
  if (localWritten) acknowledge(true)
  writeChain = writeChain.catch(() => false).then(async () => {
    if (localWritten) {
      try { await removeOlderIndexedDb(record) } catch { /* Local head is durable. */ }
    } else {
      try {
        if (!await putIndexedDbIfNotNewer(record)) { acknowledge(false); return false }
        removeLocalIfOlder(record)
        acknowledge(true)
      } catch { acknowledge(false); return false }
    }
    try {
      // Compaction already proved this head references a committed baseline.
      // Full fallbacks still need checkpoint eligibility checked.
      if (!compactHead && checkpointNeeded(captured)) {
        const checkpoint = checkpointRecord(captured)
        await runTransaction('readwrite', (store) => store.put(checkpoint))
        acceptCheckpoint(captured, checkpoint.key)
      }
    } catch { /* Keep the independently durable full head; retry next write. */ }
    // Retain immutable checkpoints: other tabs or pending heads may reference
    // them. Neither clear nor head cleanup may garbage-collect these records.
    return true
  }).catch(() => { acknowledge(false); return false })
  // Local publication is already independently recoverable. Optional IDB
  // cleanup/checkpoint work must not delay remote dispatch; fallback-only
  // writes still acknowledge exclusively after the transaction commits.
  return acknowledgeLocalPublication ? durablePublication : writeChain
}

export async function readEditorDraft(id, isTemplate = false) {
  const key = editorDraftKey(id, isTemplate)
  const localEnvelope = readLocal(key)
  const load = (checkpointKey) => runTransaction('readonly', (store) => store.get(checkpointKey))
  let indexedEnvelope = null
  try { indexedEnvelope = await runTransaction('readonly', (store) => store.get(key)) } catch { /* Local fallback. */ }
  // Ordering depends only on envelope metadata. Expand the preferred head first;
  // an invalid or unavailable checkpoint must still fall back to the other head.
  const indexedFirst = indexedEnvelope && (!localEnvelope || compareDrafts(localEnvelope, indexedEnvelope) < 0)
  const candidates = indexedFirst ? [indexedEnvelope, localEnvelope] : [localEnvelope, indexedEnvelope]
  for (const candidate of candidates) {
    try {
      const expanded = await expandDraft(candidate, load, key)
      if (!expanded) continue
      if (candidate === indexedEnvelope) removeLocalIfOlder(expanded)
      return expanded
    } catch { /* Missing or invalid baseline fails closed; try the other head. */ }
  }
  return null
}

export function clearEditorDraft(id, isTemplate = false, identity) {
  const key = editorDraftKey(id, isTemplate)
  const removedLocal = removeLocal(key, identity)
  writeChain = writeChain.catch(() => false).then(async () => {
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
