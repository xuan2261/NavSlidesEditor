const { SCHEMA_VERSION, hashRecord, validateOwner } = require('./schemas')
const { queueCompatibilityRemoval, queueCompatibilityUpsert } = require('../compatibility-outbox')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { canonicalEditableSnapshot } = require('../canonical-snapshot')
const { rebindSourceMap } = require('../source-map')
const { MUTATION_OPERATIONS } = require('../mutation-operation-scope')

const clone = (value) => structuredClone(value)
const revisionIdsFor = (head) => new Set([
  head.originalRevisionId,
  head.projectionRevisionId,
  head.packageRevisionId,
  head.sourceMapRevisionId,
  head.journalRevisionId,
].filter(Boolean))

function committedAuthority(state, head) {
  return [...(state.mutationResults || [])].reverse().find((result) =>
    result.presentationId === head.presentationId &&
    result.packageRevisionId === head.packageRevisionId &&
    result.state === 'committed' && result.projection && result.sourceMap &&
    (head.projectionRevisionId === hashRecord(result.projection) &&
      head.sourceMapRevisionId === hashRecord(result.sourceMap)) &&
    (result.operation === undefined ||
      result.operation === MUTATION_OPERATIONS.PACKAGE_IMPORT ||
      result.operation === MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT)
  ) || null
}

function comparableTemplateProjection(value) {
  const projection = canonicalEditableSnapshot(value)
  for (const key of ['id', 'title', 'description', 'isTemplate']) delete projection[key]
  return projection
}

function rebindAuthority(authority, presentationId, generation, idempotencyKey, options = {}) {
  if (!authority) return null
  const projection = options.projection
    ? { ...canonicalEditableSnapshot(options.projection), id: presentationId }
    : { ...clone(authority.projection), id: presentationId }
  const sourceMap = rebindSourceMap(authority.sourceMap, {
    presentationId,
    revisionId: authority.packageRevisionId,
    packageGeneration: generation,
  })
  const result = {
    ...clone(authority),
    presentationId,
    idempotencyKey,
    generation,
    packageRevisionId: authority.packageRevisionId,
    projection,
    sourceMap,
    requestHash: hashRecord({ lifecycle: idempotencyKey, projection, sourceMap }),
    state: 'committed',
  }
  delete result.requestIdentity
  return result
}

function lifecycleError(code, message) {
  return Object.assign(new Error(message), {
    code,
    status: code === 'PACKAGE_PENDING_PROJECTION' || code === 'STALE_GENERATION'
      ? 409
      : code === 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE' ? 422 : 500,
    ...(code === 'STALE_GENERATION' ? { retryable: true } : {}),
  })
}

function assertHeadUnchanged(next, expected, presentationId) {
  const actual = next.heads.find((head) => head.presentationId === presentationId)
  if (!actual || hashRecord(actual) !== hashRecord(expected)) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head changed')
  }
}

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
  if (Object.hasOwn(options, 'expectedSourceHead') && options.expectedSourceHead === null) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head appeared')
  }
  const expectedSourceHead = options.expectedSourceHead || source
  if (hashRecord(source) !== hashRecord(expectedSourceHead)) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head changed')
  }
  if (source.pendingJournalHash !== undefined) {
    throw lifecycleError(
      'PACKAGE_PENDING_PROJECTION',
      'Cannot duplicate a presentation with a pending package projection'
    )
  }
  const authority = committedAuthority(store.metadata.state, source)
  await admit(store, options)
  await store.mutate((next) => {
    assertHeadUnchanged(next, expectedSourceHead, sourceId)
    for (const revisionId of revisionIdsFor(source)) addOwner(next, revisionId, owner)
    const destination = {
      ...clone(source),
      presentationId: destinationId,
      generation: 1,
      predecessorId: null,
      matrixAuthorityEpoch: next.matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, next.matrixAuthorityEpoch),
      fencingEpoch: store.fencingEpoch,
    }
    delete destination.pendingJournalHash
    if (authority) {
      const rebound = rebindAuthority(
        authority,
        destinationId,
        destination.generation,
        `lifecycle-duplicate-${hashRecord({ sourceId, destinationId, revisionId: source.packageRevisionId })}`,
        { projection: options.projection }
      )
      destination.projectionRevisionId = hashRecord(rebound.projection)
      destination.sourceMapRevisionId = hashRecord(rebound.sourceMap)
      if (destination.packageRevisionId === destination.originalRevisionId) {
        destination.journalRevisionId = null
      }
      next.mutationResults.push(rebound)
    }
    next.heads.push(destination)
  }, options)
  return store.metadata.state.heads.find((head) => head.presentationId === destinationId)
}

async function quarantinePresentation(store, presentationId, options = {}) {
  const head = store.metadata.state.heads.find((item) => item.presentationId === presentationId)
  if (!head) {
    if (options.expectedHead) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head changed')
    }
    return null
  }
  const expectedHead = options.expectedHead || head
  if (hashRecord(head) !== hashRecord(expectedHead)) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head changed')
  }
  await admit(store, options)
  await store.mutate((next) => {
    assertHeadUnchanged(next, expectedHead, presentationId)
    next.owners = next.owners.filter(
      (item) => item.ownerType !== 'presentation' || item.ownerId !== presentationId
    )
    next.heads = next.heads.filter((item) => item.presentationId !== presentationId)
    if (options.compatibilityRemove) {
      queueCompatibilityRemoval(next, {
        presentationId,
        generation: expectedHead.generation,
      })
    }
  }, options)
  return clone(expectedHead)
}

async function restoreQuarantinedHead(
  store,
  retainedOwner,
  presentationId,
  options = {}
) {
  validateOwner(retainedOwner)
  const retained = retainedHeadForOwner(store.metadata.state, retainedOwner)
  if (!retained || retained.retainedHead.presentationId !== presentationId) return null
  const existing = store.metadata.state.heads.find((item) => item.presentationId === presentationId)
  if (existing) {
    if (hashRecord(existing) !== hashRecord(retained.retainedHead)) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle restored head changed')
    }
    return clone(existing)
  }

  await admit(store, options)
  await store.mutate((next) => {
    const liveRetained = retainedHeadForOwner(next, retainedOwner)
    if (!liveRetained || liveRetained.retainedHead.presentationId !== presentationId ||
        hashRecord(liveRetained.retainedHead) !== hashRecord(retained.retainedHead)) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle retained head changed')
    }
    if (next.heads.some((item) => item.presentationId === presentationId)) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle restored head already exists')
    }
    const restoredHead = clone(liveRetained.retainedHead)
    next.heads.push(restoredHead)
    for (const revisionId of liveRetained.retainedRevisionIds) {
      addOwner(next, revisionId, {
        ownerType: 'presentation',
        ownerId: presentationId,
      })
    }
    if (options.compatibilityPresentation) {
      queueCompatibilityUpsert(next, {
        presentationId,
        generation: restoredHead.generation,
        updatedAt: options.updatedAt || options.compatibilityPresentation.updatedAt,
        presentation: {
          ...clone(options.compatibilityPresentation),
          id: presentationId,
          pptxAggregateHead: clone(restoredHead),
        },
      })
    }
  }, options)
  return store.metadata.state.heads.find((item) => item.presentationId === presentationId)
}

async function retainHead(store, owner, presentationId, options = {}) {
  validateOwner(owner)
  const head = store.metadata.state.heads.find((item) => item.presentationId === presentationId)
  if (!head) {
    if (options.expectedHead) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head changed')
    }
    return null
  }
  const expectedHead = options.expectedHead || head
  if (hashRecord(head) !== hashRecord(expectedHead)) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle source head changed')
  }
  await admit(store, options)
  await store.mutate((next) => {
    assertHeadUnchanged(next, expectedHead, presentationId)
    // One retained owner must describe one aggregate head so retries cannot
    // leave an older head available for a later restore.
    next.owners = next.owners.filter((item) =>
      item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId
    )
    for (const revisionId of revisionIdsFor(expectedHead)) {
      addOwner(next, revisionId, owner, expectedHead)
    }
  }, options)
  return clone(expectedHead)
}

function hasRetainedRevisionIntegrity(state, retainedHead, retainedOwner, requireOwnerEntries = true) {
  const packageRevisionIds = new Set([
    retainedHead.originalRevisionId,
    retainedHead.packageRevisionId,
  ].filter(Boolean))
  for (const revisionId of packageRevisionIds) {
    const revision = state.revisions.find((item) => item.id === revisionId)
    if (!revision || !state.blobs.some((blob) => blob.sha256 === revision.blobSha256) ||
        (requireOwnerEntries && !state.owners.some((owner) =>
          owner.ownerType === retainedOwner.ownerType &&
          owner.ownerId === retainedOwner.ownerId &&
          owner.revisionId === revisionId
        ))) return false
  }

  const authorityResults = (state.mutationResults || []).filter((result) =>
    result.presentationId === retainedHead.presentationId &&
    result.packageRevisionId === retainedHead.packageRevisionId
  )
  if (retainedHead.projectionRevisionId && !authorityResults.some((result) =>
    result.projection && hashRecord(result.projection) === retainedHead.projectionRevisionId
  )) return false
  if (retainedHead.sourceMapRevisionId && !authorityResults.some((result) =>
    result.sourceMap && hashRecord(result.sourceMap) === retainedHead.sourceMapRevisionId
  )) return false
  if (retainedHead.journalRevisionId && !authorityResults.some((result) =>
    result.journal?.journalHash === retainedHead.journalRevisionId
  )) return false
  return true
}

function retainedHeadForOwner(state, retainedOwner) {
  const retainedOwners = state.owners.filter((item) =>
    item.ownerType === retainedOwner.ownerType && item.ownerId === retainedOwner.ownerId
  )
  const retainedHead = retainedOwners.find((item) => item.retainedHead)?.retainedHead
  if (!retainedHead) return null

  const retainedRevisionIds = revisionIdsFor(retainedHead)
  const retainedHeadId = hashRecord(retainedHead)
  const ownersForRetainedHead = retainedOwners.filter((item) =>
    item.retainedHead && hashRecord(item.retainedHead) === retainedHeadId
  )
  if (![...retainedRevisionIds].every((revisionId) => ownersForRetainedHead.some((item) =>
    item.revisionId === revisionId
  )) || !hasRetainedRevisionIntegrity(state, retainedHead, retainedOwner)) return null
  return { retainedHead, retainedRevisionIds }
}

function restorableHead(state, presentationId, retainedOwner) {
  const retained = retainedHeadForOwner(state, retainedOwner)
  const current = state.heads.find((item) => item.presentationId === presentationId)
  if (!retained || !current || retained.retainedHead.presentationId !== presentationId) return null
  return { ...retained, current }
}

async function instantiateRetainedHead(store, retainedOwner, destinationId, options = {}) {
  validateOwner(retainedOwner)
  const owner = validateOwner({ ownerType: 'presentation', ownerId: destinationId })
  const retained = retainedHeadForOwner(store.metadata.state, retainedOwner)
  if (!retained) return null
  const { retainedHead, retainedRevisionIds } = retained
  if (retainedHead.pendingJournalHash !== undefined) {
    throw lifecycleError(
      'PACKAGE_PENDING_PROJECTION',
      'Cannot instantiate a template with a pending package projection'
    )
  }
  const authority = committedAuthority(store.metadata.state, retainedHead)
  if (!authority && (retainedHead.projectionRevisionId || retainedHead.sourceMapRevisionId)) {
    throw lifecycleError(
      'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      'Package lifecycle retained authority is unavailable'
    )
  }
  if (authority && options.requireProjectionMatch) {
    try {
      if (hashRecord(comparableTemplateProjection(options.projection)) !==
          hashRecord(comparableTemplateProjection(authority.projection))) {
        throw lifecycleError(
          'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
          'Package lifecycle template projection changed'
        )
      }
    } catch (error) {
      if (error.code === 'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE') throw error
      throw lifecycleError(
        'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
        'Package lifecycle template projection is invalid'
      )
    }
  }
  if (store.metadata.state.heads.some((head) => head.presentationId === destinationId)) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle destination already exists')
  }

  await admit(store, options)
  await store.mutate((next) => {
    const liveRetained = retainedHeadForOwner(next, retainedOwner)
    if (!liveRetained || hashRecord(liveRetained.retainedHead) !== hashRecord(retainedHead)) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle retained head changed')
    }
    if (next.heads.some((head) => head.presentationId === destinationId)) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle destination already exists')
    }
    const destination = {
      ...clone(retainedHead),
      presentationId: destinationId,
      generation: 1,
      predecessorId: null,
      matrixAuthorityEpoch: next.matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, next.matrixAuthorityEpoch),
      fencingEpoch: store.fencingEpoch,
    }
    delete destination.pendingJournalHash
    let rebound = null
    if (authority) {
      rebound = rebindAuthority(
        authority,
        destinationId,
        destination.generation,
        `lifecycle-template-${hashRecord({ retainedOwner, destinationId })}`,
        { projection: options.projection }
      )
      destination.projectionRevisionId = hashRecord(rebound.projection)
      destination.sourceMapRevisionId = hashRecord(rebound.sourceMap)
      if (destination.packageRevisionId === destination.originalRevisionId) {
        destination.journalRevisionId = null
      }
      next.mutationResults.push(rebound)
    }
    next.heads.push(destination)
    for (const revisionId of retainedRevisionIds) addOwner(next, revisionId, owner)
    if (options.compatibilityPresentation) {
      queueCompatibilityUpsert(next, {
        presentationId: destinationId,
        generation: destination.generation,
        updatedAt: options.updatedAt || options.compatibilityPresentation.updatedAt || new Date().toISOString(),
        presentation: {
          ...options.compatibilityPresentation,
          ...(rebound?.projection ? clone(rebound.projection) : {}),
          id: destinationId,
          pptxAggregateHead: clone(destination),
        },
      })
    }
  }, options)
  return store.metadata.state.heads.find((head) => head.presentationId === destinationId)
}

function getRestorableHead(store, presentationId, retainedOwner) {
  validateOwner(retainedOwner)
  const result = restorableHead(store.metadata.state, presentationId, retainedOwner)
  return result ? clone(result.retainedHead) : null
}

async function restoreForward(store, presentationId, retainedOwner, options = {}) {
  validateOwner(retainedOwner)
  const result = restorableHead(store.metadata.state, presentationId, retainedOwner)
  if (!result) {
    const rawRetainedHead = store.metadata.state.owners.find((item) =>
      item.ownerType === retainedOwner.ownerType &&
      item.ownerId === retainedOwner.ownerId &&
      item.retainedHead
    )?.retainedHead
    if (rawRetainedHead) {
      const rawHeadHash = hashRecord(rawRetainedHead)
      const matchingRecords = store.metadata.state.owners.filter((item) =>
        item.ownerType === retainedOwner.ownerType &&
        item.ownerId === retainedOwner.ownerId &&
        item.retainedHead && hashRecord(item.retainedHead) === rawHeadHash
      )
      if ([...revisionIdsFor(rawRetainedHead)].every((revisionId) =>
        matchingRecords.some((item) => item.revisionId === revisionId)
      ) && !hasRetainedRevisionIntegrity(
        store.metadata.state,
        rawRetainedHead,
        retainedOwner
      )) {
        throw lifecycleError(
          'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
          'Package lifecycle retained authority is unavailable'
        )
      }
    }
    return null
  }
  const { retainedHead, current, retainedRevisionIds } = result
  const expectedCurrentHead = options.expectedCurrentHead || current
  if (options.expectedCurrentHead &&
      hashRecord(current) !== hashRecord(options.expectedCurrentHead)) {
    throw lifecycleError('STALE_GENERATION', 'Package lifecycle current head changed')
  }
  if (retainedHead.pendingJournalHash !== undefined || current.pendingJournalHash !== undefined) {
    throw lifecycleError(
      'PACKAGE_PENDING_PROJECTION',
      'Cannot restore a presentation while a pending package projection exists'
    )
  }
  const authority = committedAuthority(store.metadata.state, retainedHead)
  if (!authority && (retainedHead.projectionRevisionId || retainedHead.sourceMapRevisionId)) {
    throw lifecycleError(
      'CURRENT_SOURCE_AUTHORITY_UNAVAILABLE',
      'Package lifecycle retained authority is unavailable'
    )
  }

  await admit(store, options)
  await store.mutate((next) => {
    assertHeadUnchanged(next, expectedCurrentHead, presentationId)
    const liveRetained = restorableHead(next, presentationId, retainedOwner)
    if (!liveRetained || hashRecord(liveRetained.retainedHead) !== hashRecord(retainedHead)) {
      throw lifecycleError('STALE_GENERATION', 'Package lifecycle retained head changed')
    }
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
    delete restoredHead.pendingJournalHash
    let rebound = null
    if (authority) {
      rebound = rebindAuthority(
        authority,
        presentationId,
        restoredHead.generation,
        `lifecycle-restore-${hashRecord({ presentationId, retainedHead })}`,
        { projection: options.projection }
      )
      restoredHead.projectionRevisionId = hashRecord(rebound.projection)
      restoredHead.sourceMapRevisionId = hashRecord(rebound.sourceMap)
      if (restoredHead.packageRevisionId === restoredHead.originalRevisionId) {
        restoredHead.journalRevisionId = null
      }
      next.mutationResults.push(rebound)
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
        updatedAt: options.updatedAt || options.compatibilityPresentation.updatedAt || new Date().toISOString(),
        presentation: {
          ...options.compatibilityPresentation,
          ...(rebound?.projection ? clone(rebound.projection) : {}),
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
  instantiateRetainedHead,
  quarantinePresentation,
  restoreQuarantinedHead,
  getRestorableHead,
  restoreForward,
  retainHead,
}
