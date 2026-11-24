// Registered by Vitest's globals so this CommonJS suite participates in discovery.
/* global test, afterEach */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const crypto = require('node:crypto')
const { loadStateIndex } = require('./state-index-loader')
const os = require('node:os')
const path = require('node:path')
const { openPackageStore } = require('./index')
const { StateStore } = require('./state-store')
const { queueCompatibilityUpsert, acknowledgeCompatibilityOutbox } = require('../compatibility-outbox')

const { sealPublication, isSealedPublication } = require('./publication-snapshot')
const { preparePublication } = require('./prepared-publication')
const { canonicalJson, hashRecord } = require('./schemas')

const cleanups = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

async function assertManifestAuthority(store) {
  const bytes = await fs.readFile(path.join(store.rootDir, store.metadata.root.stateFile))
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), store.metadata.root.stateHash)
  const loaded = await loadStateIndex(store.rootDir, store.metadata.root)
  assert.deepEqual(loaded.state, JSON.parse(canonicalJson(store.metadata.state)))
}

async function fixture() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'owned-outbox-'))
  const store = await openPackageStore({ rootDir })
  await store.acquireWriter()
  cleanups.push(async () => {
    try {
      await store.releaseWriter()
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true })
    }
  })
  let retained
  await store.mutate((next) => {
    next.extra = { nested: ['original'] }
    retained = next
    for (const id of ['deck-1', 'deck-2']) queueCompatibilityUpsert(next, {
      presentationId: id, generation: 1,
      presentation: { id, title: 'Original', slides: [] },
    })
  })
  return { store, retained, rootDir }
}

test('ack shares only sealed branches, isolates retained drafts/captures, and replays idempotently', async () => {
  const { store, retained } = await fixture()
  const before = store.metadata.state
  const captured = store.getCompatibilityState().compatibilityOutbox.slice(0, 1)
  // Hold the queue so caller mutations after invocation cannot alter comparison inputs.
  let release
  store.mutationTail = new Promise((resolve) => { release = resolve })
  const ack = acknowledgeCompatibilityOutbox(store, captured)
  captured[0].presentation.title = 'Caller changed'
  retained.extra.nested[0] = 'Retained changed'
  release()
  assert.equal(await ack, 1)
  const after = store.metadata.state
  assert.equal(after.extra, before.extra)
  assert.equal(after.heads, before.heads)
  assert.notEqual(after.compatibilityOutbox, before.compatibilityOutbox)
  assert.equal(after.compatibilityOutbox[0], before.compatibilityOutbox[1])
  assert.ok(Object.isFrozen(after.compatibilityOutbox))
  assert.ok(Object.isFrozen(after.extra.nested))
  assert.equal(after.extra.nested[0], 'original')
  assert.equal(after.generation, before.generation + 1)
  assert.equal(after.fencingEpoch, store.fencingEpoch)
  assert.equal(await store.acknowledgeCompatibilityWrites([before.compatibilityOutbox[0]]), 0)
  assert.equal(store.metadata.state, after)
})

test('same-id changed write is not acknowledged', async () => {
  const { store } = await fixture()
  const captured = store.getCompatibilityState().compatibilityOutbox.slice(0, 1)
  await store.mutate((next) => { next.compatibilityOutbox[0].presentation.title = 'New payload' })
  const before = store.metadata.state
  assert.equal(await store.acknowledgeCompatibilityWrites(captured), 0)
  assert.equal(store.metadata.state, before)
})

test('full captured equality distinguishes undefined properties from missing properties', async () => {
  const { store } = await fixture()
  const captured = store.getCompatibilityState().compatibilityOutbox.slice(0, 1)
  captured[0].presentation.extra = undefined
  assert.equal(await store.acknowledgeCompatibilityWrites(captured), 0)
  assert.equal(store.metadata.state.compatibilityOutbox.length, 2)
})

test('raw shallow-frozen state fallback detaches every retained branch', async () => {
  const { store } = await fixture()
  const raw = store.getState()
  Object.freeze(raw)
  store.metadata.state = raw
  const captured = raw.compatibilityOutbox.slice(0, 1)
  assert.equal(await store.acknowledgeCompatibilityWrites(captured), 1)
  raw.extra.nested[0] = 'Tampered'
  raw.compatibilityOutbox[1].presentation.title = 'Tampered'
  assert.equal(store.metadata.state.extra.nested[0], 'original')
  assert.equal(store.metadata.state.compatibilityOutbox[0].presentation.title, 'Original')
})

test('nested getter cannot grant sharing proof or alias prepared ACK bytes', async () => {
  const { store } = await fixture()
  const raw = store.getState()
  const returned = { nested: ['original'] }
  let reads = 0
  raw.extra = { get payload() { reads += 1; return returned } }
  sealPublication(raw)
  assert.equal(reads, 0)
  assert.equal(isSealedPublication(raw), false)
  assert.equal(Object.isFrozen(returned), false)
  store.metadata.state = raw
  assert.equal(await store.acknowledgeCompatibilityWrites(raw.compatibilityOutbox.slice(0, 1)), 1)
  const prepared = preparePublication(store.metadata.state, store.metadata.root)
  returned.nested[0] = 'caller changed'
  assert.equal(Object.isFrozen(returned), false)
  assert.equal(prepared.state.extra.payload.nested[0], 'original')
  assert.notEqual(prepared.state.extra.payload, returned)
  assert.equal(prepared.stateBytes, canonicalJson(prepared.state))
  assert.equal(prepared.root.stateHash, hashRecord(prepared.state))
  await assertManifestAuthority(store)
})

test('sparse arrays reject sharing and ACK fallback detaches inherited numeric data', async () => {
  const { store } = await fixture()
  const raw = store.getState()
  raw.extra = new Array(18)
  sealPublication(raw)
  assert.equal(isSealedPublication(raw.extra), false)
  assert.equal(isSealedPublication(raw), false)
  store.metadata.state = raw
  const previous = Object.getOwnPropertyDescriptor(Array.prototype, '17')
  const inherited = { value: 'before' }
  try {
    Object.defineProperty(Array.prototype, '17', {
      value: inherited, writable: true, configurable: true,
    })
    const root = store.metadata.root
    const rootBytes = await fs.readFile(store.metadata.rootPath)
    await assert.rejects(store.acknowledgeCompatibilityWrites(raw.compatibilityOutbox.slice(0, 1)), /plain JSON data/)
    assert.equal(store.metadata.state, raw)
    assert.equal(store.metadata.root, root)
    assert.deepEqual(await fs.readFile(store.metadata.rootPath), rootBytes)
    inherited.value = 'after'
    assert.equal(raw.extra[17], inherited)
    assert.equal(Object.hasOwn(raw.extra, '17'), false)
    assert.equal(Object.isFrozen(raw.extra), false)
    const recovered = new StateStore(store.rootDir)
    await recovered.init()
    assert.equal(recovered.state.compatibilityOutbox.length, 2)
  } finally {
    if (previous) Object.defineProperty(Array.prototype, '17', previous)
    else delete Array.prototype[17]
  }
  // Repair only the injected raw fixture; a rejected admission cannot poison the queue.
  const repaired = store.getState()
  repaired.extra = ['valid']
  store.metadata.state = repaired
  assert.equal(await store.acknowledgeCompatibilityWrites(repaired.compatibilityOutbox.slice(0, 1)), 1)
  assert.equal(Object.isFrozen(repaired.extra), false)
  repaired.extra[0] = 'caller changed'
  assert.equal(store.metadata.state.extra[0], 'valid')
  await assertManifestAuthority(store)
})

test('sparse detachment preserves historical bytes but manifest admission rejects invalid JSON', async () => {
  const { createEmptyState } = require('./schemas')
  const draft = createEmptyState()
  draft.extra = new Array(18)
  const bytes = canonicalJson(draft)
  const prepared = preparePublication(draft, null)
  assert.equal(prepared.stateBytes, bytes)
  assert.notEqual(prepared.state.extra, draft.extra)
  const { encodeStateManifest } = require('./state-manifest')
  let puts = 0
  await assert.rejects(encodeStateManifest(prepared.state, { put() { puts++; throw new Error('unexpected write') } }), /plain JSON data/)
  assert.equal(puts, 0)
  assert.equal(Object.isFrozen(draft.extra), false)
})

test('sharing proof rejects proxies, cycles, exotics and non-data properties', () => {
  const cycle = {}; cycle.self = cycle
  const proxy = new Proxy({}, { ownKeys() { throw new Error('proxy inspected') } })
  for (const extra of [proxy, cycle, new Date(), new Map(), new Set(),
    Object.create({ inherited: true }), { get value() { throw new Error('getter invoked') } },
    { value: undefined }, { value: () => {} }, { [Symbol('hidden')]: {} }]) {
    const graph = { extra }
    sealPublication(graph)
    assert.equal(isSealedPublication(graph), false)
  }
  const plain = { nested: [{ value: 'immutable' }] }
  sealPublication(plain)
  assert.equal(isSealedPublication(plain), true)
  assert.ok(Object.isFrozen(plain.nested[0]))
})

test('legacy mutate-only ACK uses detached full equality including undefined own fields', async () => {
  const original = { id: 'write', presentation: { title: 'Original' } }
  let queued = structuredClone(original)
  const store = { async mutate(fn) { fn({ compatibilityOutbox: [queued] }) } }
  const mismatch = structuredClone(original)
  mismatch.presentation.extra = undefined
  assert.equal(await acknowledgeCompatibilityOutbox(store, [mismatch]), 0)
  queued.presentation.extra = undefined
  assert.equal(await acknowledgeCompatibilityOutbox(store, [original]), 0)
  queued = structuredClone(original)
  let release
  const gate = new Promise((resolve) => { release = resolve })
  store.mutate = async (fn) => { await gate; fn({ compatibilityOutbox: [queued] }) }
  const writes = [structuredClone(original)]
  const pending = acknowledgeCompatibilityOutbox(store, writes)
  writes[0].presentation.title = 'changed after capture'
  release()
  assert.equal(await pending, 1)
})

for (const boundary of ['faultAfterIndex', 'faultAfterPrepare', 'faultAfterRoot', 'faultAfterCompletion']) {
  test(`ack recovery preserves publication boundary at ${boundary}`, async () => {
    const { store, rootDir } = await fixture()
    const captured = store.getCompatibilityState().compatibilityOutbox
    const before = store.metadata.state
    await assert.rejects(store.acknowledgeCompatibilityWrites(captured, { [boundary]: true }), /Injected fault/)
    const published = boundary === 'faultAfterRoot' || boundary === 'faultAfterCompletion'
    assert.equal(store.metadata.state.compatibilityOutbox.length, published ? 0 : 2)
    const recovered = new StateStore(rootDir)
    await recovered.init()
    assert.equal(recovered.state.compatibilityOutbox.length, published ? 0 : 2)
    assert.equal(recovered.state.generation, before.generation + (published ? 1 : 0))
    await assertManifestAuthority(store)
    if (!published) {
      assert.equal(store.metadata.state, before)
      assert.equal(await store.acknowledgeCompatibilityWrites(captured), 2)
      await assertManifestAuthority(store)
    }
    if (published) {
      assert.equal(await store.acknowledgeCompatibilityWrites(captured), 0)
      // Corrupt the new index: retained predecessor still owns the original outbox.
      await fs.writeFile(path.join(rootDir, store.metadata.root.stateFile), '{}')
      await recovered.reload()
      assert.equal(recovered.state.compatibilityOutbox.length, 2)
    }
  })
}

for (const fault of ['record-write', 'writer-lost', 'abort-before-queue']) {
  test(`owned ACK rejects ${fault} without committing and queue remains usable`, async () => {
    const { store, rootDir, retained } = await fixture()
    const before = store.metadata.state
    const root = store.metadata.root
    const bytes = await fs.readFile(store.metadata.rootPath)
    const captured = store.getCompatibilityState().compatibilityOutbox.slice(0, 1)
    const put = store.metadata.recordStore.put
    const assertWriter = store.assertWriter
    const controller = new AbortController()
    if (fault === 'record-write') store.metadata.recordStore.put = async () => { throw new Error('record-write') }
    if (fault === 'writer-lost') store.assertWriter = async () => { throw new Error('writer-lost') }
    if (fault === 'abort-before-queue') controller.abort(new Error('abort-before-queue'))
    try {
      await assert.rejects(store.acknowledgeCompatibilityWrites(captured, { signal: controller.signal }), new RegExp(fault))
      assert.equal(store.metadata.state, before)
      assert.equal(store.metadata.root, root)
      assert.deepEqual(await fs.readFile(store.metadata.rootPath), bytes)
      const recovered = new StateStore(rootDir)
      await recovered.init()
      assert.equal(recovered.state.compatibilityOutbox.length, 2)
      assert.equal(Object.isFrozen(retained.extra), false)
      assert.equal(Object.isFrozen(captured[0]), false)
    } finally {
      store.metadata.recordStore.put = put
      store.assertWriter = assertWriter
    }
    assert.equal(await store.acknowledgeCompatibilityWrites(captured), 1)
    await assertManifestAuthority(store)
  })
}

test('abort during publication fault leaves durable ack pending and queue usable', async () => {
  const { store, rootDir } = await fixture()
  const controller = new AbortController()
  const before = store.metadata.state
  const captured = store.getCompatibilityState().compatibilityOutbox
  const persist = store.metadata.persistMatrixAuthorityHighWater.bind(store.metadata)
  store.metadata.persistMatrixAuthorityHighWater = async (...args) => {
    await persist(...args)
    controller.abort(new Error('abort during publication'))
    throw controller.signal.reason
  }
  await assert.rejects(store.acknowledgeCompatibilityWrites(captured, { signal: controller.signal }), /abort during publication/)
  assert.equal(store.metadata.state, before)
  const recovered = new StateStore(rootDir)
  await recovered.init()
  assert.equal(recovered.state.compatibilityOutbox.length, 2)
  store.metadata.persistMatrixAuthorityHighWater = persist
  assert.equal(await store.acknowledgeCompatibilityWrites(captured), 2)
})
