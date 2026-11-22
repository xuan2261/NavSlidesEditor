const crypto = require('node:crypto')
const { types } = require('node:util')
const { isCheckedImmutableSemanticValue } = require('revealjs-shared/src/pptx-semantic-records.js')

// Weak keys do not retain snapshots. Bound retained text and digest receipts.
const MAX_CACHED_CHARS = 4 * 1024 * 1024
const MAX_ENTRY_CHARS = 256 * 1024
const MAX_DIGEST_ENTRIES = 4096
let strings = new WeakMap()
let cachedChars = 0
let immutable = new WeakSet()
const publicationData = new WeakSet()
let digests = new WeakMap()
let digestEntries = 0
const getDescriptor = Object.getOwnPropertyDescriptor
const getPrototype = Object.getPrototypeOf
// Explicit serialization dispatch receipt, including temporary key/map arrays'
// species dispatch. Inspect descriptors, never invoke a replacement accessor.
const dependencies = [
  ...['map', 'join', 'filter', 'sort', 'constructor'].map((key) => [Array.prototype, key]),
  [Array, Symbol.species], [JSON, 'stringify'], [Object, 'keys'], [Array, 'isArray'],
].map(([owner, key]) => [owner, key, getDescriptor(owner, key)])
const arrayParent = getPrototype(Array.prototype)

function guardDispatch() {
  let safe = getPrototype(Array.prototype) === arrayParent
  for (const [owner, key, expected] of dependencies) {
    const actual = getDescriptor(owner, key)
    if (!actual || actual.value !== expected.value || actual.get !== expected.get ||
        actual.set !== expected.set || actual.writable !== expected.writable ||
        actual.enumerable !== expected.enumerable || actual.configurable !== expected.configurable) safe = false
  }
  if (!safe) {
    immutable = new WeakSet()
    strings = new WeakMap()
    digests = new WeakMap()
    cachedChars = digestEntries = 0
  }
  return safe
}

// Canonical-byte proof only, not semantic certification. Each node (including
// failures) is visited at most once per root; only successful proofs persist.
function prove(value, proofs = new Map(), publication = false, register = true) {
  if (!value || typeof value !== 'object') {
    if (publication) return value === null || typeof value === 'string' ||
      typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
    return typeof value !== 'function' && typeof value !== 'symbol' && typeof value !== 'bigint'
  }
  // Checked clones own dense, enumerable JSON data, recursively frozen by the
  // private allocator. This is only a byte/publication proof, never admission or
  // successful semantic validation. Raw freeze/certification cannot grant it.
  if (isCheckedImmutableSemanticValue(value)) {
    if (register) {
      immutable.add(value)
      publicationData.add(value)
    }
    return true
  }
  if (publication ? publicationData.has(value) : immutable.has(value)) {
    if (register) immutable.add(value)
    return true
  }
  if (proofs.has(value)) return proofs.get(value)
  proofs.set(value, false)
  if (types.isProxy(value) || (!publication && !Object.isFrozen(value))) return false
  const prototype = getPrototype(value)
  const array = Array.isArray(value)
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (array) {
    // No holes/inherited indices, custom map, constructor/species, or extras.
    if (Reflect.ownKeys(descriptors).length !== value.length + 1) return false
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(descriptors, index)) return false
    }
  }
  let valid = true
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key]
    // Chỉ dữ liệu JSON liệt kê được mới có quyền sở hữu publication.
    if ((publication && (typeof key === 'symbol' || (!descriptor.enumerable &&
        !(array && key === 'length')))) || !Object.hasOwn(descriptor, 'value') ||
        !prove(descriptor.value, proofs, publication, register)) valid = false
  }
  if (publication) Object.freeze(value)
  proofs.set(value, valid)
  if (valid) {
    if (register) immutable.add(value)
    if (publication) publicationData.add(value)
  }
  return valid
}

// Đăng ký khép kín: luôn kiểm tra và đóng băng, không nhận cờ tin cậy từ caller.
// Receipt canonical chỉ được cấp khi dispatch an toàn; undefined vẫn đi fallback.
function sealCanonicalData(value) {
  return prove(value, new Map(), true, guardDispatch())
}

function retain(value, text) {
  if (text.length > MAX_ENTRY_CHARS) return
  if (cachedChars + text.length > MAX_CACHED_CHARS) {
    strings = new WeakMap()
    cachedChars = 0
  }
  strings.set(value, text)
  cachedChars += text.length
}

// Historical dispatch/order for raw nodes must remain observable. Trusted
// branches are selected only at the callback boundary, never at a raw ancestor.
function serializeHistorical(value) {
  if (Array.isArray(value)) return `[${value.map(serializeHistorical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${serializeHistorical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function serializeRoot(value, safe) {
  const proofs = new Map()
  if (safe && prove(value, proofs)) {
    const text = serialize(value)
    // Large canonical text is deliberately not retained. Hash those exact bytes
    // while they exist, so hashRecord need not traverse the same owned graph.
    // This path executes no caller callbacks; the root's dispatch proof covers
    // both serialization and digest creation. Never compose subtree digests.
    if (value && typeof value === 'object' && text.length > MAX_ENTRY_CHARS &&
        !digests.has(value)) retainDigest(value, crypto.createHash('sha256').update(text).digest('hex'))
    return text
  }
  return raw(value)

  function raw(value) {
    if (value && typeof value === 'object' &&
        (immutable.has(value) || (!proofs.has(value) && !types.isProxy(value) && Object.isFrozen(value)))) {
      // Raw getters/custom maps may have changed dispatch since the last branch.
      // One receipt covers a whole proven subtree: it executes no foreign code.
      if (guardDispatch()) {
        if (prove(value, proofs)) return serialize(value)
      } else {
        proofs.clear()
        return serializeHistorical(value)
      }
    }
    if (Array.isArray(value)) return `[${value.map(raw).join(',')}]`
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
        .map((key) => `${JSON.stringify(key)}:${raw(value[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
  }

}

// No callbacks/temporary map and filter arrays in a proven plain-data branch.
// Keep the historical empty array slot for undefined (not JSON's null).
function serialize(value) {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  const cached = strings.get(value)
  if (cached !== undefined) return cached
  let text
  if (Array.isArray(value)) {
    text = '['
    for (let index = 0; index < value.length; index++) {
      if (index) text += ','
      text += serialize(value[index]) ?? ''
    }
    text += ']'
  } else {
    text = '{'
    const keys = Object.keys(value).sort()
    let separator = ''
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index]
      if (value[key] === undefined) continue
      text += separator + JSON.stringify(key) + ':' + serialize(value[key])
      separator = ','
    }
    text += '}'
  }
  retain(value, text)
  return text
}

// Only privately proven immutable plain data can cross asynchronous writes.
// Chunk boundaries never separate a UTF-16 surrogate pair.
function* emitCanonicalChunks(value) {
  if (!guardDispatch() || !value || typeof value !== 'object' || !immutable.has(value)) {
    throw new TypeError('Canonical streaming requires a proven immutable plain root')
  }
  yield* ownedChunks(value)
}

function* ownedChunks(value) {
  // Frames exist only for open containers, never for tokens or primitive leaves.
  // Proven roots are acyclic; shared aliases are traversed at each occurrence.
  const stack = []
  let node = value
  let visit = true
  let pending = ''
  const size = 32 * 1024
  while (visit || stack.length) {
    let token
    if (visit) {
      visit = false
      if (!node || typeof node !== 'object') {
        token = JSON.stringify(node)
      } else {
        const cached = strings.get(node)
        if (cached !== undefined) {
          token = cached
        } else {
          const array = Array.isArray(node)
          stack.push({ node, keys: array ? null : Object.keys(node).sort(), index: 0, separator: '' })
          token = array ? '[' : '{'
        }
      }
    } else {
      const frame = stack[stack.length - 1]
      if (frame.keys === null) {
        if (frame.index < frame.node.length) {
          token = frame.index ? ',' : ''
          node = frame.node[frame.index++]
          visit = true
        } else {
          stack.pop()
          token = ']'
        }
      } else {
        // Undefined properties do not consume a comma; array undefined values
        // instead leave the historical empty slot between their separators.
        while (frame.index < frame.keys.length &&
            frame.node[frame.keys[frame.index]] === undefined) frame.index++
        if (frame.index < frame.keys.length) {
          const key = frame.keys[frame.index++]
          token = frame.separator + JSON.stringify(key) + ':'
          frame.separator = ','
          node = frame.node[key]
          visit = true
        } else {
          stack.pop()
          token = '}'
        }
      }
    }
    if (token === undefined) continue
    let offset = 0
    while (offset < token.length) {
      let end = Math.min(token.length, offset + size - pending.length)
      const last = token.charCodeAt(end - 1)
      if (end < token.length && last >= 0xd800 && last <= 0xdbff &&
          token.charCodeAt(end) >= 0xdc00 && token.charCodeAt(end) <= 0xdfff) end--
      if (end === offset) {
        yield pending
        pending = ''
        continue
      }
      pending += token.slice(offset, end)
      offset = end
      if (pending.length >= size - 1) { yield pending; pending = '' }
    }
  }
  if (pending) yield pending
}

function hashOwned(value) {
  const hash = crypto.createHash('sha256')
  for (const chunk of ownedChunks(value)) hash.update(chunk)
  return hash.digest('hex')
}

function canonicalJson(value) {
  return serializeRoot(value, guardDispatch())
}

function retainDigest(value, digest) {
  if (digestEntries >= MAX_DIGEST_ENTRIES) {
    digests = new WeakMap()
    digestEntries = 0
  }
  if (!digests.has(value)) digestEntries++
  digests.set(value, digest)
}

function hashRecord(value) {
  const safe = guardDispatch()
  if (safe && value && typeof value === 'object') {
    const cached = digests.get(value)
    if (cached !== undefined) return cached
  }
  const owned = safe && value && typeof value === 'object' && prove(value)
  // Raw dispatch may return arbitrary strings, so keep its single UTF-8 update.
  const digest = owned ? hashOwned(value) :
    crypto.createHash('sha256').update(serializeRoot(value, safe)).digest('hex')
  if (guardDispatch() && safe && value && typeof value === 'object' && immutable.has(value)) {
    retainDigest(value, digest)
  }
  return digest
}

function isSealedCanonicalData(value) { return publicationData.has(value) }

module.exports = { canonicalJson, hashRecord, sealCanonicalData, isSealedCanonicalData, emitCanonicalChunks }
