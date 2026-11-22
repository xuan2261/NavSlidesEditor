const { isDeepStrictEqual } = require('node:util')
const { clone, sealPublication, isSealedPublication } = require('./publication-snapshot')

// No exported certifier: only this exact operation can create an owned successor.
const ownedSuccessors = new WeakSet()

function captureCompatibilityWrites(writes) {
  if (!Array.isArray(writes)) throw new TypeError('Compatibility writes must be an array')
  // Detached comparison inputs only; never attach captured caller values to state.
  // Preserve full equality, including undefined fields (not merely JSON digests).
  return new Map(writes.map((write) => [write.id, clone({ compatibilityOutbox: [write] }).compatibilityOutbox[0]]))
}

function acknowledgeOwnedOutbox(current, captured, fencingEpoch) {
  const retained = current.compatibilityOutbox.map(
    (write) => !isDeepStrictEqual(captured.get(write.id), write)
  )
  const acknowledged = retained.filter((keep) => !keep).length
  if (!acknowledged) return { acknowledged: 0 }
  // Raw/recovery fixtures are not proof, even if shallow-frozen.
  const base = isSealedPublication(current) ? current : sealPublication(clone(current))
  const next = {
    ...base,
    compatibilityOutbox: base.compatibilityOutbox.filter((_write, index) => retained[index]),
    generation: base.generation + 1,
    fencingEpoch,
  }
  sealPublication(next)
  if (isSealedPublication(next)) ownedSuccessors.add(next)
  return { next, acknowledged }
}

function isOwnedOutboxSuccessor(state) {
  return ownedSuccessors.has(state)
}

module.exports = { captureCompatibilityWrites, acknowledgeOwnedOutbox, isOwnedOutboxSuccessor }
