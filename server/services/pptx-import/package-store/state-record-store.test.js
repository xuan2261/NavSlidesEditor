const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { StateRecordStore } = require('./state-record-store')
const { sealCanonicalData } = require('./canonical-json')
const options = { assertWriter: async () => {} }
const oracle = (v) => Array.isArray(v) ? `[${v.map(oracle).join(',')}]` :
  v && typeof v === 'object' ? `{${Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => `${JSON.stringify(k)}:${oracle(v[k])}`).join(',')}}` : JSON.stringify(v)
async function fixture(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'state-record-'))
  try { await run(new StateRecordStore(dir), dir) } finally { await fs.rm(dir, { recursive: true, force: true }) }
}

test('historical byte oracle, Unicode and mutable isolation', async () => {
  await fixture(async (store) => {
    const value = { z: ['é😀\ud800x\udfff'.repeat(20000), null, 42], a: { retained: true } }
    const expected = Buffer.from(oracle(value))
    const ref = await store.put(value, options)
    assert.deepEqual(ref, { hash: crypto.createHash('sha256').update(expected).digest('hex'), bytes: expected.length })
    assert.deepEqual(await fs.readFile(store.recordPath(ref)), expected)
    assert.equal(Object.isFrozen(value.a), false)
    const read = await store.get(ref)
    read.a.retained = false
    assert.equal((await store.get(ref)).a.retained, true)
    value.a.retained = false
    assert.notEqual((await store.put(value, options)).hash, ref.hash)
    assert.equal((await store.listRecords()).length, 2)
    assert.deepEqual(await new StateRecordStore(store.rootDir).get(ref), JSON.parse(expected))
  })
})

test('own undefined object fields preserve historical bytes without changing caller data', async () => {
  await fixture(async (store) => {
    const value = { omitted: undefined, nested: { omitted: undefined, kept: 1 }, list: [{ omitted: undefined }] }
    const expected = Buffer.from(oracle(value))
    const ref = await store.put(value, options)
    assert.deepEqual(await fs.readFile(store.recordPath(ref)), expected)
    assert.deepEqual(await store.get(ref), JSON.parse(expected))
    assert.equal(Object.hasOwn(value, 'omitted'), true)
    assert.equal(Object.isFrozen(value.nested), false)
  })
})

test('projection rejects invalid arrays and nonplain/accessor inputs without invoking getters', async () => {
  await fixture(async (store) => {
    const metadata = [1]
    metadata.extra = undefined
    const symbolMetadata = [1]
    symbolMetadata[Symbol('extra')] = 2
    for (const value of [metadata, symbolMetadata]) {
      await assert.rejects(store.put(value, options), /plain JSON/)
    }
    let calls = 0
    const accessor = { get field() { calls++; return 1 } }
    for (const value of [accessor, new Date(), new Map(), new Proxy({}, {}),
      [undefined], new Array(2), { nested: [1, undefined] }, { n: NaN }]) {
      await assert.rejects(store.put(value, options), /plain JSON/)
    }
    assert.equal(calls, 0)
    assert.deepEqual(await store.listRecords(), [])
  })
})

test('detaches before writer awaits and supports primitive JSON', async () => {
  await fixture(async (store) => {
    const value = { nested: { n: 1 } }
    const ref = await store.put(value, { assertWriter: async () => { value.nested.n = 2 } })
    assert.equal((await store.get(ref)).nested.n, 1)
    for (const primitive of [null, true, 23, 'é😀']) {
      assert.equal(await store.get(await store.put(primitive, options)), primitive)
    }
  })
})

test('corruption, directories, invalid refs and malformed JSON fail closed without overwrite', async () => {
  await fixture(async (store) => {
    const value = { n: 1 }
    const ref = await store.put(value, options)
    const file = store.recordPath(ref)
    await fs.writeFile(file, '{"n":2}')
    await assert.rejects(store.get(ref), /hash/)
    await assert.rejects(store.put(value, options), /mismatch/)
    assert.equal(await fs.readFile(file, 'utf8'), '{"n":2}')
    await fs.unlink(file)
    await fs.mkdir(file)
    await assert.rejects(store.put(value, options), /regular file/)
    await assert.rejects(store.get(ref), /regular file/)
    await assert.rejects(store.get({ hash: '../escape', bytes: 0 }), /reference/)
    await assert.rejects(store.get({ hash: ref.hash, bytes: -1 }), /reference/)
    const invalid = Buffer.from('{bad json')
    const bad = { hash: crypto.createHash('sha256').update(invalid).digest('hex'), bytes: invalid.length }
    await fs.writeFile(store.recordPath(bad), invalid)
    await assert.rejects(store.get(bad), SyntaxError)
  })
})

test('immutable receipts are store-local and never hide corruption or bypass fencing', async () => {
  await fixture(async (store, dir) => {
    const value = { nested: [1, 2] }
    assert.equal(sealCanonicalData(value), true)
    const ref = await store.put(value, options)
    assert.deepEqual(await store.put(value, options), ref)
    await assert.rejects(store.put(value, { assertWriter: async () => { throw new Error('fenced') } }), /fenced/)
    const other = new StateRecordStore(path.join(dir, 'other'))
    assert.deepEqual(await other.put(value, options), ref)
    assert.deepEqual(await other.get(ref), value)
    await fs.writeFile(store.recordPath(ref), 'bad')
    await assert.rejects(store.put(value, options), /mismatch/)
    await assert.rejects(new StateRecordStore(dir).put(value, options), /mismatch/)
  })
})

test('warm receipts verify every byte without parsing; get retains fresh ownership', async () => {
  await fixture(async (store) => {
    const value = { nested: { text: 'é😀'.repeat(30000) } }
    assert.equal(sealCanonicalData(value), true)
    const ref = await store.put(value, options)
    const parse = JSON.parse
    let parses = 0
    JSON.parse = (...args) => { parses++; return parse(...args) }
    try {
      assert.strictEqual(await store.put(value, options), ref)
      assert.equal(parses, 0)
      const first = await store.get(ref)
      first.nested.text = 'changed'
      assert.deepEqual(await store.get(ref), value)
      assert.equal(parses, 2)
      await assert.rejects(store.get({ ...ref, bytes: ref.bytes + 1 }), /byte count mismatch/)
      const file = store.recordPath(ref)
      const bytes = await fs.readFile(file)
      bytes[bytes.length - 3] ^= 1
      await fs.writeFile(file, bytes)
      await assert.rejects(store.put(value, options), /hash\/byte count mismatch/)
      await assert.rejects(store.get(ref), /hash\/byte count mismatch/)
      assert.equal(parses, 2)
      await fs.writeFile(file, bytes.subarray(0, bytes.length - 1))
      await assert.rejects(store.put(value, options), /byte count mismatch/)
      assert.equal(parses, 2)
    } finally { JSON.parse = parse }
  })
})

test('abort and fencing clean owned candidates; inventory ignores nonrecord names', async () => {
  await fixture(async (store) => {
    const controller = new AbortController()
    controller.abort()
    await assert.rejects(store.put({ n: 1 }, { ...options, signal: controller.signal }), /abort/i)
    let fences = 0
    await assert.rejects(store.put({ n: 1 }, { assertWriter: async () => {
      if (++fences === 2) throw new Error('fenced')
    } }), /fenced/)
    assert.deepEqual(await fs.readdir(store.recordsDir), [])
    await fs.writeFile(path.join(store.recordsDir, '.candidate-crash.tmp'), 'partial')
    await fs.writeFile(path.join(store.recordsDir, 'not-a-hash.json'), '{}')
    assert.deepEqual(await store.listRecords(), [])
    await assert.rejects(store.put({}, {}), /assertWriter/)
  })
})

for (const mode of ['short', 'zero', 'sync-error', 'abort']) {
  test(`durable helper handles ${mode} writes without partial publication`, async () => {
    await fixture(async (store) => {
      const open = fs.open
      const controller = new AbortController()
      fs.open = async (file, ...args) => {
        const handle = await open(file, ...args)
        if (!String(file).includes('.candidate-')) return handle
        const write = handle.write.bind(handle)
        handle.write = async (bytes, offset, length) => {
          if (mode === 'zero') return { bytesWritten: 0 }
          if (mode === 'abort') controller.abort()
          return write(bytes, offset, Math.min(length, 17))
        }
        if (mode === 'sync-error') handle.sync = async () => { throw new Error('sync failed') }
        return handle
      }
      try {
        const value = { text: 'é😀'.repeat(1000) }
        const operation = store.put(value, { ...options, signal: controller.signal })
        if (mode === 'short') assert.deepEqual(await store.get(await operation), value)
        else {
          await assert.rejects(operation, /progress|sync failed|abort/i)
          assert.deepEqual(await store.listRecords(), [])
          assert.deepEqual(await fs.readdir(store.recordsDir), [])
        }
      } finally { fs.open = open }
    })
  })
}
