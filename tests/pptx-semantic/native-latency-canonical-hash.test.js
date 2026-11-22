// @vitest-environment node
/* eslint-disable no-sparse-arrays */
import { createRequire } from 'node:module'
import { test, vi } from 'vitest'
const require = createRequire(import.meta.url)
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { canonicalJson, hashRecord } = require('../../server/services/pptx-import/package-store/schemas')

// Independent, pre-optimization digest oracle (including its nonstandard slots).
function oldCanonical(value) {
  if (Array.isArray(value)) return `[${value.map(oldCanonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${oldCanonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
function equivalent(value) {
  const expected = oldCanonical(value)
  assert.equal(canonicalJson(value), expected)
  if (expected !== undefined) {
    assert.equal(hashRecord(value), crypto.createHash('sha256').update(expected).digest('hex'))
  } else {
    assert.throws(() => hashRecord(value), TypeError)
  }
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

test('exact strings and digest bytes: JSON domains and historical undefined slots', () => {
  const sparse = new Array(5)
  sparse[2] = [undefined, null, , '😀\ud800']
  const cases = [undefined, null, true, false, -0, 1e-30, 1e30, NaN, Infinity,
    '', '漢字\n"\\😀\ud800\udfff', [], {}, [undefined], sparse,
    { z: undefined, a: [null, undefined, { β: 'é', a: -0 }] },
    { '10': 10, '2': 2, '\ud800': 'lone', '😀': 'pair', a: null }]
  for (const value of cases) equivalent(value)
  assert.equal(canonicalJson([undefined, , undefined]), '[,,]')
  assert.equal(canonicalJson({ z: 1, a: 2 }), canonicalJson({ a: 2, z: 1 }))
})

test('deterministic nested record/array properties, cold and recursively immutable reuse', () => {
  let seed = 0x4321
  const random = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
  const leaves = [null, undefined, false, true, -0, 1e-7, 123.25, '😀', '\ud800', '\n漢字']
  function generate(depth) {
    if (!depth || random(3) === 0) return leaves[random(leaves.length)]
    if (random(2)) return Array.from({ length: random(6) }, () => generate(depth - 1))
    const value = {}
    for (let i = random(6); i >= 0; i--) value[`κ${i}`] = generate(depth - 1)
    return value
  }
  for (let i = 0; i < 400; i++) {
    const value = generate(5)
    equivalent(value)
    freeze(value)
    equivalent(value)
    equivalent({ changingEnvelope: i, subtree: value })
    equivalent({ subtree: value, changingEnvelope: i + 1 })
  }
})

test('mutable records, shallow freezes and shallow arrays never gain identity trust', () => {
  for (const wrap of [(child) => ({ child }), (child) => Object.freeze({ child }),
    (child) => Object.freeze([child])]) {
    const child = { nested: { text: 'before' }, list: [undefined, 1] }
    const value = wrap(child)
    equivalent(value)
    const before = hashRecord(value)
    child.nested.text = 'after😀'
    child.list.push(null)
    child.extra = { b: 2, a: 1 }
    equivalent(value)
    assert.notEqual(hashRecord(value), before)
    delete child.extra
    child.list[0] = 3
    equivalent(value)
  }
})

test('frozen accessors and frozen sparse arrays are not immutable cache receipts', () => {
  let current = { a: 1 }
  const value = Object.freeze({ get child() { return current } })
  equivalent(value)
  current = { a: 2 }
  equivalent(value)
  const sparse = Object.freeze(new Array(2))
  equivalent(sparse)
  Array.prototype[0] = 'inherited'
  try { equivalent(sparse) } finally { delete Array.prototype[0] }
})

test('canonical proof is performed once per root and reused, independently of semantic certification', () => {
  const { certifyImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const child = freeze({ nested: { text: '😀', omitted: undefined } })
  const document = certifyImmutableSemanticDocument(freeze({ instances: { child } }))
  const descriptors = vi.spyOn(Object, 'getOwnPropertyDescriptors')
  try {
    equivalent(document)
    for (const node of [document, document.instances, child, child.nested]) {
      assert.equal(descriptors.mock.calls.filter(([value]) => value === node).length, 1)
    }
    descriptors.mockClear()
    equivalent({ child })
    equivalent(document)
    assert.equal(descriptors.mock.calls.length, 0)
  } finally { descriptors.mockRestore() }
})

test('certified sparse subtrees still preserve inherited-slot semantics', () => {
  const { certifyImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const sparse = Object.freeze(new Array(2))
  const document = certifyImmutableSemanticDocument(Object.freeze({ sparse }))
  equivalent(document)
  Array.prototype[0] = 'inherited'
  try { equivalent(document) } finally { delete Array.prototype[0] }
})

test('dense arrays and ancestors never retain stale bytes or digests after inherited map changes', () => {
  const { certifyImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const array = freeze([1, undefined, '😀\ud800'])
  const roots = [array, freeze({ array }),
    certifyImmutableSemanticDocument(freeze({ nested: { array } })), freeze({ plain: 1 })]
  const before = roots.map((root) => { equivalent(root); return hashRecord(root) })
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  const nativeMap = descriptor.value
  try {
    Object.defineProperty(Array.prototype, 'map', { ...descriptor, value: function (callback, receiver) {
      return nativeMap.call(this, (item, index, source) =>
        `changed:${callback.call(receiver, item, index, source)}`)
    } })
    for (let i = 0; i < roots.length; i++) {
      equivalent(roots[i])
      assert.notEqual(hashRecord(roots[i]), before[i])
    }
  } finally { Object.defineProperty(Array.prototype, 'map', descriptor) }
  for (let i = 0; i < roots.length; i++) {
    equivalent(roots[i])
    assert.equal(hashRecord(roots[i]), before[i])
  }
})

test('custom map closures and certified proxy arrays do not receive digest receipts', () => {
  const { certifyImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  let text = 'before'
  const custom = [1]
  Object.defineProperty(custom, 'map', { value: () => [text] })
  Object.freeze(custom)
  const proxy = new Proxy(Object.freeze([1]), {
    get(target, key, receiver) {
      return key === 'map' ? () => [text] : Reflect.get(target, key, receiver)
    },
  })
  const certified = certifyImmutableSemanticDocument(Object.freeze({ proxy }))
  for (const root of [custom, certified]) {
    equivalent(root)
    const before = hashRecord(root)
    text += '😀'
    equivalent(root)
    assert.notEqual(hashRecord(root), before)
  }
})

test('semantic cycle certification cannot suppress historical cycle errors', () => {
  const { certifyImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const root = {}
  root.self = root
  certifyImmutableSemanticDocument(Object.freeze(root))
  assert.throws(() => oldCanonical(root), RangeError)
  assert.throws(() => canonicalJson(root), RangeError)
  assert.throws(() => hashRecord(root), RangeError)
})

test('immutable object digests are reused but accessors are evaluated on every call', () => {
  const root = freeze({ a: { text: 'digest😀' } })
  const createHash = vi.spyOn(crypto, 'createHash')
  try {
    const digest = hashRecord(root)
    assert.equal(hashRecord(root), digest)
    assert.equal(createHash.mock.calls.length, 1)
    let text = 'before'
    const accessor = Object.freeze({ get text() { return text } })
    const before = hashRecord(accessor)
    text = 'after'
    assert.notEqual(hashRecord(accessor), before)
    assert.equal(createHash.mock.calls.length, 3)
  } finally { createHash.mockRestore() }
})

test('dense immutable arrays measurably reuse serialization, proof and digest work', () => {
  const fs = require('node:fs')
  const vm = require('node:vm')
  const work = { serialize: 0, prove: 0, hashes: 0 }
  const source = fs.readFileSync(require.resolve('../../server/services/pptx-import/package-store/canonical-json'), 'utf8')
    .replace('function prove(value, proofs = new Map(), publication = false, register = true) {', 'function prove(value, proofs = new Map(), publication = false, register = true) { work.prove++;')
    .replace('function serialize(value) {', 'function serialize(value) { work.serialize++;')
    .replace("crypto.createHash('sha256')", "(work.hashes++, crypto.createHash('sha256'))")
  const context = { require, module: { exports: {} }, work }
  vm.runInNewContext(source + `
    const rows = []
    for (let i = 0; i < 200; i++) rows.push(Object.freeze({ i, values: Object.freeze([i, 'row', null]) }))
    globalThis.root = Object.freeze({ rows: Object.freeze(rows) })
  `, context)
  const api = context.module.exports
  const text = api.canonicalJson(context.root)
  assert.ok(work.serialize > 1000)
  assert.ok(work.prove > 1000)
  const cold = { ...work }
  assert.equal(api.canonicalJson(context.root), text)
  assert.equal(work.serialize - cold.serialize, 1)
  assert.equal(work.prove - cold.prove, 1)
  const digest = api.hashRecord(context.root)
  const warm = { ...work }
  assert.equal(api.hashRecord(context.root), digest)
  assert.deepEqual(work, warm)
  assert.equal(digest, crypto.createHash('sha256').update(text).digest('hex'))
})

test('explicit dispatch dependencies invalidate every root and restore safely', () => {
  const roots = [freeze([1, 2]), freeze({ rows: [1, 2] }), freeze({ z: 1, a: 2 })]
  for (const root of roots) equivalent(root)
  const variants = [
    [Array.prototype, 'join', function () { return 'joined' }],
    [Array.prototype, 'filter', function () { return [] }],
    [Array.prototype, 'sort', function () { return this.reverse() }],
    [Object, 'keys', function () { return [] }],
    [JSON, 'stringify', function () { return '123' }],
  ]
  for (const [owner, key, value] of variants) {
    const saved = Object.getOwnPropertyDescriptor(owner, key)
    try {
      Object.defineProperty(owner, key, { ...saved, value })
      for (const root of roots) { equivalent(root); equivalent(root) }
    } finally { Object.defineProperty(owner, key, saved) }
    for (const root of roots) equivalent(root)
  }
  const saved = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  let gets = 0
  try {
    Object.defineProperty(Array.prototype, 'map', { configurable: true, get() { gets++; return saved.value } })
    const expected = oldCanonical(roots[0])
    const oracleGets = gets
    gets = 0
    assert.equal(canonicalJson(roots[0]), expected)
    assert.equal(gets, oracleGets)
    gets = 0
    hashRecord(roots[0])
    assert.equal(gets, oracleGets)
  } finally { Object.defineProperty(Array.prototype, 'map', saved) }
  for (const root of roots) equivalent(root)
  const prototype = Object.create(Array.prototype)
  prototype.map = () => ['first']
  const unusual = Object.freeze(Object.setPrototypeOf([1], prototype))
  equivalent(unusual)
  prototype.map = () => ['second']
  equivalent(unusual)
})

test('untrusted getters, custom maps and proxies cannot reuse warmed subtrees during dispatch changes', () => {
  const child = freeze({ rows: [1, 2] })
  const saved = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  const changed = function (callback, receiver) {
    return saved.value.call(this, (item, index, source) =>
      `changed:${callback.call(receiver, item, index, source)}`)
  }
  const change = () => Object.defineProperty(Array.prototype, 'map', { ...saved, value: changed })
  const restore = () => Object.defineProperty(Array.prototype, 'map', saved)
  const getter = Object.freeze({
    get a() { change(); return child },
    get z() { restore(); return 0 },
  })
  const custom = Object.freeze(Object.defineProperty([child], 'map', {
    value(callback) {
      change()
      try { return [callback(child)] } finally { restore() }
    },
  }))
  const proxy = new Proxy(Object.freeze({ child }), {
    get(target, key, receiver) {
      change()
      return Reflect.get(target, key, receiver)
    },
  })
  for (const root of [getter, custom, proxy]) {
    try {
      restore()
      const expected = oldCanonical(root)
      restore()
      equivalent(child) // Warm all subtree receipts under native dispatch.
      assert.equal(canonicalJson(root), expected)
      restore()
      equivalent(child)
      assert.equal(hashRecord(root), crypto.createHash('sha256').update(expected).digest('hex'))
    } finally { restore() }
  }
})

test('dispatch descriptor work stays constant for cold and warm proven roots', () => {
  const fs = require('node:fs')
  const vm = require('node:vm')
  const context = { require, module: { exports: {} } }
  vm.createContext(context)
  // Install before module loading because the guard deliberately captures it.
  vm.runInContext(`
    globalThis.descriptorReads = 0
    const originalDescriptor = Object.getOwnPropertyDescriptor
    Object.getOwnPropertyDescriptor = function (...args) {
      descriptorReads++
      return originalDescriptor(...args)
    }
  `, context)
  vm.runInContext(fs.readFileSync(require.resolve('../../server/services/pptx-import/package-store/canonical-json'), 'utf8'), context)
  vm.runInContext(`
    globalThis.small = Object.freeze({ rows: Object.freeze([1]) })
    globalThis.large = Object.freeze({ rows: Object.freeze(Array.from({ length: 2000 },
      (_, i) => Object.freeze({ i, values: Object.freeze([i, 'row', null]) }))) })
  `, context)
  const api = context.module.exports
  function reads(operation) {
    context.descriptorReads = 0
    operation()
    return context.descriptorReads
  }
  const small = reads(() => api.canonicalJson(context.small))
  assert.ok(small > 0)
  assert.equal(reads(() => api.canonicalJson(context.large)), small)
  assert.equal(reads(() => api.canonicalJson(context.large)), small)
  assert.equal(reads(() => api.hashRecord(context.large)), small * 2)
  assert.equal(reads(() => api.hashRecord(context.large)), small)
})

test('fresh mutable envelopes reuse 10k immutable records with branch-only dispatch work', () => {
  const fs = require('node:fs')
  const vm = require('node:vm')
  const work = { serialize: 0, prove: 0, guards: 0 }
  const source = fs.readFileSync(require.resolve('../../server/services/pptx-import/package-store/canonical-json'), 'utf8')
    .replace('function prove(value, proofs = new Map(), publication = false, register = true) {', 'function prove(value, proofs = new Map(), publication = false, register = true) { work.prove++;')
    .replace('function serialize(value) {', 'function serialize(value) { work.serialize++;')
    .replace('function guardDispatch() {', 'function guardDispatch() { work.guards++;')
  const context = { require, module: { exports: {} }, work }
  vm.runInNewContext(source + `
    globalThis.rows = Object.freeze(Array.from({ length: 10000 },
      (_, i) => Object.freeze({ i, text: 'record' })))
    globalThis.envelope = () => ({ canonicalBefore: rows, canonicalAfter: rows })
  `, context)
  const api = context.module.exports
  const expected = oldCanonical(context.envelope())
  assert.equal(api.canonicalJson(context.envelope()), expected)
  assert.ok(work.serialize > 10000)
  const cold = { ...work }
  for (let i = 0; i < 3; i++) assert.equal(api.canonicalJson(context.envelope()), expected)
  // Oversized array text is not retained, but each record is: only two array
  // walks and cached record visits, with no recursive record/property work.
  assert.equal(work.serialize - cold.serialize, 3 * 2 * 10001)
  assert.equal(work.prove - cold.prove, 3 * 3)
  assert.equal(work.guards - cold.guards, 3 * 3)
})

test('getter dispatch changes between trusted branches invalidate warmed receipts', () => {
  const child = freeze({ rows: [1, 2] })
  const saved = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  function run(operation) {
    canonicalJson(child)
    let gets = 0
    const root = {
      a: child,
      get m() {
        gets++
        Object.defineProperty(Array.prototype, 'map', { ...saved, value(callback, receiver) {
          return saved.value.call(this, (item, index, source) =>
            `changed:${callback.call(receiver, item, index, source)}`)
        } })
        return 0
      },
      z: child,
    }
    try { return { text: operation(root), gets } }
    finally { Object.defineProperty(Array.prototype, 'map', saved) }
  }
  const expected = run(oldCanonical)
  assert.deepEqual(run(canonicalJson), expected)
  assert.deepEqual(run(hashRecord), {
    text: crypto.createHash('sha256').update(expected.text).digest('hex'), gets: expected.gets,
  })
  equivalent(child)
})

test('cache payload rollover preserves exact digests for large retained immutable graphs', () => {
  const values = Array.from({ length: 40 }, (_, i) => freeze({ i, text: '😀'.repeat(60000) }))
  for (const value of values) equivalent(value)
  for (const value of values.reverse()) equivalent({ nested: [value, undefined] })
})

test('owned large roots stream exact UTF-8 tokens without building full canonical text', () => {
  const work = { serialize: 0, updates: [] }
  const source = require('node:fs').readFileSync(require.resolve('../../server/services/pptx-import/package-store/canonical-json'), 'utf8')
    .replace('function serialize(value) {', 'function serialize(value) { work.serialize++;')
    .replaceAll('hash.update(', 'update(')
    .replace("const hash = crypto.createHash('sha256')", "const hash = crypto.createHash('sha256'); const update = (text) => { work.updates.push(text); hash.update(text) }")
  const context = { require, module: { exports: {} }, work }
  require('node:vm').runInNewContext(source + `
    function freeze(value) {
      if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze)
        Object.freeze(value)
      }
      return value
    }
    globalThis.child = freeze({ text: 'cached😀' })
    globalThis.root = freeze({ child, omitted: undefined,
      rows: Array.from({ length: 12000 }, (_, i) => ({
        z: [undefined, '漢字😀\\ud800\\udfff', i], a: 'x'.repeat(23),
      })), largeToken: '😀'.repeat(40000) })
  `, context)
  const api = context.module.exports
  const { child, root } = context
  api.canonicalJson(child) // Streaming must reuse already-retained small text.
  work.serialize = 0
  const expected = oldCanonical(root)
  assert.ok(expected.length > 256 * 1024)
  assert.equal(api.hashRecord(root), crypto.createHash('sha256').update(expected).digest('hex'))
  assert.equal(work.serialize, 0)
  assert.ok(work.updates.length > 10)
  assert.equal(work.updates.join(''), expected)
  for (const chunk of work.updates) {
    const last = chunk.charCodeAt(chunk.length - 1)
    assert.ok(!(last >= 0xd800 && last <= 0xdbff), 'no split surrogate at update boundary')
  }
  assert.equal(api.canonicalJson(root), expected)
})

test('iterative chunks preserve deep shared aliases, omitted keys and UTF-8 oracle bytes cold and cached', () => {
  const { emitCanonicalChunks } = require('../../server/services/pptx-import/package-store/canonical-json')
  const shared = freeze({ z: [undefined, undefined, null, '😀\ud800\udfff'], a: '漢字', omitted: undefined })
  let nested = shared
  for (let i = 0; i < 300; i++) nested = Object.freeze({ z: undefined, b: [nested, undefined], a: shared })
  Object.freeze(nested.b)
  // Freeze each intermediate array as well, without warming serialization.
  let cursor = nested
  while (cursor !== shared) { Object.freeze(cursor.b); cursor = cursor.b[0] }
  const root = Object.freeze({ z: shared, nested, a: shared, missing: undefined,
    large: 'x'.repeat(32760) + '😀漢字\ud800'.repeat(20000) })
  const expected = oldCanonical(root)
  const digest = crypto.createHash('sha256').update(expected).digest('hex')
  assert.equal(hashRecord(root), digest) // Cold owned DFS, not canonicalJson's retained text.
  function check() {
    const chunks = [...emitCanonicalChunks(root)]
    assert.equal(chunks.join(''), expected)
    assert.deepEqual(Buffer.concat(chunks.map(chunk => Buffer.from(chunk))), Buffer.from(expected))
    assert.ok(chunks.length > 5)
    for (const chunk of chunks) {
      assert.ok(chunk.length > 0 && chunk.length <= 32 * 1024)
      const last = chunk.charCodeAt(chunk.length - 1)
      assert.ok(!(last >= 0xd800 && last <= 0xdbff))
    }
  }
  check()
  canonicalJson(shared) // Existing retained subtree strings remain a valid path.
  check()
  assert.equal(hashRecord(root), digest)
})

test('owned emitter and hash traverse already-proven depth beyond the JavaScript call stack', () => {
  const { sealCanonicalData, emitCanonicalChunks } = require('../../server/services/pptx-import/package-store/canonical-json')
  let root = { text: '😀漢字' }
  assert.equal(sealCanonicalData(root), true)
  const depth = 12000
  // Incremental proofs keep proof recursion out of this traversal regression.
  for (let i = 0; i < depth; i++) {
    root = { child: root }
    assert.equal(sealCanonicalData(root), true)
  }
  const expected = '{"child":'.repeat(depth) + oldCanonical({ text: '😀漢字' }) + '}'.repeat(depth)
  assert.equal(hashRecord(root), crypto.createHash('sha256').update(expected).digest('hex'))
  assert.equal([...emitCanonicalChunks(root)].join(''), expected)
})

test('publication allocation grants canonical receipts in one checked traversal', () => {
  const { sealPublication, isSealedPublication } = require('../../server/services/pptx-import/package-store/publication-snapshot')
  const root = { rows: [{ z: '😀\ud800', a: 1 }, { value: null }] }
  const expected = oldCanonical(root)
  const descriptors = vi.spyOn(Object, 'getOwnPropertyDescriptors')
  try {
    sealPublication(root)
    assert.equal(isSealedPublication(root), true)
    assert.equal(isSealedPublication(root.rows[0]), true)
    for (const node of [root, root.rows, ...root.rows]) {
      assert.equal(descriptors.mock.calls.filter(([value]) => value === node).length, 1)
      assert.ok(Object.isFrozen(node))
    }
    descriptors.mockClear()
    assert.equal(canonicalJson(root), expected)
    equivalent({ root })
    assert.equal(descriptors.mock.calls.length, 0)
  } finally { descriptors.mockRestore() }
})

test('checked clones bridge descriptor proof but still serialize bytes and undergo semantic admission', () => {
  const { cloneImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')
  const { sealPublication, isSealedPublication } = require('../../server/services/pptx-import/package-store/publication-snapshot')
  const input = { schemaVersion: 999, rows: Array.from({ length: 200 }, (_, i) => ({ i, values: [i, '😀', null] })) }
  const root = cloneImmutableSemanticDocument(input, { maxDepth: 100, maxInstances: 10000, maxComponents: 10000 })
  const expected = oldCanonical(input)
  const descriptors = vi.spyOn(Object, 'getOwnPropertyDescriptors')
  const work = { serialize: 0 }
  const source = require('node:fs').readFileSync(require.resolve('../../server/services/pptx-import/package-store/canonical-json'), 'utf8')
    .replace('function serialize(value) {', 'function serialize(value) { work.serialize++;')
  const context = { require, module: { exports: {} }, work }
  require('node:vm').runInNewContext(source, context)
  const measured = context.module.exports
  try {
    measured.sealCanonicalData(root)
    sealPublication(root)
    assert.equal(isSealedPublication(root), true)
    assert.equal(descriptors.mock.calls.length, 0)
    assert.equal(work.serialize, 0) // Sealing does not pre-serialize.
    assert.equal(measured.canonicalJson(root), expected)
    assert.ok(work.serialize > 400) // First actual serialization is required.
    assert.equal(descriptors.mock.calls.length, 0)
    const cold = work.serialize
    assert.equal(measured.canonicalJson(root), expected)
    assert.equal(work.serialize - cold, 1)
    assert.equal(hashRecord(root), crypto.createHash('sha256').update(expected).digest('hex'))
    assert.throws(() => normalizePptxSemanticDocument(root)) // Byte proof is not schema admission.
  } finally { descriptors.mockRestore() }
})

test('checked clone bridge does not grant receipts under changed dispatch', () => {
  const { cloneImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const { sealCanonicalData, isSealedCanonicalData } = require('../../server/services/pptx-import/package-store/canonical-json')
  const root = cloneImmutableSemanticDocument({ rows: [1, 2] }, { maxDepth: 20, maxInstances: 20, maxComponents: 20 })
  const saved = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  try {
    Object.defineProperty(Array.prototype, 'map', { ...saved, value(callback, receiver) {
      return saved.value.call(this, (item, index, source) => `changed:${callback.call(receiver, item, index, source)}`)
    } })
    sealCanonicalData(root)
    assert.equal(isSealedCanonicalData(root), false)
    equivalent(root)
  } finally { Object.defineProperty(Array.prototype, 'map', saved) }
  equivalent(root)
  assert.equal(isSealedCanonicalData(root), true)
})

test('oversized checked canonical strings share exact bounded digest receipts', () => {
  const { cloneImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  const root = cloneImmutableSemanticDocument({ rows: [{ text: '😀漢字\ud800'.repeat(70000) }] },
    { maxDepth: 20, maxInstances: 20, maxComponents: 20 })
  const expected = oldCanonical(root)
  const digest = crypto.createHash('sha256').update(expected).digest('hex')
  const hashes = vi.spyOn(crypto, 'createHash')
  try {
    assert.equal(canonicalJson(root), expected)
    assert.equal(hashes.mock.calls.length, 1)
    assert.equal(hashRecord(root), digest)
    assert.equal(canonicalJson(root), expected)
    assert.equal(hashRecord(root), digest)
    assert.equal(hashes.mock.calls.length, 1)
  } finally { hashes.mockRestore() }
})

test('oversized shared digest obeys dispatch invalidation and late prototype changes', () => {
  const root = freeze({ rows: ['😀'.repeat(150000), undefined] })
  const expected = oldCanonical(root)
  canonicalJson(root)
  const map = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  const toJSON = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON')
  try {
    Object.defineProperty(Object.prototype, 'toJSON', { configurable: true,
      value() { return 'not historical canonical dispatch' } })
    equivalent(root)
    Object.defineProperty(Array.prototype, 'map', { ...map, value(callback, receiver) {
      return map.value.call(this, (value, index, source) =>
        `changed:${callback.call(receiver, value, index, source)}`)
    } })
    assert.notEqual(oldCanonical(root), expected)
    equivalent(root)
  } finally {
    Object.defineProperty(Array.prototype, 'map', map)
    if (toJSON) Object.defineProperty(Object.prototype, 'toJSON', toJSON)
    else delete Object.prototype.toJSON
  }
  equivalent(root)
})

test('strict publication receipts reject malformed canonical and certified graphs', () => {
  const { sealPublication, isSealedPublication } = require('../../server/services/pptx-import/package-store/publication-snapshot')
  const { certifyImmutableSemanticDocument } = require('revealjs-shared/src/pptx-semantic-records.js')
  let text = 'before'
  const custom = Object.freeze(Object.defineProperty([1], 'map', { value: () => [text] }))
  const getter = Object.freeze({ get value() { return text } })
  const proxy = new Proxy(Object.freeze([1]), { get(target, key, receiver) {
    return key === 'map' ? () => [text] : Reflect.get(target, key, receiver)
  } })
  for (const extra of [custom, getter, proxy, Object.freeze(new Array(2)),
    { value: undefined }, { value: Infinity }, new Map(),
    Object.defineProperty({}, 'hidden', { value: 1 })]) {
    const root = Object.freeze({ extra: Object.freeze(extra) })
    if (extra === custom || extra === proxy) certifyImmutableSemanticDocument(root)
    sealPublication(root)
    assert.equal(isSealedPublication(root), false)
    equivalent(root)
    text += 'after'
    equivalent(root)
  }
})

test('publication canonical receipts obey dispatch invalidation and restoration', () => {
  const { sealPublication } = require('../../server/services/pptx-import/package-store/publication-snapshot')
  const root = { rows: [1, 2] }
  sealPublication(root)
  equivalent(root)
  const saved = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  try {
    Object.defineProperty(Array.prototype, 'map', { ...saved, value(callback, receiver) {
      return saved.value.call(this, (item, index, source) => `changed:${callback.call(receiver, item, index, source)}`)
    } })
    sealPublication(root)
    equivalent(root)
  } finally { Object.defineProperty(Array.prototype, 'map', saved) }
  equivalent(root)
})
