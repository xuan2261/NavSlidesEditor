// @vitest-environment node
import { test } from 'vitest'
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { StateRecordStore } = require('./state-record-store')
const { collectStateRecords } = require('./state-record-gc')
const { encodeStateManifest, collectManifestReferences } = require('./state-manifest')
const { createEmptyState, canonicalJson, hashRecord, STATE_ROOT_SCHEMA_VERSION } = require('./schemas')
const writer = { assertWriter: async () => {} }

test('PackageStore maintenance waits for mutations, requires lease and refuses active publication', async () => {
  const { openPackageStore } = require('./index')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gc-integration-'))
  const store = await openPackageStore({ rootDir: dir })
  try {
    await assert.rejects(store.collectStateRecords())
    await store.acquireWriter()
    await store.mutate(() => {})
    const orphan = await store.metadata.recordStore.put({ orphan: true }, writer)
    let unblock
    let entered
    const started = new Promise(resolve => { entered = resolve })
    const blocked = new Promise(resolve => { unblock = resolve })
    const mutation = store.mutate(async () => { entered(); await blocked })
    await started
    const collection = store.collectStateRecords()
    assert.deepEqual(await store.metadata.recordStore.get(orphan), { orphan: true })
    unblock()
    await mutation
    assert.ok((await collection).deleted.includes(orphan.hash))
    store.activePublication = true
    await assert.rejects(store.collectStateRecords(), /active publication/)
    store.activePublication = false
    await store.releaseWriter()
    await assert.rejects(store.collectStateRecords())
  } finally {
    await store.releaseWriter()
    await fs.rm(dir, { recursive: true, force: true })
  }
})

async function fixture(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-record-gc-'))
  const records = new StateRecordStore(dir)
  await fs.mkdir(path.join(dir, 'indexes'))
  await fs.mkdir(path.join(dir, 'wal'))
  async function index(label, predecessor = null, legacy = false) {
    const state = createEmptyState()
    for (let i = 0; i < 8; i++) {
      state.mutationResults.push({ schemaVersion: 1, idempotencyKey: `${label}-${i}`,
        presentationId: 'p', presentation: { id: 'p', text: `${label} history ${i}` } })
    }
    const value = legacy ? state : (await encodeStateManifest(state, records, writer)).manifest
    // New manifests hash raw bytes; legacy indexes hash canonical parsed data.
    const bytes = JSON.stringify(value, null, 2)
    const hash = legacy ? hashRecord(value) : crypto.createHash('sha256').update(bytes).digest('hex')
    const root = { schemaVersion: STATE_ROOT_SCHEMA_VERSION, transactionId: label,
      stateHash: hash, stateFile: `indexes/${hash}.json`, storeGeneration: 0, fencingEpoch: 0, predecessor }
    await fs.writeFile(path.join(dir, root.stateFile), bytes)
    return { root, value, state }
  }
  const publish = (root) => fs.writeFile(path.join(dir, 'state-root.json'), JSON.stringify(root))
  try { await run({ dir, records, index, publish }) }
  finally { await fs.rm(dir, { recursive: true, force: true }) }
}

test('marks whole historical collections, current/predecessors, every prepared WAL, pins and active refs', async () => {
  await fixture(async ({ dir, records, index, publish }) => {
    const oldest = await index('oldest')
    const previous = await index('previous', oldest.root)
    const current = await index('current', previous.root)
    const wal1 = await index('wal1')
    const wal2 = await index('wal2')
    await publish(current.root)
    for (const entry of [wal1, wal2]) {
      await fs.writeFile(path.join(dir, 'wal', `${entry.root.transactionId}.prepared.json`), JSON.stringify(entry.root))
    }
    // A completion marker does not weaken prepared-WAL protection.
    await fs.writeFile(path.join(dir, 'wal', 'wal1.completed'), 'completed')
    const pin = await records.put({ pin: true }, writer)
    const active = await records.put({ active: true }, writer)
    const orphan = await records.put({ orphan: true }, writer)
    const result = await collectStateRecords(dir, { ...writer, pins: [pin], activeReferences: [active] })
    assert.deepEqual(result.deleted, [orphan.hash])
    for (const entry of [oldest, previous, current, wal1, wal2]) {
      for (const hash of collectManifestReferences(entry.value)) assert.ok(result.marked.includes(hash))
    }
    assert.deepEqual((await records.listRecords()).sort(), result.marked)
  })
})

test('legacy canonical hashes are supported; indexes, legacy, blobs, candidates and unrelated filenames are untouched', async () => {
  await fixture(async ({ dir, records, index, publish }) => {
    const legacy = await index('legacy', null, true)
    await publish(legacy.root)
    const orphan = await records.put({ orphan: true }, writer)
    const names = ['.candidate-crash.tmp', 'not-a-hash.json', `${'a'.repeat(64)}.json.tmp`, 'UPPER.JSON']
    for (const name of names) await fs.writeFile(path.join(records.recordsDir, name), 'partial')
    const directory = `${'b'.repeat(64)}.json`
    await fs.mkdir(path.join(records.recordsDir, directory))
    await fs.mkdir(path.join(dir, 'blobs'))
    await fs.writeFile(path.join(dir, 'blobs', `${orphan.hash}.json`), 'blob')
    await fs.writeFile(path.join(dir, 'wal', '.candidate.tmp'), 'not json')
    assert.deepEqual((await collectStateRecords(dir, writer)).deleted, [orphan.hash])
    assert.deepEqual((await fs.readdir(records.recordsDir)).sort(), [...names, directory].sort())
    assert.equal(await fs.readFile(path.join(dir, legacy.root.stateFile), 'utf8'), JSON.stringify(legacy.value, null, 2))
    assert.equal(await fs.readFile(path.join(dir, 'blobs', `${orphan.hash}.json`), 'utf8'), 'blob')
  })
})

for (const damage of ['record-missing', 'record-corrupt', 'index-hash', 'unknown-index', 'bad-wal', 'bad-predecessor', 'bad-pin', 'corrupt-orphan']) {
  test(`${damage} fails closed before any deletion`, async () => {
    await fixture(async ({ dir, records, index, publish }) => {
      const previous = await index('previous')
      const current = await index('current', previous.root)
      const orphan = await records.put({ orphan: true }, writer)
      const options = { ...writer }
      if (damage.startsWith('record-')) {
        const ref = previous.value.state.mutationResults.records[0]
        if (damage === 'record-missing') await fs.unlink(records.recordPath(ref))
        else await fs.writeFile(records.recordPath(ref), 'corrupt')
      }
      if (damage === 'index-hash') await fs.appendFile(path.join(dir, current.root.stateFile), ' ')
      if (damage === 'unknown-index') {
        const value = { mysterious: true }
        current.root.stateHash = hashRecord(value)
        current.root.stateFile = `indexes/${current.root.stateHash}.json`
        await fs.writeFile(path.join(dir, current.root.stateFile), canonicalJson(value))
      }
      if (damage === 'bad-wal') await fs.writeFile(path.join(dir, 'wal', 'x.prepared.json'), '{}')
      if (damage === 'bad-predecessor') current.root.predecessor = { invalid: true }
      if (damage === 'bad-pin') options.pins = [{ hash: 'f'.repeat(64), bytes: 2 }]
      if (damage === 'corrupt-orphan') await fs.writeFile(records.recordPath(orphan), 'corrupt')
      await publish(current.root)
      const before = await fs.readdir(records.recordsDir)
      await assert.rejects(collectStateRecords(dir, options))
      assert.deepEqual(await fs.readdir(records.recordsDir), before)
      if (damage !== 'corrupt-orphan') assert.deepEqual(await records.get(orphan), { orphan: true })
    })
  })
}

test('missing writer, fencing and abort (including during pre-delete assertion) delete nothing', async () => {
  await fixture(async ({ dir, records, index, publish }) => {
    await publish((await index('current')).root)
    const orphan = await records.put({ orphan: true }, writer)
    await assert.rejects(collectStateRecords(dir, { assertWriter: true }), /assertWriter/)
    await assert.rejects(collectStateRecords(dir, { assertWriter: async () => { throw new Error('fenced') } }), /fenced/)
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(collectStateRecords(dir, { ...writer, signal: controller.signal }), /abort/i)
    for (const mode of ['abort', 'fence']) {
      const controller = new AbortController()
      let calls = 0
      await assert.rejects(collectStateRecords(dir, { signal: controller.signal, assertWriter: async () => {
        if (++calls === 3) {
          if (mode === 'abort') controller.abort()
          else throw new Error('fenced')
        }
      } }), /abort|fenced/i)
      assert.equal(calls, 3)
      assert.deepEqual(await records.get(orphan), { orphan: true })
    }
  })
})
