const fs = require('node:fs/promises')
const path = require('node:path')
const { BlobStore } = require('./blob-store')
const { auditBlobFiles, auditCollection } = require('./collector')
const { SCHEMA_VERSION, validateJob, validateOwner } = require('./schemas')
const { StateStore } = require('./state-store')
const { WriterLock } = require('./writer-lock')
const lifecycle = require('./lifecycle')
const portable = require('./portable')
const originalCommit = require('./original-commit')
const importCommit = require('./import-commit')
const { createMatrixAuthoritySubjects } = require('../canonical-feature-matrix')

function clone(value) {
  return structuredClone(value)
}

class PackageStore {
  constructor(rootDir) {
    this.rootDir = rootDir
    this.blobs = new BlobStore(rootDir)
    this.lock = new WriterLock(rootDir)
    this.metadata = new StateStore(rootDir)
    this.fencingEpoch = 0
  }
async init() {
    await this.blobs.init()
    await this.metadata.init()
    this.recoveryActions = this.metadata.recoveryActions
    return this
  }
getState() {
    return clone(this.metadata.state)
  }
async acquireWriter() {
    const record = await this.lock.acquire()
    this.fencingEpoch = record.epoch
    try {
      await this.metadata.reload()
      this.recoveryActions = this.metadata.recoveryActions
      await this.assertWriter()
      return record
    } catch (error) {
      await this.lock.release().catch(() => {})
      throw error
    }
  }
releaseWriter() {
    return this.lock.release()
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
async mutate(mutator, options = {}) {
    await this.assertWriter()
    if (options.expectedGeneration !== undefined &&
        options.expectedGeneration !== this.metadata.state.generation) {
      throw Object.assign(new Error('Package store generation is stale'), {
        code: 'STALE_GENERATION',
        currentGeneration: this.metadata.state.generation,
      })
    }
    const next = this.getState()
    mutator(next)
    next.generation += 1
    next.fencingEpoch = this.fencingEpoch
    await this.metadata.publish(next, {
      assertWriter: () => this.assertWriter(),
      faultAfterIndex: options.faultAfterIndex,
      faultAfterPrepare: options.faultAfterPrepare,
      faultAfterRoot: options.faultAfterRoot,
      faultAfterCompletion: options.faultAfterCompletion,
    })
    return next
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
    }, options)
    return this.metadata.state.matrixAuthorityEpoch
  }
async addOwner(revisionId, owner, options) {
    validateOwner(owner)
    if (!this.metadata.state.revisions.some((revision) => revision.id === revisionId)) {
      throw new Error('Unknown package revision')
    }
    await this.mutate((next) => {
      next.owners.push({ schemaVersion: SCHEMA_VERSION, revisionId, ...owner })
    }, options)
  }
async releaseOwner(owner) {
    validateOwner(owner)
    await this.mutate((next) => {
      next.owners = next.owners.filter(
        (item) => item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId
      )
    })
  }
async duplicatePresentationOwner(sourceId, destinationId, options = {}) {
    return lifecycle.duplicatePresentationOwner(this, sourceId, destinationId, options)
  }
async quarantinePresentation(presentationId, options = {}) {
    return lifecycle.quarantinePresentation(this, presentationId, options)
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
exportPresentationPackage(presentationId) {
    return portable.exportPresentationPackage(this, presentationId)
  }
importPresentationPackage(bundle, presentationId, options = {}) {
    return portable.importPresentationPackage(this, bundle, presentationId, options)
  }
async putJob(input) {
    const job = validateJob({
      schemaVersion: SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      ...input,
    })
    await this.mutate((next) => {
      next.jobs = next.jobs.filter((item) => item.id !== job.id)
      next.jobs.push(job)
      if (job.provisionalOwner) {
        next.leases = next.leases.filter((lease) => lease.jobId !== job.id)
        next.leases.push({
          schemaVersion: SCHEMA_VERSION,
          jobId: job.id,
          provisional: true,
          ...job.provisionalOwner,
        })
      }
    })
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
