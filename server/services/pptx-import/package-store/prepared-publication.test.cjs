// Registered by Vitest's globals so this CommonJS suite participates in discovery.
/* global test */
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { preparePublication } = require('./prepared-publication')
const { createEmptyState, canonicalJson, hashRecord } = require('./schemas')
const { StateStore } = require('./state-store')
const { encodeStateManifest, STATE_MANIFEST_TYPE } = require('./state-manifest')
async function manifestBytes(state) {
  const { manifest } = await encodeStateManifest(state, { put: async value => ({
    hash: hashRecord(value), bytes: Buffer.byteLength(canonicalJson(value)),
  }) })
  return canonicalJson(manifest)
}
async function manifestHash(state) {
  return require('node:crypto').createHash('sha256').update(await manifestBytes(state)).digest('hex')
}

test('prepared bytes preserve canonical digest and detach mutable references', () => {
  const draft = createEmptyState()
  draft.extra = { nested: ['é', '😀'] }
  const prepared = preparePublication(draft, null)
  assert.equal(prepared.stateBytes, canonicalJson(draft))
  assert.equal(prepared.root.stateHash, hashRecord(draft))
  draft.extra.nested[0] = 'tampered'
  assert.equal(prepared.state.extra.nested[0], 'é')
  assert.ok(Object.isFrozen(prepared.state.extra.nested))
  assert.equal(Reflect.set(prepared, 'stateBytes', 'tampered'), false)
  assert.notEqual(preparePublication(draft, null).root.stateHash, prepared.root.stateHash)
  draft.generation = -1
  assert.throws(() => preparePublication(draft, null), /Invalid state generation/)
})

test('manifest attachment requires private preparation proof and retains admitted identities', async () => {
  const { prepareStreamingPublication, attachStorageManifest } = require('./prepared-publication')
  const draft = createEmptyState()
  draft.extra = { nested: ['original'] }
  const prepared = prepareStreamingPublication(draft, null)
  const { manifest } = await encodeStateManifest(prepared.state, { put: async value => ({
    hash: hashRecord(value), bytes: Buffer.byteLength(canonicalJson(value)),
  }) })
  for (const fake of [Object.freeze(draft), Object.freeze({ ...prepared }), prepared.state]) {
    assert.throws(() => attachStorageManifest(fake, manifest), /proven prepared publication/)
  }
  const attached = attachStorageManifest(prepared, manifest)
  manifest.state.generation = 99
  draft.extra.nested[0] = 'tampered'
  assert.equal(attached.state, prepared.state)
  assert.equal(attached.state.extra, prepared.state.extra)
  const bytes = [...attached.chunks].join('')
  assert.equal(JSON.parse(bytes).state.generation, 0)
  const completed = attached.complete(require('node:crypto').createHash('sha256').update(bytes).digest('hex'))
  assert.equal(completed.state, prepared.state)
  assert.equal(completed.state.extra.nested[0], 'original')
  assert.equal(completed.root.storeGeneration, prepared.state.generation)
  assert.throws(() => attachStorageManifest(prepared, { ...manifest, unknown: true }), /unknown key/)
})

for (const boundary of ['faultAfterIndex', 'faultAfterPrepare', 'faultAfterRoot', 'faultAfterCompletion']) {
  test(`prepared publication preserves recovery at ${boundary}`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepared-publication-'))
    try {
      const store = new StateStore(dir)
      await store.init()
      const assertWriter = async () => {}
      await store.publish(createEmptyState(), { assertWriter })
      const draft = createEmptyState()
      draft.generation = 1
      draft.fencingEpoch = 7
      draft.mutationResults = [{ schemaVersion: 1, idempotencyKey: 'retained',
        presentationId: 'deck', projection: { text: 'é😀\ud800x\udfff'.repeat(20000) } }]
      await assert.rejects(store.publish(draft, { assertWriter, [boundary]: true }), /Injected fault/)
      const recovered = new StateStore(dir)
      await recovered.init()
      const published = ['faultAfterRoot', 'faultAfterCompletion'].includes(boundary)
      assert.equal(recovered.state.generation, published ? 1 : 0)
      assert.equal(store.state.generation, recovered.state.generation)
      const expected = published ? draft : createEmptyState()
      const bytes = await fs.readFile(path.join(dir, recovered.root.stateFile))
      assert.deepEqual(bytes, Buffer.from(await manifestBytes(expected)))
      assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), recovered.root.stateHash)
      assert.deepEqual(recovered.state, expected)
      if (published) {
        const rootBytes = await fs.readFile(store.rootPath, 'utf8')
        assert.equal(await fs.readFile(path.join(store.walDir, `${store.root.transactionId}.prepared.json`), 'utf8'), rootBytes)
        draft.generation = 99
        assert.equal(store.state.generation, 1)
        await fs.writeFile(path.join(dir, store.root.stateFile), '{}')
        await recovered.reload()
        assert.equal(recovered.state.generation, 0)
        assert.ok(recovered.recoveryActions.includes('restored-verified-predecessor'))
      }
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
}

test('mutation during a publication await cannot diverge bytes and memory', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'prepared-mutation-'))
  try {
    const store = new StateStore(dir)
    await store.init()
    const draft = createEmptyState()
    const persist = store.persistMatrixAuthorityHighWater.bind(store)
    store.persistMatrixAuthorityHighWater = async (...args) => {
      draft.generation = 99
      return persist(...args)
    }
    await store.publish(draft, { assertWriter: async () => {} })
    assert.equal(store.state.generation, 0)
    await store.reload()
    assert.equal(store.state.generation, 0)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

for (const mode of ['short', 'zero', 'write-error', 'sync-error', 'collision', 'fence']) {
  test(`stream candidate handles ${mode}, retaining restart bytes and foreign orphans`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-errors-'))
    const open = fs.open
    let collision
    try {
      const store = new StateStore(dir)
      await store.init()
      const previous = createEmptyState()
      await store.publish(previous, { assertWriter: async () => {} })
      const orphan = path.join(store.indexDir, '.candidate-crash-orphan.tmp')
      await fs.writeFile(orphan, 'incomplete crash bytes')
      fs.open = async (file, ...args) => {
        if (!String(file).includes('.candidate-')) return open(file, ...args)
        if (mode === 'collision') {
          collision = file
          await fs.writeFile(file, 'not owned')
        }
        const handle = await open(file, ...args)
        const write = handle.write.bind(handle)
        if (mode === 'short') handle.write = (bytes, offset, length) =>
          write(bytes, offset, Math.min(length, 997))
        if (mode === 'zero') handle.write = async () => ({ bytesWritten: 0 })
        if (mode === 'write-error') handle.write = async () => { throw new Error('injected disk write') }
        if (mode === 'sync-error') handle.sync = async () => { throw new Error('injected disk sync') }
        return handle
      }
      const draft = createEmptyState()
      draft.generation = 1
      draft.fencingEpoch = 7
      draft.mutationResults = Array.from({ length: 3 }, (_, i) => ({
        schemaVersion: 1, idempotencyKey: 'history-' + i, presentationId: 'deck',
        projection: { text: ('é😀\ud800x\udfff').repeat(20000) },
      }))
      let checks = 0
      const publishing = store.publish(draft, { assertWriter: async () => {
        if (++checks === 2 && mode === 'fence') throw new Error('stale writer fence')
      } })
      if (mode === 'short') await publishing
      else await assert.rejects(publishing, /progress|disk|EEXIST|fence/)
      fs.open = open
      const expected = mode === 'short' ? draft : previous
      const restarted = new StateStore(dir)
      await restarted.init()
      for (const current of [store, restarted]) {
        const bytes = await fs.readFile(path.join(dir, current.root.stateFile))
        assert.deepEqual(bytes, Buffer.from(await manifestBytes(expected)))
        assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), current.root.stateHash)
        assert.deepEqual(current.state, expected)
      }
      assert.equal(await fs.readFile(orphan, 'utf8'), 'incomplete crash bytes')
      if (collision) assert.equal(await fs.readFile(collision, 'utf8'), 'not owned')
      assert.equal((await fs.readdir(store.indexDir)).filter((name) => name.endsWith('.tmp')).length, collision && path.dirname(collision) === store.indexDir ? 2 : 1)
    } finally {
      fs.open = open
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
}

for (const kind of ['corrupt', 'truncated', 'directory']) {
  test(`stream publication rejects existing ${kind} hash target without overwrite`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-conflict-'))
    try {
      const store = new StateStore(dir)
      await store.init()
      await store.publish(createEmptyState(), { assertWriter: async () => {} })
      const previousRoot = await fs.readFile(store.rootPath)
      const draft = createEmptyState()
      draft.generation = 1
      const bytes = Buffer.from(await manifestBytes(draft))
      const target = path.join(store.indexDir, `${await manifestHash(draft)}.json`)
      const bad = kind === 'corrupt' ? Buffer.alloc(bytes.length, 120) : bytes.subarray(0, bytes.length - 1)
      if (kind === 'directory') await fs.mkdir(target)
      else await fs.writeFile(target, bad)
      const wal = await fs.readdir(store.walDir)
      await assert.rejects(store.publish(draft, { assertWriter: async () => {} }), /Conflicting state index/)
      assert.deepEqual(await fs.readFile(store.rootPath), previousRoot)
      assert.deepEqual(await fs.readdir(store.walDir), wal)
      if (kind === 'directory') assert.ok((await fs.stat(target)).isDirectory())
      else assert.deepEqual(await fs.readFile(target), bad)
      assert.ok(!(await fs.readdir(store.indexDir)).some(name => name.endsWith('.tmp')))
      await store.reload()
      assert.equal(store.state.generation, 0)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
}

test('validated reuse syncs indexes before WAL, including retry after failed rename sync', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-reuse-'))
  const open = fs.open
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  try {
    const store = new StateStore(dir)
    await store.init()
    await store.publish(createEmptyState(), { assertWriter: async () => {} })
    const previousRoot = await fs.readFile(store.rootPath)
    const wal = await fs.readdir(store.walDir)
    const draft = createEmptyState()
    draft.generation = 1
    const target = path.join(store.indexDir, `${await manifestHash(draft)}.json`)
    // Exercise the supported-directory-sync branch even on Windows, without
    // asking Windows to open a directory handle.
    Object.defineProperty(process, 'platform', { value: 'linux' })
    let indexSyncs = 0
    fs.open = async (file, ...args) => {
      if ([dir, store.indexDir, store.walDir].includes(String(file))) {
        return {
          sync: async () => {
            if (String(file) === store.indexDir) {
              indexSyncs++
              throw new Error('injected indexes sync failure')
            }
          },
          close: async () => {},
        }
      }
      return open(file, ...args)
    }
    await assert.rejects(store.publish(draft, { assertWriter: async () => {} }), /indexes sync failure/)
    assert.equal(await fs.readFile(target, 'utf8'), await manifestBytes(draft))
    // The target now exists solely because the first rename succeeded.
    await assert.rejects(store.publish(draft, { assertWriter: async () => {} }), /indexes sync failure/)
    assert.equal(indexSyncs, 2)
    assert.deepEqual(await fs.readdir(store.walDir), wal)
    assert.deepEqual(await fs.readFile(store.rootPath), previousRoot)
    assert.equal(store.state.generation, 0)
    assert.ok(!(await fs.readdir(store.indexDir)).some(name => name.endsWith('.tmp')))
    fs.open = open
    Object.defineProperty(process, 'platform', platform)
    await store.reload()
    assert.equal(store.state.generation, 0)
    await store.publish(draft, { assertWriter: async () => {} })
    await store.reload()
    assert.deepEqual(store.state, draft)
  } finally {
    fs.open = open
    Object.defineProperty(process, 'platform', platform)
    await fs.rm(dir, { recursive: true, force: true })
  }
})

for (const stage of ['write', 'sync', 'rename']) {
  test(`ordinary root candidate ${stage} failure cleans temp but retains WAL and index`, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-root-cleanup-'))
    const open = fs.open, writeFile = fs.writeFile, rename = fs.rename
    try {
      const store = new StateStore(dir)
      await store.init()
      await store.publish(createEmptyState(), { assertWriter: async () => {} })
      const previousRoot = await fs.readFile(store.rootPath)
      const draft = createEmptyState()
      draft.generation = 1
      const isTempRoot = file => String(file).startsWith(`${store.rootPath}.`)
      fs.writeFile = async (file, ...args) => {
        const result = await writeFile(file, ...args)
        if (stage === 'write' && isTempRoot(file)) throw new Error('injected root failure')
        return result
      }
      fs.open = async (file, ...args) => {
        const handle = await open(file, ...args)
        if (stage === 'sync' && isTempRoot(file)) handle.sync = async () => { throw new Error('injected root failure') }
        return handle
      }
      fs.rename = async (source, target) => {
        if (stage === 'rename' && target === store.rootPath) throw new Error('injected root failure')
        return rename(source, target)
      }
      await assert.rejects(store.publish(draft, { assertWriter: async () => {} }), /injected root failure/)
      assert.ok(!(await fs.readdir(dir)).some(name => name.startsWith('state-root.json.')))
      assert.equal((await fs.readdir(store.walDir)).filter(name => name.endsWith('.prepared.json')).length, 2)
      assert.equal(await fs.readFile(path.join(store.indexDir, `${await manifestHash(draft)}.json`), 'utf8'), await manifestBytes(draft))
      assert.deepEqual(await fs.readFile(store.rootPath), previousRoot)
      await store.reload()
      assert.equal(store.state.generation, 0)
    } finally {
      fs.open = open
      fs.writeFile = writeFile
      fs.rename = rename
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
}

test('candidate batches over 8 MiB of Unicode with exact bytes and bounded write count', async () => {
  const { writeHashedCandidate } = require('./durable-fs')
  const { emitCanonicalChunks, sealCanonicalData } = require('./canonical-json')
  const value = { a: 'a'.repeat(32766) + '😀漢字\ud800x\udfff', z: 'é😀'.repeat(1400000) }
  const expected = Buffer.from(oldCanonical(value))
  assert.ok(expected.length > 8 * 1024 * 1024)
  sealCanonicalData(value)
  const open = fs.open
  try {
    for (const short of [false, true]) {
      const actual = []
      let writes = 0, syncs = 0, closes = 0, owned = false, chunks = 0
      fs.open = async (file, mode) => {
        assert.equal(mode, 'wx')
        return {
          write: async (bytes, offset, length) => {
            assert.ok(owned)
            assert.ok(length <= 1024 * 1024)
            writes++
            const count = short ? Math.min(length, 350003) : length
            const snapshot = Buffer.from(bytes.subarray(offset, offset + count))
            await new Promise(resolve => setImmediate(resolve))
            assert.deepEqual(bytes.subarray(offset, offset + count), snapshot)
            actual.push(snapshot)
            return { bytesWritten: count }
          },
          sync: async () => { syncs++ },
          close: async () => { closes++ },
        }
      }
      function* source() {
        for (const chunk of emitCanonicalChunks(value)) { chunks++; yield chunk }
      }
      const hash = await writeHashedCandidate('candidate', source(), { onOwned: () => { owned = true } })
      assert.deepEqual(Buffer.concat(actual), expected)
      assert.equal(hash, require('node:crypto').createHash('sha256').update(expected).digest('hex'))
      const batches = Math.ceil(expected.length / (1024 * 1024))
      assert.ok(writes >= batches && writes <= batches * (short ? 4 : 1))
      assert.ok(writes < chunks / 2)
      assert.equal(syncs, 1)
      assert.equal(closes, 1)
    }
  } finally { fs.open = open }
})

for (const stage of ['zero', 'negative', 'fraction', 'oversized', 'before-drain', 'before-tail-flush', 'after-last-write', 'short-abort', 'owned-error']) {
  test(`batched candidate rejects ${stage} without fsync`, async () => {
    const { writeHashedCandidate } = require('./durable-fs')
    const open = fs.open
    const controller = new AbortController()
    let writes = 0, syncs = 0, closes = 0
    fs.open = async () => ({
      write: async (bytes, offset, length) => {
        writes++
        if (['after-last-write', 'short-abort'].includes(stage)) controller.abort()
        const invalid = { zero: 0, negative: -1, fraction: 1.5, oversized: length + 1 }
        return { bytesWritten: stage in invalid ? invalid[stage] : stage === 'short-abort' ? 1 : length }
      },
      sync: async () => { syncs++ },
      close: async () => { closes++ },
    })
    function* chunks() {
      yield 'abc'
      if (stage === 'before-tail-flush') controller.abort()
      if (stage === 'before-drain') { controller.abort(); yield 'x'.repeat(1024 * 1024) }
    }
    try {
      await assert.rejects(writeHashedCandidate('candidate', chunks(), {
        signal: controller.signal,
        onOwned: () => { if (stage === 'owned-error') throw new Error('ownership callback') },
      }), /progress|abort|ownership/i)
      assert.equal(writes, ['before-drain', 'before-tail-flush', 'owned-error'].includes(stage) ? 0 : 1)
      assert.equal(syncs, 0)
      assert.equal(closes, 1)
    } finally { fs.open = open }
  })
}

test('ownership revoked during native temp-root sync cannot publish and releases the mutation queue', async () => {
  const { openPackageStore } = require('./index')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-sync-ownership-'))
  const open = fs.open
  let store
  try {
    store = await openPackageStore({ rootDir: dir })
    await store.acquireWriter()
    await store.mutate(() => {})
    const previous = store.getState()
    const previousRoot = await fs.readFile(store.metadata.rootPath)
    let revoked = false
    fs.open = async (file, ...args) => {
      const handle = await open(file, ...args)
      if (String(file).startsWith(`${store.metadata.rootPath}.`)) {
        const sync = handle.sync.bind(handle)
        handle.sync = async () => {
          await sync()
          await store.releaseWriter()
          revoked = true
        }
      }
      return handle
    }
    await assert.rejects(store.mutate(() => {}), /ownership cannot be verified/)
    fs.open = open
    assert.equal(revoked, true)
    assert.deepEqual(await fs.readFile(store.metadata.rootPath), previousRoot)
    assert.deepEqual(store.getState(), previous)
    assert.ok(!(await fs.readdir(dir)).some(name => name.startsWith('state-root.json.')))
    assert.equal((await fs.readdir(store.metadata.walDir)).filter(name => name.endsWith('.prepared.json')).length,
      (await fs.readdir(store.metadata.walDir)).filter(name => name.endsWith('.completed')).length + 1)
    const restarted = new StateStore(dir)
    await restarted.init()
    assert.deepEqual(restarted.state, previous)
    await store.acquireWriter()
    await store.mutate(() => {})
    assert.equal(store.getState().generation, previous.generation + 1)
  } finally {
    fs.open = open
    await store?.releaseWriter()
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('ownership revoked after native root rename still reports the published truth', async () => {
  const { openPackageStore } = require('./index')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'root-rename-ownership-'))
  const rename = fs.rename
  let store
  try {
    store = await openPackageStore({ rootDir: dir })
    await store.acquireWriter()
    const previous = store.getState()
    let revoked = false
    fs.rename = async (source, target) => {
      const result = await rename(source, target)
      if (target === store.metadata.rootPath) {
        await store.releaseWriter()
        revoked = true
      }
      return result
    }
    const published = await store.mutate(() => {})
    fs.rename = rename
    assert.equal(revoked, true)
    assert.equal(published.generation, previous.generation + 1)
    assert.deepEqual(store.getState(), published)
    const root = JSON.parse(await fs.readFile(store.metadata.rootPath, 'utf8'))
    assert.equal(root.storeGeneration, published.generation)
    assert.equal(await fs.readFile(path.join(store.metadata.walDir, `${root.transactionId}.completed`), 'utf8'), 'completed')
    const restarted = new StateStore(dir)
    await restarted.init()
    assert.deepEqual(restarted.state, published)
    assert.ok(!(await fs.readdir(dir)).some(name => name.startsWith('state-root.json.')))
  } finally {
    fs.rename = rename
    await store?.releaseWriter()
    await fs.rm(dir, { recursive: true, force: true })
  }
})

function oldCanonical(value) {
  if (Array.isArray(value)) return '[' + value.map(oldCanonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value)
    .filter((key) => value[key] !== undefined).sort()
    .map((key) => JSON.stringify(key) + ':' + oldCanonical(value[key])).join(',') + '}'
  return JSON.stringify(value)
}

test('streamed indexes match historical bytes and retain all multi-megabyte history on restart', async () => {
  const { prepareStreamingPublication } = require('./prepared-publication')
  const { emitCanonicalChunks, sealCanonicalData } = require('./canonical-json')
  assert.throws(() => [...emitCanonicalChunks(Object.freeze({ child: {} }))], /proven immutable/)
  const unicode = { text: 'a'.repeat(32766) + '😀漢字\ud800\udfff' + 'z'.repeat(70000) }
  sealCanonicalData(unicode)
  const chunks = [...emitCanonicalChunks(unicode)]
  assert.ok(chunks.every((chunk) => chunk.length <= 32768))
  assert.equal(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString(), oldCanonical(unicode))
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-history-'))
  try {
    const store = new StateStore(dir)
    await store.init()
    const draft = createEmptyState()
    draft.mutationResults = Array.from({ length: 8 }, (_, index) => ({
      schemaVersion: 1, idempotencyKey: 'key-' + index, presentationId: 'deck',
      projection: { title: 'history-' + index, data: 'é😀'.repeat(180000) },
    }))
    const expected = oldCanonical(draft)
    const prepared = prepareStreamingPublication(draft, null)
    assert.equal(prepared.stateBytes, undefined)
    assert.ok(prepared.chunks)
    assert.equal([...prepared.chunks].join(''), expected)
    await store.publish(draft, { assertWriter: async () => {} })
    const stored = await manifestBytes(draft)
    assert.equal(await fs.readFile(path.join(dir, store.root.stateFile), 'utf8'), stored)
    assert.equal(store.root.stateHash, await manifestHash(draft))
    assert.equal(JSON.parse(stored).type, STATE_MANIFEST_TYPE)
    assert.ok(stored.length < expected.length / 100)
    await store.reload()
    assert.deepEqual(store.state.mutationResults, draft.mutationResults)
    const retained = store.state.mutationResults
    const successor = { ...store.state, generation: store.state.generation + 1,
      mutationResults: [...retained, { schemaVersion: 1, idempotencyKey: 'successor',
        presentationId: 'deck', projection: { title: 'new 😀漢字' } }] }
    await store.publish(successor, { assertWriter: async () => {} })
    const reopened = new StateStore(dir)
    await reopened.init()
    assert.deepEqual(reopened.state.mutationResults.slice(0, retained.length), retained)
    assert.deepEqual(reopened.state, successor)
    const successorBytes = await fs.readFile(path.join(dir, reopened.root.stateFile))
    assert.deepEqual(successorBytes, Buffer.from(await manifestBytes(successor)))
    assert.equal(require('node:crypto').createHash('sha256').update(successorBytes).digest('hex'), reopened.root.stateHash)
    assert.ok(!(await fs.readdir(store.indexDir)).some((name) => name.endsWith('.tmp')))
    const invalid = createEmptyState()
    invalid.generation = -1
    await assert.rejects(store.publish(invalid, { assertWriter: async () => {} }), /Invalid state generation/)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('shared index loader binds manifest bytes, resolved generation/fence and record contents', async () => {
  const { loadStateIndex } = require('./state-index-loader')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-authority-'))
  try {
    const store = new StateStore(dir)
    await store.init()
    const draft = createEmptyState()
    draft.generation = 3
    draft.fencingEpoch = 8
    draft.mutationResults = [{ schemaVersion: 1, idempotencyKey: 'm', presentationId: 'p' }]
    await store.publish(draft, { assertWriter: async () => {} })
    const file = path.join(dir, store.root.stateFile)
    const bytes = await fs.readFile(file)
    await fs.writeFile(file, Buffer.concat([bytes, Buffer.from(' ')]))
    await assert.rejects(loadStateIndex(dir, store.root), /hash mismatch/)
    await fs.writeFile(file, bytes)
    for (const key of ['storeGeneration', 'fencingEpoch']) {
      await assert.rejects(loadStateIndex(dir, { ...store.root, [key]: store.root[key] + 1 }), /ownership mismatch/)
    }
    const manifest = JSON.parse(bytes)
    const ref = manifest.state.mutationResults.records[0]
    await fs.writeFile(store.recordStore.recordPath(ref), '{}')
    await assert.rejects(loadStateIndex(dir, store.root), /byte count mismatch/)
    // Raw legacy indexes intentionally retain parsed/canonical hashing.
    const legacy = createEmptyState()
    const legacyHash = hashRecord(legacy)
    const legacyFile = path.join('indexes', `${legacyHash}.json`)
    await fs.writeFile(path.join(dir, legacyFile), JSON.stringify(legacy, null, 2))
    const root = { ...store.root, stateHash: legacyHash, stateFile: legacyFile,
      storeGeneration: 0, fencingEpoch: 0, predecessor: null }
    assert.deepEqual((await loadStateIndex(dir, root)).state, legacy)
    await fs.writeFile(store.rootPath, JSON.stringify(root))
    await store.reload()
    await store.publish(legacy, { assertWriter: async () => {} })
    assert.equal(JSON.parse(await fs.readFile(path.join(dir, store.root.stateFile))).type, STATE_MANIFEST_TYPE)
    assert.ok(await fs.stat(path.join(dir, legacyFile)))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('stream candidate cancellation removes only its temporary file and keeps the predecessor', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'stream-abort-'))
  const originalOpen = fs.open
  try {
    const store = new StateStore(dir)
    await store.init()
    await store.publish(createEmptyState(), { assertWriter: async () => {} })
    const controller = new AbortController()
    fs.open = async (file, ...args) => {
      const handle = await originalOpen(file, ...args)
      if (String(file).includes('.candidate-')) {
        const write = handle.write.bind(handle)
        handle.write = async (...values) => {
          const result = await write(...values)
          controller.abort()
          return result
        }
      }
      return handle
    }
    const draft = createEmptyState()
    draft.generation = 1
    await assert.rejects(store.publish(draft, {
      assertWriter: async () => {}, signal: controller.signal,
    }), /abort/i)
    assert.ok(!(await fs.readdir(store.indexDir)).some((name) => name.endsWith('.tmp')))
    await store.reload()
    assert.equal(store.state.generation, 0)
  } finally {
    fs.open = originalOpen
    await fs.rm(dir, { recursive: true, force: true })
  }
})
