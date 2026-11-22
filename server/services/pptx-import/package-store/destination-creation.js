const fs = require('node:fs/promises')
const { isDeepStrictEqual } = require('node:util')
const { loadStateIndex } = require('./state-index-loader')

// Creation rollback authority is the head this mutation published, never an allocated ID.
function assertDestinationAbsent(state, presentationId) {
  if (state.heads.some(head => head.presentationId === presentationId)) {
    throw Object.assign(new Error('Package lifecycle destination already exists'), {
      code: 'STALE_GENERATION', status: 409, retryable: true,
    })
  }
}

function retainedPredecessor(root, depth = 3) {
  return root && depth > 0
    ? { ...root, predecessor: retainedPredecessor(root.predecessor, depth - 1) }
    : null
}

async function createDestinationHead(store, presentationId, mutator, options) {
  let candidate, predecessor, createdHead
  try {
    await store.mutate(next => {
      assertDestinationAbsent(next, presentationId)
      mutator(next)
      createdHead = structuredClone(next.heads.find(head => head.presentationId === presentationId))
      // Capture the complete operation outcome, including source and destination
      // ownership, before publication detaches the draft. mutate adds these two
      // envelope fields after returning from this callback.
      candidate = structuredClone(next)
      candidate.generation += 1
      candidate.fencingEpoch = store.fencingEpoch
      predecessor = retainedPredecessor(structuredClone(store.metadata.root))
    }, options)
  } catch (error) {
    // A draft identity is not a publication receipt. Prove the exact immediate
    // successor transaction and its durable, validated full operation outcome.
    // A pre-root failure, collision, or concurrent successor grants no authority.
    if (createdHead && candidate) {
      try {
        const root = JSON.parse(await fs.readFile(store.metadata.rootPath, 'utf8'))
        const { state } = await loadStateIndex(store.rootDir, root)
        if (root.transactionId !== predecessor?.transactionId &&
            isDeepStrictEqual(root.predecessor, predecessor) &&
            root.storeGeneration === candidate.generation &&
            root.fencingEpoch === candidate.fencingEpoch &&
            isDeepStrictEqual(state, candidate) &&
            isDeepStrictEqual(store.metadata.root, root) &&
            isDeepStrictEqual(store.metadata.state, state)) {
          error.createdPackageHead = structuredClone(createdHead)
        }
      } catch {
        // Unavailable or unprovable durable authority must never enable cleanup
        // or replace the original publication error.
      }
    }
    throw error
  }
  return structuredClone(createdHead)
}

module.exports = { assertDestinationAbsent, createDestinationHead }
