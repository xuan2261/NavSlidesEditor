// Pass-through publication barrier: real store.mutate owns its serialization while paused.
const assert = require('node:assert/strict')
const { bounded, deferred } = require('./pptx-concurrency-exit-fixture.cjs')
module.exports = async function serialized(ctx, { aId, bId, first, second, during, rejectSecond = false }) {
  const publish = ctx.store.metadata.publish.bind(ctx.store.metadata)
  const mutate = ctx.store.mutate.bind(ctx.store)
  const originalPublish = ctx.store.metadata.publish, originalMutate = ctx.store.mutate
  const entered = deferred(), release = deferred(), queued = deferred()
  const events = []
  let armed = true, watchSecond = false, secondPublished = false
  ctx.store.metadata.publish = async (next, options) => {
    if (armed && next.heads.some(head => head.presentationId === aId)) {
      armed = false
      events.push({ event: 'A-inside-mutation-publication', aId, bId })
      entered.resolve()
      await bounded(release.promise, 'A publication release')
      events.push({ event: 'A-publication-release' })
    } else if (next.heads.some(head => head.presentationId === bId)) {
      secondPublished = true
      events.push({ event: 'B-inside-mutation-publication' })
    }
    return publish(next, options)
  }
  ctx.store.mutate = function observedMutation(...args) {
    const operation = mutate(...args) // Synchronously enqueues behind the actual mutation tail.
    if (watchSecond) {
      watchSecond = false
      events.push({ event: 'B-enqueued-at-held-mutation-lock' })
      queued.resolve()
    }
    return operation
  }
  const settled = promise => promise.then(value => ({ status: 'fulfilled', value }),
    reason => ({ status: 'rejected', reason }))
  let a, b, failure, observation
  try {
    a = settled(Promise.resolve().then(first))
    await bounded(entered.promise, 'A inside writer scope')
    watchSecond = true
    b = settled(Promise.resolve().then(second))
    await bounded(queued.promise, 'B mutation lock admission')
    assert.equal(secondPublished, false, 'B published while A held the mutation lock')
    observation = await during()
    assert.equal(secondPublished, false, 'B crossed held writer scope during consumer reads')
    events.push({ event: 'Consumers-completed-with-A-held-and-B-queued' })
  } catch (error) { failure = error }
  finally {
    release.resolve()
    try {
      const outcomes = await bounded(Promise.all([a, b].filter(Boolean)), 'Overlapping mutation completion')
      if (!failure) {
        assert.equal(outcomes.length, 2)
        assert.equal(outcomes[0].status, 'fulfilled', outcomes[0].reason?.message)
        assert.equal(outcomes[1].status, rejectSecond ? 'rejected' : 'fulfilled', outcomes[1].reason?.message)
        if (rejectSecond) assert.equal(outcomes[1].reason.code, 'PACKAGE_IMPORT_COMMIT_FAILED')
        observation = { during: observation, events, outcomes: outcomes.map(item => ({ status: item.status,
          ...(item.reason ? { code: item.reason.code } : { value: item.value }) })) }
      }
    } catch (error) { failure ||= error }
    ctx.store.metadata.publish = originalPublish
    ctx.store.mutate = originalMutate
  }
  if (failure) { failure.barrierEvents = events; throw failure }
  return observation
}
