const crypto = require('node:crypto')
const path = require('node:path')
const { canonicalJson, validateState, validateStateRoot, STATE_ROOT_SCHEMA_VERSION } = require('./schemas')
const { clone, sealPublication } = require('./publication-snapshot')
const { emitCanonicalChunks, isSealedCanonicalData } = require('./canonical-json')

const { isOwnedOutboxSuccessor } = require('./owned-outbox-ack')
const { isOwnedProjectionSave } = require('./owned-projection-save')

// Only publications admitted here can retain their validated state identities.
// A frozen caller object is not a preparation receipt.
const preparedPublications = new WeakMap()

const MAX_PREDECESSOR_DEPTH = 3
function boundPredecessors(root, depth = MAX_PREDECESSOR_DEPTH) {
  if (!root || depth <= 0) return null
  return { ...root, predecessor: boundPredecessors(root.predecessor, depth - 1) }
}

// Transaction-local proof: detach before validation and before the first I/O
// await. Neither retained mutator references nor a shallow freeze are receipts.
// Strings are immutable UTF-8 write inputs, retained only for this transaction.
function preparePublication(draft, previousRoot, streaming = false, storage) {
  const state =
    isOwnedOutboxSuccessor(draft) || isOwnedProjectionSave(draft)
      ? draft
      : clone(draft, { preserveSealedResults: true })
  validateState(state)
  sealPublication(state)
  return serializePublication(state, previousRoot, streaming, storage)
}

function serializePublication(state, previousRoot, streaming, storage) {
  // Storage is a validated manifest, never a substitute for resolved-state validation.
  const stored = storage === undefined ? state : clone(storage)
  if (storage !== undefined) {
    require('./state-manifest').validateStateManifest(stored)
    sealPublication(stored)
  }
  if (streaming && isSealedCanonicalData(stored)) {
    const chunks = emitCanonicalChunks(stored)
    // Start the proof/dispatch guard synchronously, before the first I/O await.
    const first = chunks.next()
    const prepared = Object.freeze({
      state,
      chunks: (function* () { if (!first.done) yield first.value; yield* chunks })(),
      complete: (stateHash) => completePublication(state, previousRoot, stateHash),
    })
    preparedPublications.set(prepared, { state, previousRoot })
    return prepared
  }
  // Non-JSON historical inputs retain their existing observable serialization.
  const stateBytes = canonicalJson(stored)
  const stateHash = crypto.createHash('sha256').update(stateBytes).digest('hex')
  const prepared = Object.freeze({ ...completePublication(state, previousRoot, stateHash), stateBytes })
  preparedPublications.set(prepared, { state, previousRoot })
  return prepared
}

function completePublication(state, previousRoot, stateHash) {
  const root = {
    schemaVersion: STATE_ROOT_SCHEMA_VERSION,
    transactionId: crypto.randomUUID(),
    stateHash,
    stateFile: path.join('indexes', `${stateHash}.json`),
    storeGeneration: state.generation,
    fencingEpoch: state.fencingEpoch,
    predecessor: boundPredecessors(previousRoot),
  }
  validateStateRoot(root)
  sealPublication(root)
  return Object.freeze({ state, root, rootBytes: JSON.stringify(root) })
}

function prepareStreamingPublication(draft, previousRoot, { storage } = {}) {
  return preparePublication(draft, previousRoot, true, storage)
}

function attachStorageManifest(prepared, manifest) {
  const proof = preparedPublications.get(prepared)
  if (!proof) throw new TypeError('Expected proven prepared publication')
  return serializePublication(proof.state, proof.previousRoot, true, manifest)
}

module.exports = { preparePublication, prepareStreamingPublication, attachStorageManifest }
