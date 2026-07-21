const crypto = require('node:crypto')
const {
  SCHEMA_VERSION,
  hashRecord,
  validateBlob,
  validateHead,
  validateRevision,
} = require('./schemas')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { rebindSourceMap } = require('../source-map')
const { MUTATION_OPERATIONS } = require('../mutation-operation-scope')
const { resolveEditedExportContext } = require('../validated-edited-export-context')

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const clone = (value) => structuredClone(value)
const BINARY_HEAD_REVISION_POINTERS = new Set(['originalRevisionId', 'packageRevisionId'])
const LOGICAL_HEAD_REVISION_POINTERS = new Set([
  'projectionRevisionId',
  'sourceMapRevisionId',
  'journalRevisionId',
])

function portableError(code, message) {
  return Object.assign(new Error(message), { code })
}

function binaryRevisionIdsFor(head, errorCode) {
  try {
    validateHead(head)
  } catch {
    throw portableError(errorCode, 'Portable package head is malformed')
  }
  const revisionIds = []
  for (const [key, value] of Object.entries(head)) {
    if (!key.endsWith('RevisionId') || LOGICAL_HEAD_REVISION_POINTERS.has(key)) continue
    if (typeof value !== 'string' || !value) {
      throw portableError(errorCode, 'Portable package binary revision pointer is malformed')
    }
    revisionIds.push(value)
  }
  for (const key of BINARY_HEAD_REVISION_POINTERS) {
    if (typeof head[key] !== 'string' || !head[key]) {
      throw portableError(errorCode, 'Portable package binary revision pointer is missing')
    }
  }
  return [...new Set(revisionIds)]
}

function referencedRecords(records, ids, key, validate, errorCode, label) {
  if (!Array.isArray(records)) {
    throw portableError(errorCode, `Portable package ${label} collection is malformed`)
  }
  return ids.map((id) => {
    const matches = records.filter((record) => record?.[key] === id)
    if (matches.length !== 1) {
      throw portableError(errorCode, `Portable package ${label} is missing or duplicated`)
    }
    try {
      validate(matches[0])
    } catch {
      throw portableError(errorCode, `Portable package ${label} is malformed`)
    }
    return matches[0]
  })
}

function validatePortableBlobDescriptor(blob) {
  return validateBlob({ ...blob, schemaVersion: SCHEMA_VERSION })
}

function exactDescriptors(records, expectedIds, key, validate, label) {
  if (!Array.isArray(records)) {
    throw portableError('PACKAGE_MANIFEST_INVALID', `Portable package ${label} collection is malformed`)
  }
  const descriptors = new Map()
  for (const record of records) {
    try {
      validate(record)
    } catch {
      throw portableError('PACKAGE_MANIFEST_INVALID', `Portable package ${label} is malformed`)
    }
    const id = record[key]
    if (descriptors.has(id)) {
      throw portableError('PACKAGE_MANIFEST_INVALID', `Portable package ${label} is duplicated`)
    }
    descriptors.set(id, record)
  }
  if (descriptors.size !== expectedIds.size ||
      [...expectedIds].some((id) => !descriptors.has(id))) {
    throw portableError('PACKAGE_MANIFEST_INVALID', `Portable package ${label} is missing or extra`)
  }
  return [...expectedIds].map((id) => descriptors.get(id))
}

function exactSuppliedBlobs(blobs, expectedShas) {
  if (!Array.isArray(blobs)) {
    throw portableError('PACKAGE_MANIFEST_INVALID', 'Portable package blob payload collection is malformed')
  }
  const supplied = new Map()
  for (const blob of blobs) {
    if (!blob || typeof blob.sha256 !== 'string' || !blob.sha256 || supplied.has(blob.sha256)) {
      throw portableError('PACKAGE_MANIFEST_INVALID', 'Portable package blob payload is malformed or duplicated')
    }
    supplied.set(blob.sha256, blob)
  }
  if (supplied.size !== expectedShas.size ||
      [...expectedShas].some((sha) => !supplied.has(sha))) {
    throw portableError('PACKAGE_MANIFEST_INVALID', 'Portable package blob payload is missing or extra')
  }
  return supplied
}

function assertBlobBytes(descriptor, blob) {
  if (!Buffer.isBuffer(blob?.bytes) ||
      blob.byteLength !== descriptor.byteLength ||
      blob.bytes.byteLength !== descriptor.byteLength ||
      sha256(blob.bytes) !== descriptor.sha256) {
    throw portableError('PACKAGE_HASH_MISMATCH', 'Portable import package verification failed')
  }
}

function exportClosure(state, head) {
  const revisionIds = binaryRevisionIdsFor(head, 'PACKAGE_INCOMPLETE')
  const revisions = referencedRecords(
    state.revisions,
    revisionIds,
    'id',
    validateRevision,
    'PACKAGE_INCOMPLETE',
    'binary revision'
  )
  const blobShas = [...new Set(revisions.map((revision) => revision.blobSha256))]
  const blobs = referencedRecords(
    state.blobs,
    blobShas,
    'sha256',
    validateBlob,
    'PACKAGE_INCOMPLETE',
    'binary blob'
  )
  return { revisions, blobs }
}

function assertDestinationClosure(store, revisions, blobs) {
  const state = store.getState()
  for (const revision of revisions) {
    const matches = (state.revisions || []).filter((item) => item?.id === revision.id)
    if (matches.length > 1) {
      throw portableError('PACKAGE_IMPORT_CONFLICT', 'Destination package revision is duplicated')
    }
    if (matches.length === 1) {
      try {
        validateRevision(matches[0])
      } catch {
        throw portableError('PACKAGE_IMPORT_CONFLICT', 'Destination package revision is malformed')
      }
      if (matches[0].blobSha256 !== revision.blobSha256) {
        throw portableError('PACKAGE_IMPORT_CONFLICT', 'Destination package revision conflicts with bundle')
      }
    }
  }
  for (const blob of blobs) {
    const matches = (state.blobs || []).filter((item) => item?.sha256 === blob.sha256)
    if (matches.length > 1) {
      throw portableError('PACKAGE_IMPORT_CONFLICT', 'Destination package blob is duplicated')
    }
    if (matches.length === 1) {
      try {
        validateBlob(matches[0])
      } catch {
        throw portableError('PACKAGE_IMPORT_CONFLICT', 'Destination package blob is malformed')
      }
      if (matches[0].byteLength !== blob.byteLength) {
        throw portableError('PACKAGE_IMPORT_CONFLICT', 'Destination package blob conflicts with bundle')
      }
    }
  }
}

function validatePortableBundle(bundle, presentationId) {
  const manifest = bundle?.manifest
  if (!manifest || manifest.schemaVersion !== SCHEMA_VERSION ||
      typeof presentationId !== 'string' || !presentationId ||
      typeof manifest.presentationId !== 'string' || !manifest.presentationId ||
      manifest.head?.presentationId !== manifest.presentationId ||
      (manifest.mutationResults !== undefined && !Array.isArray(manifest.mutationResults))) {
    throw new TypeError('Invalid portable package manifest')
  }
  const revisionIds = new Set(binaryRevisionIdsFor(manifest.head, 'PACKAGE_MANIFEST_INVALID'))
  const revisions = exactDescriptors(
    manifest.revisions,
    revisionIds,
    'id',
    validateRevision,
    'revision descriptor'
  )
  const blobShas = new Set(revisions.map((revision) => revision.blobSha256))
  const blobs = exactDescriptors(
    manifest.blobs,
    blobShas,
    'sha256',
    validatePortableBlobDescriptor,
    'blob descriptor'
  )
  const supplied = exactSuppliedBlobs(bundle.blobs, blobShas)
  for (const blob of blobs) assertBlobBytes(blob, supplied.get(blob.sha256))
  return { manifest, revisions, blobs, supplied }
}

function authorityResultsFor(state, head) {
  return (state.mutationResults || []).filter((result) =>
    result.presentationId === head.presentationId &&
    result.packageRevisionId === head.packageRevisionId &&
    result.projection && result.sourceMap
  )
}

function requiresAuthority(head) {
  return Boolean(
    head.projectionRevisionId ||
    head.sourceMapRevisionId ||
    head.journalRevisionId ||
    head.pendingJournalHash !== undefined
  )
}

function assertExportAuthority(state, head) {
  if (!requiresAuthority(head)) return
  const context = resolveEditedExportContext(state, head.presentationId)
  if (!context.ok) {
    throw portableError(
      'PACKAGE_AUTHORITY_UNAVAILABLE',
      'Portable export requires restorable package authority'
    )
  }
}

function rebindProjection(projection, presentationId) {
  return projection ? { ...clone(projection), id: presentationId } : projection
}

function rebindAuthorityResult(result, presentationId) {
  const rebound = {
    ...clone(result),
    presentationId,
    projection: rebindProjection(result.projection, presentationId),
  }
  if (result.sourceMap) {
    const packageGeneration = Number.isSafeInteger(result.sourceMap.packageGeneration)
      ? result.sourceMap.packageGeneration
      : result.generation
    rebound.sourceMap = rebindSourceMap(result.sourceMap, {
      presentationId,
      revisionId: result.sourceMap.revisionId,
      packageGeneration,
    })
  }
  if (rebound.requestIdentity && rebound.projection) {
    rebound.requestIdentity = {
      ...rebound.requestIdentity,
      snapshotHash: hashRecord(rebound.projection),
    }
  }
  if (rebound.operation === MUTATION_OPERATIONS.PROJECTION_SAVE && rebound.projection) {
    rebound.requestHash = hashRecord({
      operation: rebound.operation,
      presentationId,
      expectedGeneration: rebound.requestIdentity?.expectedGeneration ?? rebound.generation - 1,
      baseRevisionId: rebound.requestIdentity?.baseRevisionId || null,
      after: rebound.projection,
    })
  }
  if (rebound.operation === MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT && rebound.projection) {
    const textTransports = Object.fromEntries((rebound.journal?.operations || []).map((operation) => [
      `${operation.slideId}:${operation.elementId}`,
      operation.textTransport,
    ]))
    rebound.requestHash = hashRecord({
      operation: rebound.operation,
      presentationId,
      expectedGeneration: rebound.requestIdentity?.expectedGeneration ?? rebound.generation - 1,
      baseRevisionId: rebound.requestIdentity?.baseRevisionId || rebound.journal?.baseRevisionId || null,
      after: rebound.projection,
      textTransports,
      pendingEdit: (rebound.journal?.operations || []).length > 0,
      budgets: {},
      requireOfficeCli: true,
      policy: null,
    })
  }
  return rebound
}

function rebindImportedAuthority(manifest, presentationId) {
  const sourceHead = manifest.head
  const sourceResults = manifest.mutationResults || []
  if (sourceResults.some((result) =>
    result?.presentationId !== sourceHead.presentationId ||
    result.packageRevisionId !== sourceHead.packageRevisionId ||
    !result.projection || !result.sourceMap
  )) {
    throw portableError(
      'PACKAGE_AUTHORITY_UNAVAILABLE',
      'Portable package contains an invalid authority record'
    )
  }
  if (requiresAuthority(sourceHead)) {
    const context = resolveEditedExportContext({
      heads: [sourceHead],
      mutationResults: sourceResults,
    }, sourceHead.presentationId)
    if (!context.ok) {
      throw portableError(
        'PACKAGE_AUTHORITY_UNAVAILABLE',
        'Portable package authority does not match its head'
      )
    }
  }
  const results = sourceResults.map((result) => rebindAuthorityResult(result, presentationId))
  const pending = sourceHead.pendingJournalHash !== undefined
  const sourceCurrent = pending
    ? sourceResults.find((result) => result.packageRevisionId === sourceHead.packageRevisionId &&
        result.state === 'pending-edited-export' &&
        result.journal?.journalHash === sourceHead.pendingJournalHash)
    : sourceResults.find((result) => result.packageRevisionId === sourceHead.packageRevisionId &&
        result.projection && result.sourceMap &&
        hashRecord(result.projection) === sourceHead.projectionRevisionId &&
        hashRecord(result.sourceMap) === sourceHead.sourceMapRevisionId)
  const reboundCurrent = sourceCurrent
    ? results[sourceResults.indexOf(sourceCurrent)]
    : null
  if (requiresAuthority(sourceHead) && !reboundCurrent) {
    throw portableError(
      'PACKAGE_AUTHORITY_UNAVAILABLE',
      'Portable package authority does not match its head'
    )
  }

  const head = {
    ...clone(sourceHead),
    presentationId,
    predecessorId: null,
    ...(reboundCurrent ? {
      projectionRevisionId: hashRecord(reboundCurrent.projection),
      sourceMapRevisionId: hashRecord(reboundCurrent.sourceMap),
    } : {}),
  }
  return { head, results }
}

async function exportPresentationPackage(store, presentationId, options = {}) {
  const state = store.getState()
  const heads = state.heads.filter((item) => item.presentationId === presentationId)
  if (!heads.length) return null
  if (heads.length !== 1) {
    throw portableError('PACKAGE_INCOMPLETE', 'Portable export has duplicate package heads')
  }
  const head = heads[0]
  if (options.expectedHead && hashRecord(head) !== hashRecord(options.expectedHead)) {
    throw Object.assign(new Error('Package head changed during portable export'), {
      code: 'SYNC_SOURCE_CHANGED',
      status: 409,
      retryable: true,
    })
  }
  assertExportAuthority(state, head)
  const closure = exportClosure(state, head)
  const blobs = []
  for (const descriptor of closure.blobs) {
    let bytes
    try {
      bytes = await store.readBlob(descriptor.sha256)
    } catch {
      throw portableError('PACKAGE_INCOMPLETE', 'Portable export package blob is missing')
    }
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== descriptor.byteLength ||
        sha256(bytes) !== descriptor.sha256) {
      throw portableError('PACKAGE_INCOMPLETE', 'Portable export package verification failed')
    }
    blobs.push({ sha256: descriptor.sha256, byteLength: bytes.byteLength, bytes })
  }
  return {
    manifest: {
      schemaVersion: SCHEMA_VERSION,
      presentationId,
      head: clone(head),
      revisions: clone(closure.revisions),
      blobs: blobs.map(({ bytes: _bytes, ...blob }) => blob),
      mutationResults: clone(authorityResultsFor(state, head)),
    },
    blobs,
  }
}

async function importPresentationPackage(store, bundle, presentationId, options = {}) {
  const validated = validatePortableBundle(bundle, presentationId)
  const { manifest, revisions, blobs, supplied } = validated
  const importedAuthority = rebindImportedAuthority(manifest, presentationId)
  if (options.admissionPreflight) await options.admissionPreflight(manifest)
  assertDestinationClosure(store, revisions, blobs)
  const committed = []
  for (const descriptor of blobs) {
    const staged = await store.stageBlob(supplied.get(descriptor.sha256).bytes, {
      expectedSha256: descriptor.sha256,
    })
    committed.push(await store.blobs.commit(staged))
  }
  await store.mutate((next) => {
    for (const blob of committed) {
      if (!next.blobs.some((item) => item.sha256 === blob.sha256)) next.blobs.push(blob)
    }
    for (const revision of revisions) {
      if (!next.revisions.some((item) => item.id === revision.id)) next.revisions.push(revision)
    }
    next.heads = next.heads.filter((item) => item.presentationId !== presentationId)
    next.owners = next.owners.filter((item) =>
      item.ownerType !== 'presentation' || item.ownerId !== presentationId
    )
    next.mutationResults = next.mutationResults.filter((result) =>
      result.presentationId !== presentationId
    )
    const head = {
      ...importedAuthority.head,
      fencingEpoch: store.fencingEpoch,
      matrixAuthorityEpoch: next.matrixAuthorityEpoch,
      matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, next.matrixAuthorityEpoch),
    }
    next.heads.push(head)
    next.mutationResults.push(...importedAuthority.results)
    for (const revision of revisions) {
      next.owners.push({
        schemaVersion: SCHEMA_VERSION,
        revisionId: revision.id,
        ownerType: 'presentation',
        ownerId: presentationId,
      })
    }
  }, options)
  return store.getState().heads.find((item) => item.presentationId === presentationId)
}

module.exports = { exportPresentationPackage, importPresentationPackage }
