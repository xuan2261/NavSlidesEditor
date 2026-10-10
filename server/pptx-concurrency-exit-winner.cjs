// Same-destination real publication contention and late loser compensation.
const assert = require('node:assert/strict')
const { api, consumers, fixture, sha, snapshot } = require('./pptx-concurrency-exit-fixture.cjs')
const serialized = require('./pptx-concurrency-exit-barrier.cjs')
module.exports = async function winnerLoser(ctx, record) {
  const winner = await fixture(ctx, 'contended-winner', { preparedOnly: true })
  const loser = await fixture(ctx, 'contended-loser', { preparedOnly: true,
    presentationId: winner.id, media: winner.media })
  assert.notEqual(winner.media.url, loser.media.url, 'Pending media must be isolated before publication')
  const evidence = record.winnerLoser = { status: 'started', scenarios: ['P08-01', 'P08-02', 'P08-03', 'P08-13'],
    presentationId: winner.id, winnerJobId: winner.jobId, loserJobId: loser.jobId,
    winnerOriginalSha256: sha(winner.bytes), loserOriginalSha256: sha(loser.bytes),
    sharedMediaSha256: sha(winner.media.bytes), before: await snapshot(ctx, [winner.id]) }
  evidence.overlap = await serialized(ctx, { aId: winner.id, bId: winner.id, rejectSecond: true,
    first: () => ctx.store.publishImport(winner.prepared), second: () => ctx.store.publishImport(loser.prepared),
    during: async () => {
      const observed = await snapshot(ctx, [winner.id])
      assert.equal(observed.heads.length, 0)
      assert.equal(observed.owners.length, 0)
      assert.equal(observed.results.length, 0)
      return observed
    },
  })
  await ctx.ownership.commitOwner(winner.jobId, winner.id, { scope: 'pptx-import' })
  await ctx.runtime.drainPackageCompatibilityOutbox()
  evidence.winnerBeforeCompensation = await snapshot(ctx, [winner.id])
  evidence.consumersBeforeCompensation = await consumers(ctx, winner)
  assert.equal(evidence.winnerBeforeCompensation.heads.length, 1)
  assert.equal(evidence.winnerBeforeCompensation.heads[0].generation, 1)
  assert.equal(evidence.winnerBeforeCompensation.jobs.length, 1)
  assert.equal(evidence.winnerBeforeCompensation.jobs[0].id, winner.jobId)
  assert.equal(evidence.winnerBeforeCompensation.results.length, 1)
  const authority = ctx.store.getState()
  await assert.rejects(ctx.runtime.withPackageStore(store => store.rollbackImport({
    jobId: loser.jobId, presentationId: winner.id,
  })), error => error.code === 'PACKAGE_IMPORT_COMMIT_FAILED')
  assert.deepEqual(ctx.store.getState(), authority)
  evidence.stalePackageCompensationCode = 'PACKAGE_IMPORT_COMMIT_FAILED'
  // A losing owner's retry retains its private placement even after a peer commits the bytes.
  const pendingReplay = await ctx.ownership.placeMedia({ ownerId: loser.jobId, scope: 'pptx-import',
    bytes: winner.media.bytes, originalName: 'shared.png', mimeType: 'image/png', sourceKey: 'late-reuse' })
  assert.equal(pendingReplay.ownership, 'new')
  assert.equal(pendingReplay.deduped, true)
  assert.equal(`/uploads/${pendingReplay.filename}`, loser.media.url)
  evidence.pendingReplay = { ownership: pendingReplay.ownership, filename: pendingReplay.filename }
  // Only a consumer without a pending placement borrows the winner's committed file.
  const reuseOwner = `${loser.jobId}-committed-reuse`
  const reuse = await ctx.ownership.placeMedia({ ownerId: reuseOwner, scope: 'pptx-import',
    bytes: winner.media.bytes, originalName: 'shared.png', mimeType: 'image/png', sourceKey: 'late-reuse' })
  assert.equal(reuse.ownership, 'reused')
  assert.equal(`/uploads/${reuse.filename}`, winner.media.url)
  evidence.reuse = { ownership: reuse.ownership, sha256: reuse.sha256, filename: reuse.filename }
  assert.equal((await ctx.ownership.rollbackOwner(reuseOwner, { scope: 'pptx-import' })).removed, 0)
  assert.deepEqual(ctx.store.getState(), authority)
  const release = await ctx.ownership.rollbackOwner(loser.jobId, { scope: 'pptx-import' })
  assert.equal(release.removed, 1, 'Only the isolated pending loser placement should be removed')
  assert.deepEqual(ctx.store.getState(), authority)
  evidence.loserPendingPlacementsReleased = release.removed
  await api(ctx.base, loser.media.url, { binary: true, status: 404 })
  evidence.winnerAfterCompensation = await snapshot(ctx, [winner.id])
  for (const field of ['stateSha256', 'rootSha256', 'heads', 'owners', 'jobs', 'results', 'rows']) {
    assert.deepEqual(evidence.winnerAfterCompensation[field], evidence.winnerBeforeCompensation[field])
  }
  evidence.consumersAfterCompensation = await consumers(ctx, winner)
  assert.deepEqual(evidence.consumersAfterCompensation, evidence.consumersBeforeCompensation)
  assert.equal(sha(await ctx.store.readBlob(loser.prepared.blob.sha256)), sha(loser.bytes))
  evidence.loserImmutableCandidateRetained = true
  evidence.scope = 'Real package entrypoint publication race and typed stale rollback; ordinary UUID import routes are not claimed to collide; no process-crash or Edited/Office proof'
  evidence.status = 'passed'
}
