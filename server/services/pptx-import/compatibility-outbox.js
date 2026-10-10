const { RECORD_SCHEMA_VERSION, hashRecord } = require('./package-store/schemas')
const { validateTrustedImportMetadata } = require('./trusted-import-metadata')

function clone(value) {
  return structuredClone(value)
}

function writeId(input) {
  return `compatibility-${hashRecord(input)}`
}

function queueCompatibilityWrite(state, input) {
  if (!Array.isArray(state.compatibilityOutbox)) state.compatibilityOutbox = []
  const record = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    id: writeId(input),
    ...clone(input),
  }
  if (state.compatibilityOutbox.some((item) => item.id === record.id)) return record
  state.compatibilityOutbox.push(record)
  return record
}

function queueCompatibilityUpsert(state, {
  presentationId,
  generation,
  presentation,
  updatedAt,
  trustedImportMetadata,
  headOnly = false,
}) {
  if (!presentation || presentation.id !== presentationId) {
    throw new TypeError('Compatibility presentation identity is invalid')
  }
  const trusted = trustedImportMetadata === undefined ? undefined : validateTrustedImportMetadata(
    trustedImportMetadata, presentation.pptxAggregateHead?.originalRevisionId
  )
  return queueCompatibilityWrite(state, {
    operation: 'upsert',
    presentationId,
    generation,
    ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
    ...(headOnly ? { headOnly: true } : {}),
    ...(trusted === undefined ? {} : { trustedImportMetadata: trusted }),
    presentation: clone(presentation),
  })
}

function queueCompatibilityRemoval(state, { presentationId, generation }) {
  return queueCompatibilityWrite(state, {
    operation: 'remove',
    presentationId,
    generation,
  })
}

function snapshotCompatibilityOutbox(store) {
  return clone(store.getState().compatibilityOutbox || [])
}

async function acknowledgeCompatibilityOutbox(store, writes, { signal } = {}) {
  signal?.throwIfAborted()
  if (!Array.isArray(writes)) throw new TypeError('Compatibility writes must be an array')
  const captured = new Map(writes.map((write) => [write.id, hashRecord(write)]))
  if (!captured.size) return 0
  let acknowledged = 0
  await store.mutate((next) => {
    next.compatibilityOutbox = (next.compatibilityOutbox || []).filter((write) => {
      if (captured.get(write.id) !== hashRecord(write)) return true
      acknowledged += 1
      return false
    })
    if (!acknowledged) return false
  }, { signal })
  return acknowledged
}

async function drainCompatibilityOutbox(store, apply) {
  if (typeof apply !== 'function') throw new TypeError('Compatibility apply function is required')
  const writes = snapshotCompatibilityOutbox(store)
  if (!writes.length) return 0
  await apply(writes)
  await acknowledgeCompatibilityOutbox(store, writes)
  return writes.length
}

module.exports = {
  acknowledgeCompatibilityOutbox,
  drainCompatibilityOutbox,
  queueCompatibilityRemoval,
  queueCompatibilityUpsert,
  snapshotCompatibilityOutbox,
}
