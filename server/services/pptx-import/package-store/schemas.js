const crypto = require('node:crypto')
const { MUTATION_OPERATIONS } = require('../mutation-operation-scope')

const SCHEMA_VERSION = 1
const SHA256_RE = /^[a-f0-9]{64}$/
const OWNER_TYPES = new Set([
  'presentation',
  'history',
  'template',
  'job',
  'portable',
  'permanent-delete',
])
const JOB_KINDS = new Set(['import', 'export', 'provider'])
const JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled'])

function assert(condition, message) {
  if (!condition) throw new TypeError(message)
}

function validateOwner(owner) {
  assert(owner && OWNER_TYPES.has(owner.ownerType), 'Invalid owner type')
  assert(typeof owner.ownerId === 'string' && owner.ownerId.length > 0, 'Invalid owner id')
  return owner
}

function validateBlob(blob) {
  assert(blob?.schemaVersion === SCHEMA_VERSION, 'Invalid blob schema version')
  assert(SHA256_RE.test(blob.sha256), 'Invalid blob SHA-256')
  assert(Number.isSafeInteger(blob.byteLength) && blob.byteLength >= 0, 'Invalid blob byte length')
  return blob
}

function validateRevision(revision) {
  assert(revision?.schemaVersion === SCHEMA_VERSION, 'Invalid revision schema version')
  assert(typeof revision.id === 'string' && revision.id.length > 0, 'Invalid revision id')
  assert(Number.isSafeInteger(revision.ordinal) && revision.ordinal >= 0, 'Invalid revision ordinal')
  assert(SHA256_RE.test(revision.blobSha256), 'Invalid revision blob SHA-256')
  return revision
}

function validateCandidateBlob(candidate) {
  assert(candidate?.schemaVersion === SCHEMA_VERSION, 'Invalid candidate blob schema version')
  assert(typeof candidate.id === 'string' && candidate.id.length > 0, 'Invalid candidate blob id')
  assert(SHA256_RE.test(candidate.sha256), 'Invalid candidate blob SHA-256')
  assert(Number.isSafeInteger(candidate.byteLength) && candidate.byteLength >= 0,
    'Invalid candidate blob byte length')
  assert(typeof candidate.createdAt === 'string' && candidate.createdAt.length > 0,
    'Invalid candidate blob timestamp')
  return candidate
}

function validateImportOutcome(job) {
  const fields = ['outcomeRevisionId', 'outcomeGeneration', 'outcomeHeadHash']
  const supplied = fields.filter((field) => job[field] !== undefined)
  if (!supplied.length) return
  assert(job.kind === 'import', 'Invalid import outcome identity')
  assert(supplied.length === fields.length, 'Import outcome identity must be complete')
  assert(typeof job.presentationId === 'string' && job.presentationId,
    'Invalid import outcome presentation id')
  assert(typeof job.outcomeRevisionId === 'string' && job.outcomeRevisionId,
    'Invalid import outcome revision id')
  assert(Number.isSafeInteger(job.outcomeGeneration) && job.outcomeGeneration > 0,
    'Invalid import outcome generation')
  assert(SHA256_RE.test(job.outcomeHeadHash), 'Invalid import outcome head hash')
}

function validateJob(job) {
  assert(job?.schemaVersion === SCHEMA_VERSION, 'Invalid job schema version')
  assert(typeof job.id === 'string' && job.id.length > 0, 'Invalid job id')
  assert(JOB_KINDS.has(job.kind), 'Invalid job kind')
  assert(JOB_STATUSES.has(job.status), 'Invalid job status')
  assert(SHA256_RE.test(job.capabilityHash), 'Invalid capability hash')
  // Optional control-plane bearer hash (job status/SSE/DELETE). Distinct from package capabilityHash.
  if (job.controlCapabilityHash !== undefined && job.controlCapabilityHash !== null) {
    assert(SHA256_RE.test(job.controlCapabilityHash), 'Invalid control capability hash')
  }
  validateImportOutcome(job)
  if (job.provisionalOwner) validateOwner(job.provisionalOwner)
  return job
}

function validateHead(head) {
  assert(head?.schemaVersion === SCHEMA_VERSION, 'Invalid package head schema version')
  assert(typeof head.presentationId === 'string' && head.presentationId, 'Invalid presentation id')
  assert(typeof head.originalRevisionId === 'string', 'Invalid original revision pointer')
  assert(Number.isSafeInteger(head.generation) && head.generation > 0, 'Invalid head generation')
  assert(Number.isSafeInteger(head.fencingEpoch) && head.fencingEpoch > 0, 'Invalid fencing epoch')
  assert(Number.isSafeInteger(head.matrixAuthorityEpoch) && head.matrixAuthorityEpoch > 0,
    'Invalid head matrix authority epoch')
  if (head.pendingJournalHash !== undefined) {
    assert(SHA256_RE.test(head.pendingJournalHash), 'Invalid pending journal hash')
  }
  return head
}

function validateLease(lease) {
  assert(lease?.schemaVersion === SCHEMA_VERSION, 'Invalid lease schema version')
  assert(typeof lease.jobId === 'string' && lease.jobId, 'Invalid lease job id')
  validateOwner(lease)
  return lease
}

function validateManifest(manifest) {
  assert(manifest?.schemaVersion === SCHEMA_VERSION, 'Invalid OPC manifest schema version')
  assert(SHA256_RE.test(manifest.packageSha256), 'Invalid package SHA-256')
  assert(Array.isArray(manifest.parts), 'Invalid OPC parts')
  assert(Array.isArray(manifest.relationships), 'Invalid OPC relationships')
  return manifest
}

function validateStateRoot(root) {
  assert(root?.schemaVersion === SCHEMA_VERSION, 'Invalid state root schema version')
  assert(typeof root.transactionId === 'string' && root.transactionId, 'Invalid transaction id')
  assert(SHA256_RE.test(root.stateHash), 'Invalid state index hash')
  assert(Number.isSafeInteger(root.storeGeneration), 'Invalid store generation')
  assert(Number.isSafeInteger(root.fencingEpoch), 'Invalid root fencing epoch')
  return root
}

function validateState(state) {
  assert(state?.schemaVersion === SCHEMA_VERSION, 'Invalid package state schema version')
  assert(Number.isSafeInteger(state.generation) && state.generation >= 0, 'Invalid state generation')
  assert(Number.isSafeInteger(state.matrixAuthorityEpoch) && state.matrixAuthorityEpoch > 0,
    'Invalid matrix authority epoch')
  if (state.mutationResults === undefined) state.mutationResults = []
  if (state.compatibilityOutbox === undefined) state.compatibilityOutbox = []
  if (state.compatibilityDeadLetter === undefined) state.compatibilityDeadLetter = []
  if (state.candidateBlobs === undefined) state.candidateBlobs = []
  for (const key of ['blobs', 'revisions', 'heads', 'owners', 'leases', 'jobs', 'mutationResults', 'compatibilityOutbox', 'compatibilityDeadLetter', 'candidateBlobs']) {
    assert(Array.isArray(state[key]), `Invalid state ${key} index`)
  }
  state.blobs.forEach(validateBlob)
  state.candidateBlobs.forEach(validateCandidateBlob)
  state.revisions.forEach(validateRevision)
  state.heads.forEach(validateHead)
  state.owners.forEach(validateOwner)
  state.leases.forEach(validateLease)
  state.jobs.forEach(validateJob)
  state.mutationResults.forEach((result) => {
    assert(result?.schemaVersion === SCHEMA_VERSION, 'Invalid mutation result schema version')
    assert(typeof result.idempotencyKey === 'string' && result.idempotencyKey, 'Invalid idempotency key')
    if (result.operation !== undefined) {
      assert(Object.values(MUTATION_OPERATIONS).includes(result.operation), 'Invalid mutation operation')
    }
    assert(typeof result.presentationId === 'string' && result.presentationId, 'Invalid result presentation')
    assert(result.requestHash === undefined || SHA256_RE.test(result.requestHash), 'Invalid mutation request hash')
  })
  state.compatibilityOutbox.forEach((record) => {
    assert(record?.schemaVersion === SCHEMA_VERSION, 'Invalid compatibility outbox schema version')
    assert(typeof record.id === 'string' && record.id, 'Invalid compatibility outbox id')
    assert(typeof record.presentationId === 'string' && record.presentationId, 'Invalid compatibility presentation id')
    assert(Number.isSafeInteger(record.generation) && record.generation > 0, 'Invalid compatibility generation')
    assert(record.operation === 'upsert' || record.operation === 'remove', 'Invalid compatibility operation')
    if (record.operation === 'upsert') {
      assert(record.presentation?.id === record.presentationId, 'Invalid compatibility presentation')
    }
  })
  return state
}

function createEmptyState(fencingEpoch = 0) {
  return {
    schemaVersion: SCHEMA_VERSION,
    generation: 0,
    fencingEpoch,
    matrixAuthorityEpoch: 1,
    blobs: [],
    revisions: [],
    heads: [],
    owners: [],
    leases: [],
    jobs: [],
    mutationResults: [],
    compatibilityOutbox: [],
    compatibilityDeadLetter: [],
    candidateBlobs: [],
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hashRecord(value) {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')
}

module.exports = {
  SCHEMA_VERSION,
  createEmptyState,
  hashRecord,
  validateBlob,
  validateHead,
  validateJob,
  validateLease,
  validateManifest,
  validateOwner,
  validateRevision,
  validateState,
  validateStateRoot,
}
