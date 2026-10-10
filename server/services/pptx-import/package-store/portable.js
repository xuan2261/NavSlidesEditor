const crypto = require('node:crypto')
const {
  RECORD_SCHEMA_VERSION,
  hashRecord,
  validateBlob,
  validateHead,
  validateRevision,
} = require('./schemas')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { journalMediaProjections, rebindAuthorityResult, validateAuthorityResult } = require('./portable-authority')
const { queueCompatibilityUpsert } = require('../compatibility-outbox')
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
  return validateBlob(blob)
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
  if (revisions.some((revision) => !state.owners?.some((owner) =>
    owner.ownerType === 'presentation' &&
    owner.ownerId === head.presentationId &&
    owner.revisionId === revision.id
  ))) {
    throw portableError(
      'PACKAGE_INCOMPLETE',
      'Portable export revision is not owned by the presentation'
    )
  }
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

function hasCompatibleRevision(existing, revision) {
  return existing.schemaVersion === revision.schemaVersion &&
    existing.id === revision.id &&
    existing.ordinal === revision.ordinal &&
    existing.blobSha256 === revision.blobSha256 &&
    existing.manifestHash === revision.manifestHash
}

function assertDestinationClosure(state, revisions, blobs) {
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
      if (!hasCompatibleRevision(matches[0], revision)) {
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

function validatePortableBundle(bundle, presentationId = bundle?.manifest?.presentationId) {
  const manifest = bundle?.manifest
  if (!manifest || manifest.schemaVersion !== RECORD_SCHEMA_VERSION ||
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
  const current = validateManifestAuthority(manifest)
  const snapshotBlobs = blobs.map(clone)
  return {
    manifest: clone(manifest),
    revisions: revisions.map(clone),
    blobs: snapshotBlobs,
    projection: current ? clone(current.projection) : null,
    mediaProjections: (manifest.mutationResults || []).flatMap((result) =>
      [clone(result.projection), ...journalMediaProjections(result.journal, result.projection).map(clone)]),
    supplied: new Map(snapshotBlobs.map((blob) => [blob.sha256, {
      sha256: blob.sha256,
      byteLength: blob.byteLength,
      bytes: Buffer.from(supplied.get(blob.sha256).bytes),
    }])),
  }
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

function currentAuthorityResult(state, head) {
  if (!requiresAuthority(head)) return null
  const context = resolveEditedExportContext(state, head.presentationId)
  if (!context.ok ||
      head.projectionRevisionId !== hashRecord(context.after) ||
      head.sourceMapRevisionId !== hashRecord(context.sourceMap)) return null
  const pending = context.pendingJournalHash !== undefined
  const candidates = authorityResultsFor(state, head).filter((result) => {
    if (hashRecord(result.projection) !== head.projectionRevisionId ||
        hashRecord(result.sourceMap) !== head.sourceMapRevisionId) return false
    if (pending) {
      return result.state === 'pending-edited-export' &&
        (result.operation === undefined || result.operation === MUTATION_OPERATIONS.PROJECTION_SAVE) &&
        result.generation === head.generation &&
        result.journal?.journalHash === context.pendingJournalHash
    }
    return result.state === 'committed' &&
      (result.journal?.journalHash ?? null) === (head.journalRevisionId ?? null) &&
      (result.operation === undefined ||
        result.operation === MUTATION_OPERATIONS.PACKAGE_IMPORT ||
        result.operation === MUTATION_OPERATIONS.VALIDATED_EDITED_EXPORT)
  })
  return pending ? candidates.length === 1 ? candidates[0] : null : candidates.at(-1) || null
}

function assertExportAuthority(state, head) {
  const results = authorityResultsFor(state, head)
  if (!requiresAuthority(head)) {
    if (!results.length) return
  } else if (currentAuthorityResult(state, head)) {
    return
  }
  throw portableError(
    'PACKAGE_AUTHORITY_UNAVAILABLE',
    'Portable export requires restorable package authority'
  )
}

function validateManifestAuthority(manifest) {
  const sourceHead = manifest.head
  const sourceResults = manifest.mutationResults || []
  for (const result of sourceResults) validateAuthorityResult(result, sourceHead)
  const current = currentAuthorityResult({ heads: [sourceHead], mutationResults: sourceResults }, sourceHead)
  if ((requiresAuthority(sourceHead) && !current) ||
      (!requiresAuthority(sourceHead) && sourceResults.length) ||
      (sourceHead.journalRevisionId && !sourceResults.some((result) => result.journal?.journalHash === sourceHead.journalRevisionId))) {
    throw portableError('PACKAGE_AUTHORITY_UNAVAILABLE', 'Portable package authority does not match its head')
  }
  return current
}

function rebindImportedAuthority(manifest, presentationId, predecessor, matrixAuthorityEpoch, mediaUrlMap) {
  const sourceHead = manifest.head
  const sourceCurrent = validateManifestAuthority(manifest)
  const generation = predecessor ? predecessor.generation + 1 : sourceHead.pendingJournalHash !== undefined ? 2 : 1
  if (!Number.isSafeInteger(generation)) throw new TypeError('Portable destination generation is exhausted')
  const mapGeneration = (value) => value === 0 ? 0 : value === sourceHead.generation ? generation : Math.max(1, generation - 1)
  const sourceResults = manifest.mutationResults || []
  const results = sourceResults.map((result) => rebindAuthorityResult(result,
    { presentationId, matrixAuthorityEpoch }, mapGeneration, mediaUrlMap))
  // No-op receipts reference an existing committed journal. Rebind that journal
  // once through its producing receipt, not through each replay request identity.
  const reboundJournals = new Map()
  sourceResults.forEach((result, index) => {
    if (!result.journal) return
    const hash = result.journal.journalHash
    const producing = Array.isArray(result.operationIds) && result.operationIds.length > 0
    if (!reboundJournals.has(hash) || (producing && !reboundJournals.get(hash).producing)) {
      reboundJournals.set(hash, { journal: results[index].journal, producing })
    }
  })
  sourceResults.forEach((result, index) => {
    if (result.journal) results[index].journal = clone(reboundJournals.get(result.journal.journalHash).journal)
  })
  const current = sourceCurrent ? results[sourceResults.indexOf(sourceCurrent)] : null
  const head = { ...clone(sourceHead), presentationId, generation,
    predecessorId: predecessor ? hashRecord(predecessor) : null,
    matrixAuthorityEpoch, matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, matrixAuthorityEpoch) }
  if (current) {
    head.projectionRevisionId = hashRecord(current.projection)
    head.sourceMapRevisionId = hashRecord(current.sourceMap)
  }
  if (sourceHead.journalRevisionId) {
    const journalResult = results[sourceResults.findIndex((result) => result.journal?.journalHash === sourceHead.journalRevisionId)]
    head.journalRevisionId = journalResult.journal.journalHash
    if (sourceHead.pendingJournalHash !== undefined) head.pendingJournalHash = head.journalRevisionId
  }
  return { head, results, projection: current?.projection || null }
}

function changedError(code, message) {
  return Object.assign(portableError(code, message), { status: 409, retryable: true })
}
function assertSourceHead(state, presentationId, expected) {
  const heads = state.heads.filter((head) => head.presentationId === presentationId)
  if (heads.length !== 1 || hashRecord(heads[0]) !== hashRecord(expected)) {
    throw changedError('SYNC_SOURCE_CHANGED', 'Package head changed during portable export')
  }
}
function assertDestinationHead(state, presentationId, replace, expected) {
  const heads = state.heads.filter((head) => head.presentationId === presentationId)
  const current = heads[0] || null
  if (heads.length > 1 || (!replace && current) ||
      (replace && hashRecord(current) !== hashRecord(expected))) {
    throw changedError('SYNC_DESTINATION_CHANGED', 'Portable destination package head changed')
  }
  return current
}
function captureMediaUrlMap(value = {}) {
  if (!value || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new TypeError('Portable media URL map must be a plain record')
  }
  const local = (url) => {
    if (typeof url !== 'string' || !/^(?:\/uploads\/|https?:\/\/[^/]+\/uploads\/)/u.test(url)) return false
    try {
      const pathname = decodeURIComponent(new URL(url, 'https://navslides.invalid').pathname)
      return pathname.startsWith('/uploads/') && !pathname.includes('\\') &&
        pathname.slice(9).split('/').every((part) => part && part !== '.' && part !== '..')
    } catch { return false }
  }
  const entries = Object.entries(value)
  if (entries.some(([source, destination]) => !local(source) || !local(destination))) {
    throw new TypeError('Portable media URL map requires local upload URLs')
  }
  return Object.fromEntries(entries)
}

async function exportPresentationPackage(store, presentationId, options = {}) {
  const state = store.getState()
  const heads = state.heads.filter((item) => item.presentationId === presentationId)
  if (!heads.length) {
    if (options.expectedHead) throw changedError('SYNC_SOURCE_CHANGED', 'Portable source package head disappeared')
    return null
  }
  if (heads.length !== 1) throw portableError('PACKAGE_INCOMPLETE', 'Portable export has duplicate package heads')
  const head = heads[0]
  const expectedHead = options.expectedHead === undefined ? head : clone(options.expectedHead)
  assertSourceHead(state, presentationId, expectedHead)
  assertExportAuthority(state, head)
  const mutationResults = clone(authorityResultsFor(state, head))
  if (state.mutationResults.some((result) => result.presentationId === presentationId && result.trustedImportMetadata !== undefined)) {
    const metadata = require('../trusted-import-metadata').getTrustedImportMetadata(state, head)
    if (metadata) for (const result of mutationResults) result.trustedImportMetadata = clone(metadata)
  }
  validateManifestAuthority({ head, mutationResults })
  const closure = exportClosure(state, head)
  const blobs = []
  for (const descriptor of closure.blobs) {
    let bytes
    try {
      bytes = await store.readBlob(descriptor.sha256)
    } catch {
      throw portableError('PACKAGE_INCOMPLETE', 'Portable export package blob is missing')
    }
    if (!Buffer.isBuffer(bytes) || bytes.byteLength !== descriptor.byteLength || sha256(bytes) !== descriptor.sha256) {
      throw portableError('PACKAGE_INCOMPLETE', 'Portable export package verification failed')
    }
    blobs.push({ sha256: descriptor.sha256, byteLength: bytes.byteLength, bytes })
  }
  assertSourceHead(store.getState(), presentationId, expectedHead)
  return { manifest: { schemaVersion: RECORD_SCHEMA_VERSION, presentationId, head: clone(head),
    revisions: clone(closure.revisions), blobs: blobs.map(({ bytes: _bytes, ...blob }) => ({ schemaVersion: RECORD_SCHEMA_VERSION, ...blob })),
    mutationResults }, blobs }
}

async function importPresentationPackage(store, bundle, presentationId, options = {}) {
  const { manifest, revisions, blobs, supplied } = validatePortableBundle(bundle, presentationId)
  if (options.replace !== undefined && typeof options.replace !== 'boolean') throw new TypeError('Portable replace must be explicit boolean')
  const replace = options.replace === true
  if (replace && options.expectedHead === undefined) {
    throw Object.assign(portableError('PACKAGE_DESTINATION_PRECONDITION_REQUIRED', 'Portable replace requires expectedHead'), { status: 428 })
  }
  const expectedHead = options.expectedHead == null ? null : clone(options.expectedHead)
  if (expectedHead) validateHead(expectedHead)
  const mediaUrlMap = captureMediaUrlMap(options.mediaUrlMap)
  const beforePublication = options.beforePublication
  if (beforePublication !== undefined && typeof beforePublication !== 'function') throw new TypeError('Portable beforePublication must be a function')
  options.signal?.throwIfAborted()
  assertDestinationHead(store.getState(), presentationId, replace, expectedHead)
  if (options.admissionPreflight) await options.admissionPreflight(clone(manifest))
  options.signal?.throwIfAborted()
  assertDestinationHead(store.getState(), presentationId, replace, expectedHead)
  assertDestinationClosure(store.getState(), revisions, blobs)
  const committed = []
  for (const descriptor of blobs) {
    options.signal?.throwIfAborted()
    const staged = await store.stageBlob(supplied.get(descriptor.sha256).bytes, { expectedSha256: descriptor.sha256 })
    committed.push(await store.blobs.commit(staged))
  }
  let publishedHead
  await store.mutate(async (next) => {
    options.signal?.throwIfAborted()
    const predecessor = assertDestinationHead(next, presentationId, replace, expectedHead)
    assertDestinationClosure(next, revisions, blobs)
    const imported = rebindImportedAuthority(manifest, presentationId, predecessor, next.matrixAuthorityEpoch, mediaUrlMap)
    const head = { ...imported.head, fencingEpoch: store.fencingEpoch }
    let compatibility
    if (beforePublication) {
      options.signal?.throwIfAborted()
      compatibility = await beforePublication({ head: clone(head), projection: clone(imported.projection) })
      options.signal?.throwIfAborted()
      if (compatibility !== undefined && (!compatibility || compatibility.id !== presentationId || !Array.isArray(compatibility.slides))) {
        throw new TypeError('Portable publication hook returned an invalid compatibility presentation')
      }
    }
    for (const blob of committed) if (!next.blobs.some((item) => item.sha256 === blob.sha256)) next.blobs.push(blob)
    for (const revision of revisions) if (!next.revisions.some((item) => item.id === revision.id)) next.revisions.push(revision)
    next.compatibilityOutbox = (next.compatibilityOutbox || []).filter((item) => item.presentationId !== presentationId)
    next.heads = next.heads.filter((item) => item.presentationId !== presentationId)
    next.owners = next.owners.filter((item) => item.ownerType !== 'presentation' || item.ownerId !== presentationId)
    next.heads.push(head)
    next.mutationResults.push(...imported.results)
    for (const revision of revisions) next.owners.push({ schemaVersion: RECORD_SCHEMA_VERSION, revisionId: revision.id, ownerType: 'presentation', ownerId: presentationId })
    if (compatibility) {
      const trustedImportMetadata = require('../trusted-import-metadata').getTrustedImportMetadata(next, head)
      queueCompatibilityUpsert(next, { presentationId, generation: head.generation,
        presentation: clone(compatibility), ...(trustedImportMetadata ? { trustedImportMetadata } : {}),
      })
    }
    publishedHead = clone(head)
  }, options)
  return publishedHead
}

module.exports = { exportPresentationPackage, importPresentationPackage, validatePortableBundle }
