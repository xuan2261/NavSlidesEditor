const { isDeepStrictEqual } = require('node:util')
const { captureCompatibilityWrites } = require('./package-store/owned-outbox-ack')
const { RECORD_SCHEMA_VERSION, hashRecord } = require('./package-store/schemas')
const { validateTrustedImportMetadata } = require('./trusted-import-metadata')
const { isCertifiedSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')

function clone(value) {
  if (value && typeof value === 'object' && value.presentation) {
    const semantic = value.presentation.pptxSemantic
    if (isCertifiedSemanticDocument(semantic)) {
      const { presentation, ...record } = value
      const { pptxSemantic: _semantic, ...editable } = presentation
      return {
        ...structuredClone(record),
        presentation: { ...structuredClone(editable), pptxSemantic: semantic },
      }
    }
  }
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

function queueCompatibilityUpsert(
  state,
  { presentationId, generation, presentation, updatedAt, trustedImportMetadata, headOnly = false }
) {
  if (!presentation || presentation.id !== presentationId) {
    throw new TypeError('Compatibility presentation identity is invalid')
  }
  const trusted =
    trustedImportMetadata === undefined
      ? undefined
      : validateTrustedImportMetadata(
          trustedImportMetadata,
          presentation.pptxAggregateHead?.originalRevisionId
        )
  return queueCompatibilityWrite(state, {
    operation: 'upsert',
    presentationId,
    generation,
    ...(typeof updatedAt === 'string' ? { updatedAt } : {}),
    ...(headOnly ? { headOnly: true } : {}),
    ...(trusted === undefined ? {} : { trustedImportMetadata: trusted }),
    presentation,
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
  return store.getCompatibilityState().compatibilityOutbox || []
}

async function acknowledgeCompatibilityOutbox(store, writes, { signal } = {}) {
  signal?.throwIfAborted()
  if (!Array.isArray(writes)) throw new TypeError('Compatibility writes must be an array')
  if (typeof store.acknowledgeCompatibilityWrites === 'function') {
    return store.acknowledgeCompatibilityWrites(writes, { signal })
  }
  // Legacy lightweight fixtures may implement only mutate.
  const captured = captureCompatibilityWrites(writes)
  if (!captured.size) return 0
  let acknowledged = 0
  await store.mutate(
    (next) => {
      next.compatibilityOutbox = (next.compatibilityOutbox || []).filter((write) => {
        if (!isDeepStrictEqual(captured.get(write.id), write)) return true
        acknowledged += 1
        return false
      })
      if (!acknowledged) return false
    },
    { signal }
  )
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
