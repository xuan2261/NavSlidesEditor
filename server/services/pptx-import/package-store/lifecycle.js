const { SCHEMA_VERSION, hashRecord, validateOwner } = require('./schemas')
const { queueCompatibilityRemoval, queueCompatibilityUpsert } = require('../compatibility-outbox')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')

const clone = (value) => structuredClone(value)
const revisionIdsFor = (head) => new Set([
  head.originalRevisionId,
  head.projectionRevisionId,
  head.packageRevisionId,
  head.sourceMapRevisionId,
  head.journalRevisionId,
].filter(Boolean))

function addOwner(next, revisionId, owner, retainedHead) {
  if (next.owners.some((item) =>
    item.revisionId === revisionId &&
    item.ownerType === owner.ownerType &&
    item.ownerId === owner.ownerId
  )) return
  next.owners.push({
    schemaVersion: SCHEMA_VERSION,
    revisionId,
    ...owner,
    ...(retainedHead ? { retainedHead: clone(retainedHead) } : {}),
  })
}

async function admit(store, options) {
  if (options.admissionPreflight) {
    await options.admissionPreflight(store.getState())
  }
}

async function duplicatePresentationOwner(store, sourceId, destinationId, options = {}) {
  const owner = validateOwner({ ownerType: 'presentation', ownerId: destinationId })
  const source = store.metadata.state.heads.find((head) => head.presentationId === sourceId)
  if (!source) return null
  await admit(store, options)
  await store.mutate((next) => {
    for (const revisionId of revisionIdsFor(source)) addOwner(next, revisionId, owner)
    next.heads.push({
      ...clone(source),
      presentationId: destinationId,
      generation: 1,
      predecessorId: null,
      fencingEpoch: store.fencingEpoch,
    })
  }, options)
  return store.metadata.state.heads.find((head) => head.presentationId === destinationId)
}

async function quarantinePresentation(store, presentationId, options = {}) {
  const head = store.metadata.state.heads.find((item) => item.presentationId === presentationId)
  if (!head) return null
  await admit(store, options)
  await store.mutate((next) => {
    next.owners = next.owners.filter(
      (item) => item.ownerType !== 'presentation' || item.ownerId !== presentationId
    )
    next.heads = next.heads.filter((item) => item.presentationId !== presentationId)
    if (options.compatibilityRemove) {
      queueCompatibilityRemoval(next, {
        presentationId,
        generation: head.generation,
      })
    }
  }, options)
  return clone(head)
}

async function retainHead(store, owner, presentationId, options = {}) {
  validateOwner(owner)
  const head = store.metadata.state.heads.find((item) => item.presentationId === presentationId)
  if (!head) return null
  await admit(store, options)
  await store.mutate((next) => {
    for (const revisionId of revisionIdsFor(head)) addOwner(next, revisionId, owner, head)
  }, options)
  return clone(head)
}

function restorableHead(state, presentationId, retainedOwner) {
  const retainedOwners = state.owners.filter((item) =>
    item.ownerType === retainedOwner.ownerType && item.ownerId === retainedOwner.ownerId
  )
  const retainedHead = retainedOwners.find((item) =>
    item.retainedHead?.presentationId === presentationId
  )?.retainedHead
  const current = state.heads.find((item) => item.presentationId === presentationId)
  if (!retainedHead || !current) return null

  const retainedRevisionIds = revisionIdsFor(retainedHead)
  const retainedHeadId = hashRecord(retainedHead)
  const ownersForRetainedHead = retainedOwners.filter((item) =>
    item.retainedHead && hashRecord(item.retainedHead) === retainedHeadId
  )
  if (![...retainedRevisionIds].every((revisionId) => ownersForRetainedHead.some((item) =>
    item.revisionId === revisionId
  ))) return null
  return { retainedHead, current, retainedRevisionIds }
}

function getRestorableHead(store, presentationId, retainedOwner) {
  validateOwner(retainedOwner)
  const result = restorableHead(store.metadata.state, presentationId, retainedOwner)
  return result ? clone(result.retainedHead) : null
}

async function restoreForward(store, presentationId, retainedOwner, options = {}) {
  validateOwner(retainedOwner)
  const result = restorableHead(store.metadata.state, presentationId, retainedOwner)
  if (!result) return null
  const { retainedHead, current, retainedRevisionIds } = result

  await admit(store, options)
  await store.mutate((next) => {
    const matrixAuthorityEpoch = next.matrixAuthorityEpoch + 1
    next.matrixAuthorityEpoch = matrixAuthorityEpoch
    const restoredHead = {
      ...clone(retainedHead),
      presentationId,
      generation: current.generation + 1,
      predecessorId: hashRecord(current),
      fencingEpoch: store.fencingEpoch,
      matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, matrixAuthorityEpoch),
    }
    next.heads = next.heads.map((head) => head.presentationId === presentationId
      ? restoredHead
      : {
        ...head,
        matrixAuthorityEpoch,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, matrixAuthorityEpoch),
      })
    next.owners = next.owners.filter((item) =>
      item.ownerType !== 'presentation' || item.ownerId !== presentationId
    )
    for (const revisionId of retainedRevisionIds) {
      addOwner(next, revisionId, {
        ownerType: 'presentation',
        ownerId: presentationId,
      })
    }
    if (options.compatibilityPresentation) {
      queueCompatibilityUpsert(next, {
        presentationId,
        generation: restoredHead.generation,
        presentation: {
          ...options.compatibilityPresentation,
          id: presentationId,
          pptxAggregateHead: clone(restoredHead),
        },
      })
    }
  }, options)
  return store.metadata.state.heads.find((item) => item.presentationId === presentationId)
}

module.exports = {
  duplicatePresentationOwner,
  quarantinePresentation,
  getRestorableHead,
  restoreForward,
  retainHead,
}
