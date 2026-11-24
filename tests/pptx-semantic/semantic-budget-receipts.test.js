// @vitest-environment node
import { createRequire } from 'node:module'
import { test, expect } from 'vitest'
const require = createRequire(import.meta.url)
const {
  chargeSemanticBudget: charge,
  measureSemanticBudget: measure,
} = require('../../shared/src/pptx-semantic-budget-receipts')
const {
  cloneImmutableSemanticDocument: clone,
  certifyImmutableSemanticDocument: certify,
  isCheckedImmutableSemanticValue: owned,
} = require('../../shared/src/pptx-semantic-records')
const { PptxSemanticValidationError } = require('../../shared/src/pptx-semantic-document')
const limits = { maxDepth: 256, maxInstances: 100000, maxComponents: 100000, maxBytes: 8388608 }
const freeze = (v) => {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze)
    Object.freeze(v)
  }
  return v
}
function check(value) {
  const checked = clone(value, limits)
  const m = measure(checked)
  expect(measure(value)).toEqual(m)
  expect(m.jsonBytes).toBe(Buffer.byteLength(JSON.stringify(checked)))
  expect(measure(checked, { maxBytes: m.jsonBytes })).toEqual(m)
  if (m.jsonBytes > 1)
    expect(() => measure(checked, { maxBytes: m.jsonBytes - 1 })).toThrow(/byte budget/)
  return checked
}
test('exact UTF-8 JSON bytes for Unicode, escaping, numeric keys and primitives', () => {
  for (const value of [
    null,
    true,
    false,
    0,
    -0,
    1e30,
    0.000001,
    '',
    '\ud800',
    '\udfff',
    '😀',
    { 10: 'x', 2: 'y', '"\\/\n\t\u0000😀\ud800': ['é漢', '\udfff', null] },
    Object.assign(Object.create(null), { a: 'x' }),
    [],
    {},
  ])
    check(value)
})
test('generated UTF-16 strings and keys match the JSON UTF-8 oracle at exact boundaries', () => {
  const strings = [
    '',
    '"\\/\b\t\n\f\r',
    '\u2028\u2029',
    '\ud800\ud800\udc00\udfff\udbff',
    '\udc00\ud800',
    '\udbff\udfff',
  ]
  // Cover every BMP code unit, including every control and lone surrogate.
  for (let start = 0; start < 0x10000; start += 256) {
    strings.push(Array.from({ length: 256 }, (_, i) => String.fromCharCode(start + i)).join(''))
  }
  let seed = 0x7cf
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0)
  const edges = [
    0, 8, 9, 10, 12, 13, 31, 32, 34, 47, 92, 127, 128, 2047, 2048, 0x2028, 0x2029, 0xd7ff, 0xd800,
    0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff,
  ]
  for (let n = 0; n < 256; n++) {
    let text = ''
    for (let i = 0, length = next() % 80; i < length; i++)
      text += String.fromCharCode(i % 2 ? next() & 0xffff : edges[next() % edges.length])
    strings.push(text)
  }
  for (const text of strings) {
    check(text)
    check({ [text]: text })
  }
  for (const number of [
    -0,
    Number.MIN_VALUE,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    1e-7,
    1e-6,
    1e20,
    1e21,
    -1e21,
    1.2345678901234567,
  ])
    check(number)
})
test('cold and warm alias receipts retain all metrics and exact byte rejection', () => {
  const leaf = { '\u2028\ud800': ['\udbff\udfff', '\u0001', true, false, null, -0, 1e21] }
  const raw = { first: leaf, second: leaf }
  const checked = clone(raw, limits)
  const expected = {
    nodeCount: 19,
    maxRelativeDepth: 3,
    maxArrayLength: 7,
    jsonBytes: Buffer.byteLength(JSON.stringify(raw)),
  }
  for (const value of [raw, checked, checked]) {
    expect(measure(value, { maxBytes: expected.jsonBytes })).toEqual(expected)
    expect(() =>
      measure(value, { maxBytes: expected.jsonBytes - 1 }, PptxSemanticValidationError)
    ).toThrow(PptxSemanticValidationError)
  }
})
test('certification preserves ownership but cannot grant it to raw frozen roots or proxies', () => {
  const checked = check({ a: [1, 2] })
  expect(owned(checked)).toBe(true)
  expect(owned(checked.a)).toBe(true)
  certify(checked)
  expect(owned(checked)).toBe(true)
  const raw = certify(freeze({ a: [1, 2] }))
  expect(owned(raw)).toBe(false)
  expect(owned(raw.a)).toBe(false)
  expect(owned(new Proxy(checked, {}))).toBe(false)
})
test('warm owned receipts charge repeated aliases, relative depth and array lengths', () => {
  const leaf = check({ a: [1, 2, 3] })
  const root = check({ first: leaf, second: leaf })
  expect(measure(root).nodeCount).toBe(11)
  for (const value of [root, { nested: root }]) {
    expect(() => measure(value, { maxDepth: 2 })).toThrow(/data budget/)
    expect(() => measure(value, { maxComponents: 2 })).toThrow(/array budget/)
  }
  const records = check(Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, 1])))
  expect(() => measure(records, { maxInstances: 1, maxComponents: 1 })).toThrow(/data budget/)
  expect(measure(records, { maxInstances: 2, maxComponents: 1 }).nodeCount).toBe(12)
})
test('raw proxies have no identity trust and shallow freezes cannot hide changed children', () => {
  let reads = 0
  const proxy = new Proxy(freeze({ a: 1 }), {
    ownKeys(v) {
      reads++
      return Reflect.ownKeys(v)
    },
  })
  measure(proxy)
  const before = reads
  measure(proxy)
  expect(reads).toBeGreaterThan(before)
  const shallow = Object.freeze({ child: { text: 'x' } })
  measure(shallow)
  shallow.child.text = '😀'.repeat(50)
  expect(() => measure(shallow, { maxBytes: 40 })).toThrow(/byte budget/)
  const child = check({ text: 'x' })
  expect(() => measure({ child, changed: '😀'.repeat(50) }, { maxBytes: 40 })).toThrow(
    /byte budget/
  )
})
test('invalid descriptors and JSON values are rejected without invoking getters', () => {
  let calls = 0
  const accessor = Object.defineProperty({}, 'a', {
    enumerable: true,
    get() {
      calls++
      return 1
    },
  })
  for (const v of [
    undefined,
    [undefined],
    NaN,
    Infinity,
    1n,
    () => 1,
    new Date(),
    accessor,
    Object.defineProperty({}, 'a', { value: 1 }),
    Array(3),
    { [Symbol('x')]: 1 },
    { constructor: 1 },
    {
      toJSON() {
        calls++
        return {}
      },
    },
    Object.assign([1], { extra: 2 }),
  ]) {
    expect(() => measure(v)).toThrow()
  }
  expect(calls).toBe(0)
  const cycle = {}
  cycle.self = cycle
  expect(() => measure(cycle)).toThrow(/cycle/)
})
test('injected normalizer errors preserve every strict budget rejection on warm receipts', () => {
  const value = check({ a: [1, 2, 3] })
  const records = check(Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, 1])))
  const cycle = {}
  cycle.self = cycle
  let calls = 0
  const accessor = Object.defineProperty({}, 'a', {
    enumerable: true,
    get() {
      calls++
      return 1
    },
  })
  for (const [input, options] of [
    [value, { maxDepth: 1 }],
    [value, { maxComponents: 2 }],
    [records, { maxInstances: 1, maxComponents: 1 }],
    [value, { maxBytes: 1 }],
    ...[0, -1, 1.5, Infinity].map((maxBytes) => [value, { maxBytes }]),
    [cycle, {}],
    [accessor, {}],
    [{ transactionEligible: true }, {}],
    [NaN, {}],
  ]) {
    let original
    try {
      measure(input, options)
    } catch (error) {
      original = error
    }
    expect(original).toBeDefined()
    expect(() => measure(input, options, PptxSemanticValidationError)).toThrow(
      PptxSemanticValidationError
    )
    expect(() => measure(input, options, PptxSemanticValidationError)).toThrow(original.message)
  }
  expect(calls).toBe(0)
})
test('charge alone preserves raw and warm owned node/depth/array boundaries without measuring bytes', () => {
  const raw = { a: [1, 2, 3] }
  const checked = check(raw)
  for (const value of [raw, checked, checked]) {
    expect(() => charge(value, { maxDepth: 2, maxComponents: 3, maxBytes: 1 })).not.toThrow()
    expect(() => charge(value, { maxDepth: 1 })).toThrow('Semantic data budget exceeded')
    expect(() => charge(value, { maxComponents: 2 })).toThrow('Semantic array budget exceeded')
  }
  const records = Object.fromEntries(Array.from({ length: 11 }, (_, i) => [i, 1]))
  for (const value of [records, check(records)]) {
    expect(() => charge(value, { maxInstances: 2, maxComponents: 1 })).not.toThrow()
    expect(() =>
      charge(value, { maxInstances: 1, maxComponents: 1 }, PptxSemanticValidationError)
    ).toThrow(PptxSemanticValidationError)
    expect(() => charge(value, { maxInstances: 1, maxComponents: 1 })).toThrow(
      'Semantic data budget exceeded'
    )
  }
})
test('limits remain valid on warm receipts and errors retain normalizer metadata', () => {
  const value = check({ a: [1] })
  for (const maxBytes of [0, -1, 1.5, Infinity])
    expect(() => measure(value, { maxBytes })).toThrow(/Invalid semantic budget/)
  expect(() => measure(value, { maxBytes: 1 })).toThrow(
    expect.objectContaining({
      name: 'PptxSemanticValidationError',
      code: 'INVALID_PPTX_SEMANTIC_DOCUMENT',
      message: 'Semantic byte budget exceeded',
    })
  )
})

test('checked allocation publishes exact cold metrics with a read-only owned handoff', () => {
  const { checkedCloneBudgetMetrics: metrics } = require('../../shared/src/pptx-semantic-records')
  const leaf = { text: '漢😀\ud800\n', numbers: [-0, 1e21, null] }
  const raw = { first: leaf, second: leaf }
  const checked = clone(raw, limits)
  expect(metrics(checked)).toEqual(measure(raw))
  expect(metrics(checked.first)).toEqual(measure(leaf))
  expect(metrics(checked.first.numbers)).toEqual(measure(leaf.numbers))
  expect(Object.isFrozen(metrics(checked))).toBe(true)
  expect(metrics(raw)).toBeUndefined()
  expect(metrics(new Proxy(checked, {}))).toBeUndefined()
  expect(metrics(Object.freeze({}))).toBeUndefined()
  const reused = clone({ first: checked.first, second: checked.first }, limits)
  expect(reused.first).toBe(reused.second)
  expect(metrics(reused)).toEqual(metrics(checked))
})
test('failed allocation stages no receipts; surviving owned children retain fallback', () => {
  const { checkedCloneBudgetMetrics: metrics } = require('../../shared/src/pptx-semantic-records')
  const original = Object.freeze
  const survivors = []
  Object.freeze = (value) => {
    survivors.push(value)
    return original(value)
  }
  try {
    expect(() => clone({ child: { a: [1] }, invalid: undefined }, limits)).toThrow(/JSON data/)
  } finally {
    Object.freeze = original
  }
  const child = survivors.find((value) => value.a)
  expect(owned(child)).toBe(true)
  expect(metrics(child)).toBeUndefined()
  const root = clone({ child }, limits)
  expect(metrics(root)).toBeUndefined()
  expect(measure(root)).toEqual(measure({ child: { a: [1] } }))
})
test('cold clone receipts still check inherited JSON dispatch on every measure', () => {
  const checked = clone({ a: [1] }, limits)
  for (const proto of [Object.prototype, Array.prototype]) {
    Object.defineProperty(proto, 'toJSON', {
      configurable: true,
      value() {
        throw Error('not invoked')
      },
    })
    try {
      expect(() => measure(checked)).toThrow('Unsafe semantic JSON dispatch')
    } finally {
      delete proto.toJSON
    }
  }
})
