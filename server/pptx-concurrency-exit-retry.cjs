// Disposable current durable-receipt HTTP proof. No receipt authority is removed or copied.
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const { api, consumers, digest, fixture, sha, snapshot } = require('./pptx-concurrency-exit-fixture.cjs')
module.exports = async function lostResponse(ctx, record) {
  const input = await fixture(ctx, 'lost-response')
  const before = ctx.store.getState()
  const head = before.heads.find(item => item.presentationId === input.id)
  const body = { aggregateGeneration: head.generation, baseRevisionId: head.packageRevisionId,
    slides: structuredClone(input.projection.slides) }
  body.slides[0].elements[0].content = '<p>Lost response committed</p>'
  const key = 'p08-current-receipt-response-loss'
  const evidence = record.P0807 = { status: 'started', presentationId: input.id, key,
    before: await snapshot(ctx, [input.id]), requestSha256: digest(body) }
  const json = ctx.app.response.json
  let dropped = false, attempted
  ctx.app.response.json = function observedResponse(value) {
    if (!dropped && this.req.method === 'PUT' && this.req.originalUrl === `/api/presentations/${input.id}` &&
        this.req.get('Idempotency-Key') === key && this.statusCode === 200 && value.saveOutcome === 'committed') {
      attempted = structuredClone(value)
      dropped = true
      this.destroy() // A real transport reset only after the production route's durable commit/drain.
      return this
    }
    return json.call(this, value)
  }
  try {
    await assert.rejects(api(ctx.base, `/api/presentations/${input.id}`, { method: 'PUT', body, key }),
      error => error.code === 'ECONNRESET')
  } finally { ctx.app.response.json = json }
  assert.equal(dropped, true, 'Commit response boundary was not reached')
  assert.equal(attempted.aggregateGeneration, head.generation + 1)
  const committed = ctx.store.getState()
  const outcome = committed.mutationResults.find(item => item.presentationId === input.id && item.idempotencyKey === key)
  assert(outcome, 'Current durable receipt missing after socket loss')
  assert.equal(outcome.operation, 'projection-save')
  assert.equal(outcome.generation, head.generation + 1)
  assert.equal(outcome.packageRevisionId, head.packageRevisionId)
  assert.equal(outcome.state, 'pending-edited-export')
  assert.match(outcome.requestHash, /^[a-f0-9]{64}$/u)
  assert.deepEqual(committed.owners, before.owners)
  assert.deepEqual(committed.jobs, before.jobs)
  assert.equal(committed.mutationResults.length, before.mutationResults.length + 1)
  assert.equal(committed.revisions.length, before.revisions.length)
  assert.deepEqual(committed.candidateBlobs, before.candidateBlobs)
  const root = await fs.readFile(`${ctx.storage.DATA_DIR}/state-root.json`)
  const rows = await ctx.storage.readPresentations()
  const uploadHashes = await fs.readFile(ctx.storage.UPLOAD_HASHES_FILE)
  evidence.committed = await snapshot(ctx, [input.id])
  evidence.attemptedResponseSha256 = digest(attempted)
  evidence.durableResultSha256 = digest(outcome)
  evidence.consumersBeforeRetry = await consumers(ctx, input)
  const replay = (await api(ctx.base, `/api/presentations/${input.id}`, { method: 'PUT', body, key })).body
  assert.equal(replay.saveOutcome, 'idempotent-replay')
  assert.deepEqual({ ...replay, saveOutcome: 'committed' }, attempted)
  assert.deepEqual(ctx.store.getState(), committed)
  assert.deepEqual(await ctx.storage.readPresentations(), rows)
  assert.deepEqual(await fs.readFile(`${ctx.storage.DATA_DIR}/state-root.json`), root)
  assert.deepEqual(await fs.readFile(ctx.storage.UPLOAD_HASHES_FILE), uploadHashes)
  evidence.afterRetry = await snapshot(ctx, [input.id])
  evidence.consumersAfterRetry = await consumers(ctx, input)
  assert.deepEqual(evidence.afterRetry, evidence.committed)
  assert.deepEqual(evidence.consumersAfterRetry, evidence.consumersBeforeRetry)
  evidence.replayedResultSha256 = digest({ ...replay, saveOutcome: 'committed' })
  evidence.rootBytesSha256 = sha(root)
  const conflict = await api(ctx.base, `/api/presentations/${input.id}`, {
    method: 'PUT', body: { ...body, slides: [] }, key, status: 409 })
  assert.equal(conflict.body.code, 'IDEMPOTENCY_KEY_CONFLICT')
  assert.deepEqual(ctx.store.getState(), committed)
  const next = await api(ctx.base, `/api/presentations/${input.id}`, { method: 'PUT',
    body: { ...body, aggregateGeneration: head.generation + 1, title: 'Successor' }, key: 'p08-successor' })
  assert.equal(next.body.aggregateGeneration, head.generation + 2)
  const successor = ctx.store.getState()
  const stale = await api(ctx.base, `/api/presentations/${input.id}`, { method: 'PUT', body, key, status: 409 })
  assert.equal(stale.body.code, 'STALE_GENERATION')
  assert.deepEqual(ctx.store.getState(), successor)
  evidence.successor = await snapshot(ctx, [input.id])
  evidence.fidelity = (await api(ctx.base, `/api/presentations/${input.id}/pptx-fidelity`)).body
  evidence.status = 'passed'
  evidence.scope = 'Native projection-save current receipt, not validated-edited-export idempotency or Office validation'
}
