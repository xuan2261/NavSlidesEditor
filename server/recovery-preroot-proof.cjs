// Test-only P09-01: actual prepareImport blob commit, before publishImport authority.
const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { auditBlobFiles } = require('./services/pptx-import/package-store/collector')
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
async function disk(root, name) { return fs.readFile(path.join(root, 'data', name)) }
async function authority(root) {
  const rootBytes = await disk(root, 'state-root.json')
  const pointer = JSON.parse(rootBytes)
  const stateBytes = await disk(root, pointer.stateFile)
  return { pointer, state: JSON.parse(stateBytes), rootSha256: sha(rootBytes), stateSha256: sha(stateBytes) }
}
async function prepareFence(store, source, input, receipt, root, url) {
  await store.mutate(() => {}) // Establish a real committed predecessor, never fabricate a root.
  const prior = await authority(root)
  const rows = await disk(root, 'presentations.json')
  const winner = await fetch(`${url}/api/presentations/retained-winner`)
  assert.equal(winner.status, 200)
  receipt.prior = { rootSha256: prior.rootSha256, stateSha256: prior.stateSha256,
    presentationsSha256: sha(rows), winnerHttpSha256: sha(Buffer.from(await winner.arrayBuffer())),
    uploadLedgerSha256: sha(await disk(root, 'upload-hashes.json')) }
  const prepared = await store.prepareImport(source, input)
  receipt.presentationId = prepared.presentationId
  receipt.revisionId = prepared.revision.id
  receipt.blobSha256 = prepared.blob.sha256
  receipt.fence = 'prepareImport-returned-after-immutable-blob-commit-before-publishImport'
  assert.equal(receipt.blobSha256, receipt.originalSha256)
  assert.equal(sha(await disk(root, `blobs/${receipt.blobSha256}.blob`)), receipt.originalSha256)
  const after = await authority(root)
  assert.deepEqual(after, prior)
  assert.equal(sha(await disk(root, 'presentations.json')), receipt.prior.presentationsSha256)
  assert.ok(!after.state.heads.some((head) => head.presentationId === receipt.presentationId))
  assert.ok(!after.state.jobs.some((job) => job.id === receipt.jobId))
  assert.ok(!after.state.compatibilityOutbox.some((write) => write.presentationId === receipt.presentationId))
  receipt.auditBefore = await store.auditPhysicalCollection()
  assert.equal(receipt.auditBefore.mode, 'audit-only')
  assert.equal(receipt.auditBefore.physicalDeletionEnabled, false)
  assert.ok(receipt.auditBefore.candidates.includes(receipt.blobSha256))
  return prepared
}
async function assertRestart({ root, url, intent, request, sample }) {
  const current = await authority(root)
  assert.equal(current.rootSha256, intent.prior.rootSha256)
  assert.equal(current.stateSha256, intent.prior.stateSha256)
  assert.equal(sha(await disk(root, 'presentations.json')), intent.prior.presentationsSha256)
  assert.equal(sha(await disk(root, 'upload-hashes.json')), intent.prior.uploadLedgerSha256)
  assert.ok(!current.state.heads.some((head) => head.presentationId === intent.presentationId))
  assert.ok(!current.state.jobs.some((job) => job.id === intent.jobId))
  assert.ok(!current.state.compatibilityOutbox.some((write) => write.presentationId === intent.presentationId))
  const listed = await request('/api/presentations')
  assert.equal(listed.status, 200)
  assert.deepEqual(listed.json().map((row) => row.id), ['retained-winner'])
  const winner = await request('/api/presentations/retained-winner')
  assert.equal(winner.status, 200)
  assert.equal(sha(winner.bytes), intent.prior.winnerHttpSha256)
  for (const target of [`/api/presentations/${intent.presentationId}`,
    `/api/presentations/${intent.presentationId}/pptx-original`, `/api/pptx/jobs/${intent.jobId}`]) {
    const response = await request(target)
    assert.equal(response.status, 404)
    assert.notEqual(response.json().status, 'done')
    assert.notEqual(sha(response.bytes), intent.originalSha256)
  }
  const admission = await request('/api/project-imports/preflight', { method: 'POST', headers: { Origin: url } })
  assert.equal(admission.status, 400)
  assert.equal(admission.json().error, 'Project file is required')
  assert.equal((await request('/health/ready')).status, 200)
  const original = await disk(root, `blobs/${intent.blobSha256}.blob`)
  assert.equal(sha(original), intent.originalSha256)
  assert.equal(sha(await fs.readFile(path.join(root, 'original.pptx'))), intent.originalSha256)
  const audit = auditBlobFiles(current.state, await fs.readdir(path.join(root, 'data', 'blobs')))
  assert.equal(audit.mode, 'audit-only')
  assert.equal(audit.physicalDeletionEnabled, false)
  assert.ok(audit.candidates.includes(intent.blobSha256))
  sample.preRoot = { rootSha256: current.rootSha256, stateSha256: current.stateSha256,
    presentationsSha256: intent.prior.presentationsSha256, winnerHttpSha256: sha(winner.bytes),
    originalSha256: sha(original), originalByteLength: original.length, audit }
  sample.packageStateSha256 = current.stateSha256
}
module.exports = { prepareFence, assertRestart }
