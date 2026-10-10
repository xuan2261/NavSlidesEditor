// Creation rollback authority is the head this mutation published, never an allocated ID.
function assertDestinationAbsent(state, presentationId) {
  if (state.heads.some(head => head.presentationId === presentationId)) {
    throw Object.assign(new Error('Package lifecycle destination already exists'), {
      code: 'STALE_GENERATION', status: 409, retryable: true,
    })
  }
}

async function createDestinationHead(store, presentationId, mutator, options) {
  let createdState, createdHead
  try {
    await store.mutate(next => {
      assertDestinationAbsent(next, presentationId)
      mutator(next)
      createdState = next
      createdHead = next.heads.find(head => head.presentationId === presentationId)
    }, options)
  } catch (error) {
    // Root rename can commit before the publisher reports a later failure.
    // Object identity proves this exact candidate became the live state; a
    // colliding or subsequently published state cannot grant cleanup authority.
    if (createdHead && store.metadata.state === createdState) {
      error.createdPackageHead = structuredClone(createdHead)
    }
    throw error
  }
  return structuredClone(createdHead)
}

module.exports = { assertDestinationAbsent, createDestinationHead }
