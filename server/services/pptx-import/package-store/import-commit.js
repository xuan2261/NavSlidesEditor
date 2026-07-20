const { canonicalEditableSnapshot } = require('../canonical-snapshot')
const { rebindSourceMap } = require('../source-map')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { buildOpcInventory } = require('./opc-inventory')
const {
  SCHEMA_VERSION,
  hashRecord,
  validateRevision,
} = require('./schemas')

function importCommitError(message) {
  const error = new Error(message)
  error.code = 'PACKAGE_IMPORT_COMMIT_FAILED'
  return error
}

function projectionElementKeys(projection) {
  const keys = new Set()
  const visitElements = (slideId, elements) => {
    for (const element of elements || []) {
      if (!element || typeof element !== 'object') continue
      if (typeof element.id === 'string' && element.id) keys.add(`${slideId}:${element.id}`)
      visitElements(slideId, element.elements || element.children)
    }
  }
  const visitSlides = (slides) => {
    for (const slide of slides || []) {
      if (!slide || typeof slide !== 'object') continue
      if (typeof slide.id === 'string' && slide.id) visitElements(slide.id, slide.elements)
      visitSlides(slide.children)
    }
  }
  visitSlides(projection?.slides)
  return keys
}

function createImportSourceMap(sourceMap, presentationId, revisionId, projection) {
  let rebound
  try {
    rebound = rebindSourceMap(sourceMap, {
      presentationId,
      revisionId,
      packageGeneration: 1,
    })
  } catch (error) {
    throw importCommitError(`Invalid package source map: ${error.message}`)
  }
  const elementKeys = projectionElementKeys(projection)
  for (const key of Object.keys(rebound.entries)) {
    if (!elementKeys.has(key)) {
      throw importCommitError(`Source map entry does not match a projection element: ${key}`)
    }
  }
  for (const key of elementKeys) {
    if (!Object.hasOwn(rebound.entries, key)) {
      throw importCommitError(`Source map is missing a projection element: ${key}`)
    }
  }
  return rebound
}

function validateInput(input) {
  const { jobId, presentationId, projection } = input || {}
  if (typeof jobId !== 'string' || !jobId) throw importCommitError('Import job id is required')
  if (typeof presentationId !== 'string' || !presentationId) {
    throw importCommitError('Import presentation id is required')
  }
  if (!projection || projection.id !== presentationId) {
    throw importCommitError('Import projection must belong to its presentation')
  }
}

async function prepareImport(store, source, input, options = {}) {
  validateInput(input)
  const { jobId, presentationId, projection } = input
  const canonicalProjection = canonicalEditableSnapshot(projection, options.snapshotLimits)
  const inventory = await buildOpcInventory(source, options.inventoryLimits)
  const revision = validateRevision({
    schemaVersion: SCHEMA_VERSION,
    id: `r0-${inventory.packageSha256}`,
    ordinal: 0,
    blobSha256: inventory.packageSha256,
    manifestHash: inventory.manifestHash,
    createdAt: options.uploadedAt || new Date().toISOString(),
  })
  const sourceMap = createImportSourceMap(
    input.sourceMap, presentationId, revision.id, canonicalProjection
  )
  const staged = await store.stageBlob(source, { expectedSha256: inventory.packageSha256 })
  const blob = await store.blobs.commit(staged)
  const capabilityHash = hashRecord({
    manifestHash: inventory.manifestHash,
    projectionHash: hashRecord(canonicalProjection),
    sourceMapHash: hashRecord(sourceMap),
  })
  const authority = {
    schemaVersion: SCHEMA_VERSION,
    presentationId,
    idempotencyKey: jobId,
    generation: 1,
    packageRevisionId: revision.id,
    projection: canonicalProjection,
    sourceMap,
    opcManifest: inventory,
    state: 'committed',
  }
  return { authority, blob, capabilityHash, jobId, presentationId, revision, sourceMap }
}

async function publishImport(store, prepared, options = {}) {
  await store.assertWriter()
  const {
    authority, blob, capabilityHash, jobId, presentationId, revision, sourceMap,
  } = prepared
  await store.mutate((next) => {
    if (next.heads.some((head) => head.presentationId === presentationId)) {
      throw importCommitError('Presentation package head already exists')
    }
    if (!next.blobs.some((item) => item.sha256 === blob.sha256)) next.blobs.push(blob)
    if (!next.revisions.some((item) => item.id === revision.id)) next.revisions.push(revision)
    next.owners.push({
      schemaVersion: SCHEMA_VERSION,
      revisionId: revision.id,
      ownerType: 'presentation',
      ownerId: presentationId,
    })
    const head = {
      schemaVersion: SCHEMA_VERSION,
      presentationId,
      originalRevisionId: revision.id,
      projectionRevisionId: hashRecord(authority.projection),
      packageRevisionId: revision.id,
      sourceMapRevisionId: hashRecord(sourceMap),
      journalRevisionId: null,
      evidenceByClaim: {},
      matrixAuthorityEpoch: next.matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, next.matrixAuthorityEpoch),
      generation: 1,
      predecessorId: null,
      fencingEpoch: store.fencingEpoch,
    }
    next.heads.push(head)
    next.mutationResults.push(authority)
    next.jobs = next.jobs.filter((job) => job.id !== jobId)
    next.jobs.push({
      schemaVersion: SCHEMA_VERSION,
      id: jobId,
      kind: 'import',
      status: 'completed',
      transactionState: 'committed',
      cancellationPoint: 'committed',
      capabilityHash,
      updatedAt: new Date().toISOString(),
      presentationId,
      outcomeRevisionId: revision.id,
    })
  }, options.faults)

  return {
    blob,
    revision,
    inventory: authority.opcManifest,
    head: store.getState().heads.find((head) => head.presentationId === presentationId),
  }
}

async function commitImport(store, source, input, options = {}) {
  const prepared = await prepareImport(store, source, input, options)
  return publishImport(store, prepared, options)
}

async function rollbackImport(store, { jobId, presentationId }) {
  if (typeof jobId !== 'string' || !jobId || typeof presentationId !== 'string' || !presentationId) {
    throw importCommitError('Import rollback requires a job and presentation id')
  }
  await store.assertWriter()
  await store.mutate((next) => {
    next.owners = next.owners.filter(
      (owner) => owner.ownerType !== 'presentation' || owner.ownerId !== presentationId
    )
    next.heads = next.heads.filter((head) => head.presentationId !== presentationId)
    next.mutationResults = next.mutationResults.filter(
      (result) => result.presentationId !== presentationId || result.idempotencyKey !== jobId
    )
    const job = next.jobs.find((item) => item.id === jobId)
    if (job) {
      job.status = 'failed'
      job.transactionState = 'rolled-back'
      job.cancellationPoint = 'rolled-back'
      job.updatedAt = new Date().toISOString()
    }
  })
}

module.exports = { commitImport, prepareImport, publishImport, rollbackImport }
