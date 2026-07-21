const { SCHEMA_VERSION, hashRecord } = require('./package-store/schemas')

function clone(value) {
  return structuredClone(value)
}

function writeId(input) {
  return `compatibility-${hashRecord(input)}`
}

function queueCompatibilityWrite(state, input) {
  if (!Array.isArray(state.compatibilityOutbox)) state.compatibilityOutbox = []
  const record = {
    schemaVersion: SCHEMA_VERSION,
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
}) {
  if (!presentation || presentation.id !== presentationId) {
    throw new TypeError('Compatibility presentation identity is invalid')
  }
  return queueCompatibilityWrite(state, {
    operation: 'upsert',
    presentationId,
    generation,
    ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
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

async function acknowledgeCompatibilityOutbox(store, writes) {
  if (!Array.isArray(writes)) throw new TypeError('Compatibility writes must be an array')
  const ids = new Set(writes.map((item) => item.id))
  if (!ids.size) return 0
  await store.mutate((next) => {
    next.compatibilityOutbox = (next.compatibilityOutbox || []).filter((item) => !ids.has(item.id))
  })
  return writes.length
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
