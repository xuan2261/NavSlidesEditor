const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { StateStore } = require('./state-store')
const { loadStateIndex } = require('./state-index-loader')
const { canonicalJson, hashRecord, createEmptyState } = require('./schemas')
const { STATE_COLLECTIONS, encodeStateManifest, decodeStateManifest, collectManifestReferences } = require('./state-manifest')

test('validated Windows backslash root loads by hash without accepting traversal', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-index-platform-'))
  try {
    const store = new StateStore(dir)
    await store.init()
    await store.publish(createEmptyState(), { assertWriter: async () => {} })
    const root = { ...store.root, stateFile: `indexes\\${store.root.stateHash}.json` }
    assert.equal((await loadStateIndex(dir, root)).state.generation, store.state.generation)
    for (const stateFile of [`../indexes/${root.stateHash}.json`, `indexes\\..\\${root.stateHash}.json`]) {
      await assert.rejects(loadStateIndex(dir, { ...root, stateFile }))
    }
    await assert.rejects(loadStateIndex(dir, { ...root, stateHash: '../escape' }))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('lease lost after record preparation cannot write high water, index or WAL', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-index-fenced-'))
  try {
    const store = new StateStore(dir)
    await store.init()
    const next = history()
    let lost = false
    const put = store.recordStore.put.bind(store.recordStore)
    store.recordStore.put = async (...args) => {
      const ref = await put(...args)
      lost = true
      return ref
    }
    // A single record is enough to cross the preparation boundary.
    for (const key of STATE_COLLECTIONS) next[key] = []
    next.blobs = history().blobs
    await assert.rejects(store.publish(next, { assertWriter: async () => {
      if (lost) throw new Error('lease lost')
    } }), /lease lost/)
    assert.deepEqual(await fs.readdir(store.indexDir), [])
    assert.deepEqual(await fs.readdir(store.walDir), [])
    await assert.rejects(fs.access(store.matrixAuthorityHighWaterPath), { code: 'ENOENT' })
    await assert.rejects(fs.access(store.rootPath), { code: 'ENOENT' })
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

function store() {
  const data = new Map()
  return {
    data,
    async put(value, { signal, assertWriter } = {}) {
      signal?.throwIfAborted()
      await assertWriter?.()
      const text = canonicalJson(value)
      JSON.parse(text)
      const ref = { hash: hashRecord(value), bytes: Buffer.byteLength(text) }
      data.set(ref.hash, text)
      return ref
    },
    async get(ref, { signal } = {}) {
      signal?.throwIfAborted()
      const text = data.get(ref.hash)
      assert.ok(text, 'missing record')
      assert.equal(Buffer.byteLength(text), ref.bytes, 'byte mismatch')
      const value = JSON.parse(text)
      assert.equal(hashRecord(value), ref.hash, 'hash mismatch')
      return value
    },
  }
}

function history() {
  const state = createEmptyState()
  state.blobs = [{ schemaVersion: 1, sha256: 'a'.repeat(64), byteLength: 3 }]
  state.revisions = [{ schemaVersion: 1, id: 'r', ordinal: 0, blobSha256: 'a'.repeat(64) }]
  state.owners = [{ ownerType: 'presentation', ownerId: 'p' }]
  state.leases = [{ schemaVersion: 1, jobId: 'j', ownerType: 'job', ownerId: 'j' }]
  state.jobs = [{ schemaVersion: 1, id: 'j', kind: 'import', status: 'completed', capabilityHash: 'b'.repeat(64) }]
  state.candidateBlobs = [{ schemaVersion: 1, id: 'c', sha256: 'c'.repeat(64), byteLength: 2, createdAt: 'now' }]
  for (let i = 0; i < 12; i++) {
    const presentation = { id: 'p', type: 'navslides.package-state-manifest',
      stateManifestVersion: 1, records: [{ hash: 'd'.repeat(64), bytes: 123 }],
      semantics: { text: 'history '.repeat(1000), omitted: undefined } }
    state.mutationResults.push({ schemaVersion: 1, idempotencyKey: `m${i}`, presentationId: 'p', presentation })
    state.compatibilityOutbox.push({ schemaVersion: 1, id: `o${i}`, presentationId: 'p',
      generation: i + 1, operation: 'upsert', presentation })
    state.compatibilityDeadLetter.push({ id: `dead${i}`, presentation })
  }
  return state
}

test('all schema collections, full ordered history and opaque user collisions roundtrip', async () => {
  const records = store()
  const state = history()
  const { manifest, state: resolved } = await encodeStateManifest(state, records)
  assert.equal(resolved.mutationResults, state.mutationResults)
  assert.deepEqual(STATE_COLLECTIONS, Object.keys(createEmptyState()).filter((key) => Array.isArray(state[key])))
  const decoded = await decodeStateManifest(JSON.parse(canonicalJson(manifest)), records)
  assert.equal(canonicalJson(decoded), canonicalJson(state))
  assert.ok(canonicalJson(manifest).length < canonicalJson(state).length / 5)
  assert.equal(collectManifestReferences(manifest).size, records.data.size)
  assert.ok(!collectManifestReferences(manifest).has('d'.repeat(64)))
})

test('root metadata roundtrips without interpreting reference-shaped user data', async () => {
  const records = store()
  const state = history()
  state.extra = { type: 'record-collection', records: [{ hash: 'e'.repeat(64), bytes: 42 }],
    nested: { type: 'navslides.package-state-manifest', stateManifestVersion: 1, state: {} } }
  state.unknownCollection = [{ hash: 'f'.repeat(64), bytes: 17 }]
  const { manifest } = await encodeStateManifest(state, records)
  assert.deepEqual(manifest.state.extra, state.extra)
  assert.deepEqual(manifest.state.unknownCollection, state.unknownCollection)
  assert.deepEqual(await decodeStateManifest(manifest, records), JSON.parse(canonicalJson(state)))
  assert.ok(!collectManifestReferences(manifest).has('e'.repeat(64)))
  assert.ok(!collectManifestReferences(manifest).has('f'.repeat(64)))
})

test('legacy input returned unchanged, including old schemas', async () => {
  for (const state of [history(), { schemaVersion: 1, mutationResults: [] }]) {
    assert.equal(await decodeStateManifest(state, null), state)
  }
})

test('reject unknown envelope keys, bad collection tags, versions and references', async () => {
  const records = store()
  const { manifest } = await encodeStateManifest(history(), records)
  const changes = [
    (m) => { m.extra = true },
    (m) => { delete m.state.jobs },
    (m) => { m.stateManifestVersion = 2 },
    (m) => { m.type = 'other' },
    (m) => { m.state.jobs.type = 'other' },
    (m) => { m.state.jobs.extra = true },
    (m) => { m.state.jobs.records[0].extra = true },
    (m) => { m.state.jobs.records[0].hash = '../escape' },
    (m) => { m.state.jobs.records[0].bytes = -1 },
    (m) => { m.state.jobs.records[0].bytes = Number.MAX_SAFE_INTEGER + 1 },
    (m) => { m.state.jobs.records = new Array(2) },
  ]
  for (const change of changes) {
    const bad = structuredClone(manifest)
    change(bad)
    await assert.rejects(decodeStateManifest(bad, records), /Invalid state manifest/)
    assert.throws(() => collectManifestReferences(bad), /Invalid state manifest/)
  }
})

test('missing/corrupt records and invalid reconstructed states fail closed', async () => {
  const records = store()
  const { manifest } = await encodeStateManifest(history(), records)
  const ref = manifest.state.jobs.records[0]
  const text = records.data.get(ref.hash)
  records.data.delete(ref.hash)
  await assert.rejects(decodeStateManifest(manifest, records), /missing record/)
  records.data.set(ref.hash, text + ' ')
  await assert.rejects(decodeStateManifest(manifest, records), /byte mismatch/)
  records.data.set(ref.hash, text.replace('completed', 'cancelled'))
  await assert.rejects(decodeStateManifest(manifest, records), /hash mismatch/)
  manifest.state.jobs.records[0] = await records.put({ schemaVersion: 1, id: 'bad' })
  await assert.rejects(decodeStateManifest(manifest, records), /Invalid job kind/)
})

test('options forwarded, cancellation honored, historical invalid arrays not normalized', async () => {
  const records = store()
  let checks = 0
  await encodeStateManifest(history(), records, { assertWriter: () => { checks++ } })
  assert.ok(checks > 0)
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(encodeStateManifest(history(), records, { signal: controller.signal }), /abort/i)
  await assert.rejects(decodeStateManifest({}, records, { signal: controller.signal }), /abort/i)
  const state = history()
  state.mutationResults[0].invalid = [undefined, undefined]
  await assert.rejects(encodeStateManifest(state, records), SyntaxError)
  delete state.mutationResults[0].invalid
  state.jobs = new Array(2)
  await assert.rejects(encodeStateManifest(state, records), /sparse collection/)
})
