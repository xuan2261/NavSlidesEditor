const fs = require('node:fs/promises')
const path = require('node:path')
const { BlobStore } = require('./blob-store')
const { auditBlobFiles, auditCollection } = require('./collector')
const { RECORD_SCHEMA_VERSION, validateJob, validateOwner } = require('./schemas')
const { StateStore } = require('./state-store')
const { WriterLock } = require('./writer-lock')
const lifecycle = require('./lifecycle')
const portable = require('./portable')
const originalCommit = require('./original-commit')
const importCommit = require('./import-commit')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')
const { isCertifiedSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
const { isDeepStrictEqual } = require('node:util')
const { hasExactCompatibilityHead } = require('../compatibility-view')
const { hashRecord, canonicalJson } = require('./schemas')
const { canonicalSaveSnapshot } = require('../canonical-snapshot')

const authoritativeSaveCaches = new WeakMap()

const { clone, ownPublication } = require('./publication-snapshot')

class PackageStore {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.blobs = new BlobStore(rootDir)
    this.lock = new WriterLock(rootDir)
    this.metadata = new StateStore(rootDir)
    const publish = this.metadata.publish.bind(this.metadata)
    this.metadata.publish = async (...args) => {
      if (this.activePublication) throw new Error('Publication already active')
      this.activePublication = true
      try { return await publish(...args) }
      finally { this.activePublication = false }
    }
    this.fencingEpoch = 0
    this.mutationTail = Promise.resolve()
  }
  async init() {
    await this.blobs.init()
    await this.metadata.init()
    ownPublication(this.metadata)
    this.recoveryActions = this.metadata.recoveryActions
    return this
  }
  getState() {
    // Public callers own an editable, fully detached graph, including semantics.
    return structuredClone(this.metadata.state)
  }
  getOwnedAuthorityState() {
    const { acquireOwnedAuthorityState } = require('../package-authority-snapshot')
    return acquireOwnedAuthorityState(this, this.metadata.state, this.metadata.root)
  }
  getAuthoritativeSaveSnapshot(presentationId, expectedHead, limits, expectedProjection) {
    const authorityState = this.getOwnedAuthorityState()
    const state = authorityState
    const head = state.heads.find((item) => item.presentationId === presentationId)
    if (!head || !isDeepStrictEqual(head, expectedHead)) {
      throw Object.assign(new Error('Package head changed'), { code: 'STALE_GENERATION' })
    }
    const authority = [...state.mutationResults].reverse().find((result) =>
      result.presentationId === presentationId &&
      result.packageRevisionId === head.packageRevisionId && result.sourceMap && result.projection
    )
    if (!authority) return null
    // Read callers already resolved the exact current authority in a defensive
    // snapshot. Never substitute a different historical/result projection.
    if (expectedProjection && !isDeepStrictEqual(authority.projection, expectedProjection))
      return null
    // acquireOwnedAuthorityState proves the complete publication envelope (or
    // exact content for mutable fallback callers), including history/ownership.
    // Only that owned version may retain admission identities.
    let cache = authoritativeSaveCaches.get(this)
    if (!cache) authoritativeSaveCaches.set(this, (cache = new Map()))
    let entry = cache.get(presentationId)
    const budget = hashRecord(limits || {})
    if (!entry || entry.authorityState !== authorityState) {
      // Preserve retained root fields even when non-enumerable; admission must
      // not accidentally drop a hidden semantic authority before validating it.
      const projection = authority.projection
      const hiddenPublicationFields =
        !Object.prototype.propertyIsEnumerable.call(projection, 'slides') ||
        (projection.pptxSemantic !== undefined &&
          !Object.prototype.propertyIsEnumerable.call(projection, 'pptxSemantic'))
      const raw = hiddenPublicationFields ? {
        ...projection,
        slides: projection.slides,
        ...(projection.pptxSemantic === undefined ? {} : { pptxSemantic: projection.pptxSemantic }),
      } : projection
      const { equivalentPublishedSaveSnapshot } = require('../package-authority-snapshot')
      const snapshot = equivalentPublishedSaveSnapshot(this, raw, limits) ||
        canonicalSaveSnapshot(raw, limits)
      // raw is owned/read-only; admission still charges all raw metadata and
      // output budgets. Do not clone away its certified semantic identity.
      entry = {
        authorityState, raw, snapshot, budget,
      }
      cache.set(presentationId, entry)
    } else if (entry.budget !== budget) {
      // Charge stripped raw metadata too when limits change.
      const snapshot = canonicalSaveSnapshot(entry.raw, limits)
      entry = { ...entry, snapshot, budget }
      cache.set(presentationId, entry)
    }
    return entry.snapshot
  }
  getPresentationHead(presentationId) {
    return clone(
      this.metadata.state.heads.find((head) => head.presentationId === presentationId) || null
    )
  }
  getCompatibilityState() {
    const { heads, compatibilityOutbox } = this.metadata.state
    return clone({ heads, compatibilityOutbox })
  }
  isCompatibilityWriteCurrent(write) {
    const { heads, compatibilityOutbox } = this.metadata.state
    const queued = compatibilityOutbox.find((record) => record.id === write.id)
    // Compare the entire captured write, not its id or a partial projection.
    if (!queued || !isDeepStrictEqual(queued, write)) return false
    const head = heads.find((item) => item.presentationId === write.presentationId)
    return write.operation === 'remove' ? !head : hasExactCompatibilityHead(write.presentation, head)
  }
  hasOwner(owner) {
    return this.metadata.state.owners.some(
      (item) => item.ownerType === owner.ownerType && item.ownerId === owner.ownerId
    )
  }
  hasPresentationHead(presentationId) {
    return this.metadata.state.heads.some(
      (head) => head.presentationId === presentationId
    )
  }
  hasCompatibilityPending(presentationId) {
    return this.metadata.state.compatibilityOutbox.some(
      (record) => record.presentationId === presentationId
    )
  }
  getOwnerRecords(owner) {
    return clone(
      this.metadata.state.owners.filter(
        (item) => item.ownerType === owner.ownerType && item.ownerId === owner.ownerId
      )
    )
  }
  getHistoryOwnerRecords(presentationId) {
    const prefix = `${presentationId}:`
    return clone(
      this.metadata.state.owners.filter(
        (item) => item.ownerType === 'history' && item.ownerId.startsWith(prefix)
      )
    )
  }
  async acquireWriter() {
    const record = await this.lock.acquire()
    this.fencingEpoch = record.epoch
    try {
      await this.metadata.reload()
      this.recoveryActions = this.metadata.recoveryActions
      await this.assertWriter()
      if (this.metadata.pendingMigration || this.metadata.pendingRootRecovery) {
        const isMigration = this.metadata.pendingMigration !== null
        const successor = structuredClone(this.metadata.state)
        successor.fencingEpoch = this.fencingEpoch
        await this.metadata.publish(successor, { assertWriter: () => this.assertWriter() })
        this.metadata.recoveryActions.push(
          isMigration ? 'published-state-migration-v2' : 'published-recovered-state-v2'
        )
      }
      await this.metadata.finalizeWriterRecovery(() => this.assertWriter())
      ownPublication(this.metadata)
      return this.fencingEpoch
    } catch (error) {
      await this.lock.release()
      throw error
    }
  }
  releaseWriter() {
    return this.lock.release()
  }
  async collectStateRecords({ signal, pins = [] } = {}) {
    signal?.throwIfAborted()
    const capturedPins = structuredClone(pins)
    const previous = this.mutationTail
    let release
    this.mutationTail = new Promise((resolve) => { release = resolve })
    try {
      await previous
      const assertWriter = async () => {
        await this.assertWriter()
        if (this.activePublication) throw new Error('Cannot collect during active publication')
      }
      await assertWriter()
      const { collectStateRecords } = require('./state-record-gc')
      return await collectStateRecords(this.rootDir, { signal, pins: capturedPins, assertWriter })
    } finally {
      release()
    }
  }
  async reload() {
    const previous = this.mutationTail
    let release
    this.mutationTail = new Promise((resolve) => {
      release = resolve
    })
    try {
      await previous
      await this.assertWriter()
      await this.metadata.reload()
      ownPublication(this.metadata)
      this.recoveryActions = this.metadata.recoveryActions
    } finally {
      release()
    }
  }
  assertWriter() {
    return this.lock.assertOwned(this.fencingEpoch)
  }
  async ownsWriter() {
    if (!this.lock.nonce) return false
    await this.assertWriter()
    return true
  }
  stageBlob(source, options) {
    return this.blobs.stage(source, options)
  }
  async acknowledgeCompatibilityWrites(writes, options = {}) {
    const { captureCompatibilityWrites, acknowledgeOwnedOutbox } = require('./owned-outbox-ack')
    options.signal?.throwIfAborted()
    const captured = captureCompatibilityWrites(writes)
    if (!captured.size) return 0
    const previous = this.mutationTail
    let release
    this.mutationTail = new Promise((resolve) => { release = resolve })
    try {
      await previous
      options.signal?.throwIfAborted()
      await this.assertWriter()
      options.signal?.throwIfAborted()
      const { next, acknowledged } = acknowledgeOwnedOutbox(
        this.metadata.state, captured, this.fencingEpoch
      )
      if (!acknowledged) return 0
      await this.metadata.publish(next, {
        assertWriter: () => this.assertWriter(),
        signal: options.signal,
        faultAfterIndex: options.faultAfterIndex,
        faultAfterPrepare: options.faultAfterPrepare,
        faultAfterRoot: options.faultAfterRoot,
        faultAfterCompletion: options.faultAfterCompletion,
      })
      return acknowledged
    } finally {
      release()
    }
  }
  async commitProjectionSave(params, options = {}) {
    const { captureProjectionSave, commitOwnedProjectionSave } = require('./owned-projection-save')
    options.signal?.throwIfAborted()
    const captured = captureProjectionSave(params)
    const previous = this.mutationTail
    let release
    this.mutationTail = new Promise((resolve) => { release = resolve })
    try {
      await previous
      options.signal?.throwIfAborted()
      await this.assertWriter()
      options.signal?.throwIfAborted()
      const { next, idempotent } = commitOwnedProjectionSave(
        this.metadata.state, captured, this.fencingEpoch
      )
      if (next) await this.metadata.publish(next, {
        assertWriter: () => this.assertWriter(),
        signal: options.signal,
        faultAfterIndex: options.faultAfterIndex,
        faultAfterPrepare: options.faultAfterPrepare,
        faultAfterRoot: options.faultAfterRoot,
        faultAfterCompletion: options.faultAfterCompletion,
      })
      return { idempotent }
    } finally {
      release()
    }
  }
  async mutate(mutator, options = {}) {
    const previous = this.mutationTail
    let release
    this.mutationTail = new Promise((resolve) => {
      release = resolve
    })
    try {
      await previous
      options.signal?.throwIfAborted()
      await this.assertWriter()
      options.signal?.throwIfAborted()
      if (
        options.expectedGeneration !== undefined &&
        options.expectedGeneration !== this.metadata.state.generation
      ) {
        throw Object.assign(new Error('Package store generation is stale'), {
          code: 'STALE_GENERATION',
          currentGeneration: this.metadata.state.generation,
        })
      }
      const next = clone(this.metadata.state, {
        preserveSealedResults: Boolean(options.readOnlyResults),
      })
      const changed = await mutator(next)
      options.signal?.throwIfAborted()
      if (changed === false) return this.getState()
      next.generation += 1
      next.fencingEpoch = this.fencingEpoch
      await this.metadata.publish(next, {
          assertWriter: () => this.assertWriter(),
          signal: options.signal,
          faultAfterIndex: options.faultAfterIndex,
          faultAfterPrepare: options.faultAfterPrepare,
          faultAfterRoot: options.faultAfterRoot,
          faultAfterCompletion: options.faultAfterCompletion,
      })
      return next
    } finally {
      release()
    }
  }
  async commitOriginal(source, owner, options = {}) {
    return originalCommit.commitOriginal(this, source, owner, options)
  }
  async commitImport(source, input, options = {}) {
    return importCommit.commitImport(this, source, input, options)
  }
  prepareImport(source, input, options = {}) {
    return importCommit.prepareImport(this, source, input, options)
  }
  publishImport(prepared, options = {}) {
    return importCommit.publishImport(this, prepared, options)
  }
  async rollbackImport(input) {
    return importCommit.rollbackImport(this, input)
  }
  async advanceMatrixAuthorityEpoch(options = {}) {
    await this.mutate((next) => {
      const matrixAuthorityEpoch = next.matrixAuthorityEpoch + 1
      next.matrixAuthorityEpoch = matrixAuthorityEpoch
      next.heads = next.heads.map((head) => ({
        ...head,
        matrixAuthorityEpoch,
        matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, matrixAuthorityEpoch),
      }))
    }, { ...options, readOnlyResults: true })
    return this.metadata.state.matrixAuthorityEpoch
  }
  async addOwner(revisionId, owner, options) {
    validateOwner(owner)
    if (!this.metadata.state.revisions.some((revision) => revision.id === revisionId)) {
      throw new Error('Unknown package revision')
    }
    await this.mutate((next) => {
      next.owners.push({ schemaVersion: RECORD_SCHEMA_VERSION, revisionId, ...owner })
    }, { ...(options || {}), readOnlyResults: true })
  }
  async releaseOwner(owner) {
    validateOwner(owner)
    const owned = this.metadata.state.owners.some(
      (item) => item.ownerType === owner.ownerType && item.ownerId === owner.ownerId
    )
    if (!owned) return false
    await this.mutate((next) => {
      next.owners = next.owners.filter(
        (item) => item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId
      )
      if (owner.ownerType === 'permanent-delete') {
        const presId = owner.ownerId
        const stillReferenced =
          next.heads.some((h) => h.presentationId === presId) ||
          next.owners.some(
            (item) =>
              item.ownerId === presId ||
              item.retainedHead?.presentationId === presId ||
              (item.ownerType === 'history' && item.ownerId.startsWith(`${presId}:`))
          )
        if (!stillReferenced) {
          next.mutationResults = next.mutationResults.filter(
            (result) => result.presentationId !== presId
          )
        }
      }
    }, { readOnlyResults: true })
    return true
  }
  async duplicatePresentationOwner(sourceId, destinationId, options = {}) {
    return lifecycle.duplicatePresentationOwner(this, sourceId, destinationId, options)
  }
  async instantiateRetainedHead(retainedOwner, destinationId, options = {}) {
    return lifecycle.instantiateRetainedHead(this, retainedOwner, destinationId, options)
  }
  async quarantinePresentation(presentationId, options = {}) {
    return lifecycle.quarantinePresentation(this, presentationId, options)
  }
  async restoreQuarantinedHead(retainedOwner, presentationId, options = {}) {
    return lifecycle.restoreQuarantinedHead(this, retainedOwner, presentationId, options)
  }
  async retainHead(owner, presentationId, options = {}) {
    return lifecycle.retainHead(this, owner, presentationId, options)
  }
  getRestorableHead(presentationId, retainedOwner) {
    return lifecycle.getRestorableHead(this, presentationId, retainedOwner)
  }
  async restoreForward(presentationId, retainedOwner, options = {}) {
    return lifecycle.restoreForward(this, presentationId, retainedOwner, options)
  }
  exportPresentationPackage(presentationId, options = {}) {
    return portable.exportPresentationPackage(this, presentationId, options)
  }
  importPresentationPackage(bundle, presentationId, options = {}) {
    return portable.importPresentationPackage(this, bundle, presentationId, options)
  }
  async putJob(input) {
    const job = validateJob({
      schemaVersion: RECORD_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      ...input,
    })
    await this.mutate((next) => {
      next.jobs = next.jobs.filter((item) => item.id !== job.id)
      next.jobs.push(job)
      if (job.provisionalOwner) {
        next.leases = next.leases.filter((lease) => lease.jobId !== job.id)
        next.leases.push({
          schemaVersion: RECORD_SCHEMA_VERSION,
          jobId: job.id,
          provisional: true,
          ...job.provisionalOwner,
        })
      }
    }, { readOnlyResults: true })
    return job
  }
  getJob(id) {
    const job = this.metadata.state.jobs.find((item) => item.id === id)
    return job ? clone(job) : null
  }
  listBlobFiles() {
    return this.blobs.list()
  }
  readBlob(sha256) {
    return this.blobs.read(sha256)
  }
  async readOriginal(revisionId) {
    const revision = this.metadata.state.revisions.find((item) => item.id === revisionId)
    return revision ? this.readBlob(revision.blobSha256) : null
  }
  auditCollection() {
    return auditCollection(this.metadata.state)
  }
  async auditPhysicalCollection() {
    return auditBlobFiles(this.metadata.state, await this.blobs.list())
  }
  async migrateLegacyOriginal(meta, owner) {
    const legacyPath = path.join(this.rootDir, 'pptx-originals', `${meta.id}.pptx`)
    const exactBytes = await fs.readFile(legacyPath)
    return this.commitOriginal(exactBytes, owner, { uploadedAt: meta.uploadedAt })
  }
}

async function openPackageStore({ rootDir }) {
  if (!path.isAbsolute(rootDir)) throw new TypeError('Package store root must be absolute')
  return new PackageStore(rootDir).init()
}

module.exports = { PackageStore, openPackageStore }
