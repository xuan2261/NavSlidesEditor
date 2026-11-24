// Unrelated-deck progress and guaranteed real mutation-lock overlap are separate oracles.
const assert = require('node:assert/strict')
const { api, bounded, consumers, deferred, fixture, snapshot } = require('./pptx-concurrency-exit-fixture.cjs')
const serialized = require('./pptx-concurrency-exit-barrier.cjs')
function unchangedSources(before, after) {
  for (const name of ['heads', 'owners', 'jobs', 'results', 'rows', 'uploadHashesSha256']) {
    assert.deepEqual(after[name], before[name], `Cross-deck source leak: ${name}`)
  }
}
function checkCopy(store, before, sourceId, destinationId) {
  const state = store.getState(), source = before.heads.find(head => head.presentationId === sourceId)
  const copy = state.heads.find(head => head.presentationId === destinationId)
  assert(copy, `Missing destination ${destinationId}`)
  assert.equal(copy.generation, 1)
  assert.equal(copy.originalRevisionId, source.originalRevisionId)
  assert.equal(copy.packageRevisionId, source.packageRevisionId)
  const expected = [...new Set([copy.originalRevisionId, copy.packageRevisionId,
    copy.projectionRevisionId, copy.sourceMapRevisionId, copy.journalRevisionId].filter(Boolean))].sort()
  const owners = state.owners.filter(owner => owner.ownerType === 'presentation' && owner.ownerId === destinationId)
  assert.equal(owners.length, expected.length)
  assert.deepEqual(owners.map(owner => owner.revisionId).sort(), expected)
  const result = state.mutationResults.find(item => item.presentationId === destinationId)
  assert(result)
  assert.equal(result.projection.id, destinationId)
  assert.equal(result.sourceMap.presentationId, destinationId)
  assert.equal(result.generation, 1)
  assert.equal(result.projection.slides[0].elements.find(element => element.id === 'image').src,
    state.mutationResults.find(item => item.presentationId === sourceId).projection.slides[0].elements.find(element => element.id === 'image').src)
  return { sourceId, destinationId, head: copy, owners, operationId: result.idempotencyKey }
}
module.exports = async function unrelated(ctx, record) {
  const a = await fixture(ctx, 'unrelated-a'), b = await fixture(ctx, 'unrelated-b')
  assert.notEqual(a.media.url, b.media.url)
  const ids = [a.id, b.id]
  const evidence = record.P0812 = { status: 'started', sources: ids, before: await snapshot(ctx, ids),
    consumersBefore: await Promise.all([consumers(ctx, a), consumers(ctx, b)]), boundMs: 5000 }
  const entered = deferred(), release = deferred()
  const copyA = 'p08-admission-copy-a'
  let operation, aDone = false, failure
  try {
    operation = ctx.store.duplicatePresentationOwner(a.id, copyA, {
      admissionPreflight: async () => { entered.resolve(); await bounded(release.promise, 'A admission release') },
    }).then(value => { aDone = true; return { value } }, error => ({ error }))
    await bounded(entered.promise, 'A lifecycle admission')
    const copyB = (await api(ctx.base, `/api/presentations/${b.id}/duplicate`, { method: 'POST', status: 201 })).body.id
    assert.equal(aDone, false)
    assert(!ctx.store.getState().heads.some(head => head.presentationId === copyA))
    evidence.admissionDuring = await snapshot(ctx, ids)
    unchangedSources(evidence.before, evidence.admissionDuring)
    evidence.admissionConsumers = await Promise.all([consumers(ctx, a), consumers(ctx, b)])
    assert.deepEqual(evidence.admissionConsumers, evidence.consumersBefore)
    evidence.httpCopyBConsumers = await consumers(ctx, b, copyB)
    evidence.admissionCopyB = checkCopy(ctx.store, evidence.before, b.id, copyB)
    evidence.admissionOrder = ['A-paused-in-real-admission', 'B-HTTP-duplicate-completed', 'source-consumers-completed', 'A-release']
  } catch (error) { failure = error }
  finally {
    release.resolve()
    if (operation) {
      try {
        const completed = await bounded(operation, 'A lifecycle completion')
        if (completed.error) failure ||= completed.error
        else assert.equal(completed.value.presentationId, copyA)
      } catch (error) { failure ||= error }
    }
  }
  if (failure) throw failure
  evidence.admissionCopyA = checkCopy(ctx.store, evidence.before, a.id, copyA)
  evidence.afterAdmission = await snapshot(ctx, ids)
  unchangedSources(evidence.before, evidence.afterAdmission)
  const serialA = 'p08-serialized-copy-a', serialB = 'p08-serialized-copy-b'
  evidence.lockOverlap = await serialized(ctx, { aId: serialA, bId: serialB,
    first: () => ctx.store.duplicatePresentationOwner(a.id, serialA),
    second: () => ctx.store.duplicatePresentationOwner(b.id, serialB),
    during: async () => {
      const held = await snapshot(ctx, ids)
      unchangedSources(evidence.before, held)
      const read = await Promise.all([consumers(ctx, a), consumers(ctx, b)])
      assert.deepEqual(read, evidence.consumersBefore)
      return { sources: held, consumers: read }
    },
  })
  evidence.serializedCopies = [checkCopy(ctx.store, evidence.before, a.id, serialA),
    checkCopy(ctx.store, evidence.before, b.id, serialB)]
  evidence.after = await snapshot(ctx, ids)
  unchangedSources(evidence.before, evidence.after)
  evidence.consumersAfter = await Promise.all([consumers(ctx, a), consumers(ctx, b)])
  assert.deepEqual(evidence.consumersAfter, evidence.consumersBefore)
  evidence.allCopyAuthority = await snapshot(ctx, [copyA, evidence.admissionCopyB.destinationId, serialA, serialB])
  evidence.scope = 'Real package lifecycle admission/publication, one public HTTP duplicate and real HTTP source/copy-B consumers; direct package-only copies do not assert compatibility publication'
  evidence.status = 'passed'
}
