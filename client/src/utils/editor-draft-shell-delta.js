// Strict JSON only: inspect descriptors rather than invoking application getters.
// No input identity cache: mutable inputs are compared on every capture.
const blocked = key => key === '__proto__' || key === 'constructor' || key === 'prototype'
const own = (value, key) => Object.hasOwn(value, key)
function fields(value) {
  if (!value || typeof value !== 'object') return null
  const array = Array.isArray(value)
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype) &&
      Object.getPrototypeOf(value) !== null) throw Error('Non-JSON prototype')
  const keys = Reflect.ownKeys(value)
  const descriptors = []
  // Collect every descriptor before inspecting values, including on proxies.
  // A trap may remove a later key, just as with getOwnPropertyDescriptors.
  for (let i = 0; i < keys.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, keys[i])
    if (descriptor) descriptors.push(descriptor)
    else { keys.splice(i, 1); i-- }
  }
  // The former descriptor map canonicalized integer keys even for proxies.
  // Restore that order in place without allocating a map or another key list.
  for (let i = 1; i < keys.length; i++) {
    if (!integerKey(keys[i])) continue
    let j = i
    while (j > 0 && (!integerKey(keys[j - 1]) || Number(keys[j - 1]) > Number(keys[j]))) {
      const key = keys[j], descriptor = descriptors[j]
      keys[j] = keys[j - 1]
      descriptors[j] = descriptors[j - 1]
      keys[j - 1] = key
      descriptors[j - 1] = descriptor
      j--
    }
  }
  const lengthIndex = array ? keys.indexOf('length') : -1
  const length = lengthIndex < 0 ? undefined : descriptors[lengthIndex].value
  if (lengthIndex >= 0) { keys.splice(lengthIndex, 1); descriptors.splice(lengthIndex, 1) }
  if (array && keys.length !== length) throw Error('Sparse array')
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i], d = descriptors[i]
    if (typeof key !== 'string' || blocked(key) || !d.enumerable || !own(d, 'value') ||
        (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)))
      throw Error('Unsafe JSON field')
  }
  return { array, keys, descriptors, length }
}
function integerKey(key) {
  return typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < 4294967295
}
function replayOrderMatches(keys, baseKeys) {
  // Integer keys are always canonical. Retained string keys precede appends.
  let next = 0
  function matches(key) {
    while (next < keys.length && integerKey(keys[next])) next++
    return keys[next++] === key
  }
  for (const key of baseKeys) {
    if (!integerKey(key) && keys.includes(key) && !matches(key)) return false
  }
  for (const key of keys) {
    if (!integerKey(key) && !baseKeys.includes(key) && !matches(key)) return false
  }
  return true
}
// Only allocations made here can acquire this transitive ownership proof.
const frozenOwned = new WeakSet()
export const isOwnedShell = value => !!value && typeof value === 'object' && frozenOwned.has(value)
function visit(value, base, path, sets, deletes, ancestors, internal) {
  if (value === null || typeof value !== 'object') {
    if (value !== null && !['string', 'boolean', 'number'].includes(typeof value)) throw Error('Non-JSON value')
    if (typeof value === 'number' && !Number.isFinite(value)) throw Error('Non-JSON number')
    value = value === 0 ? 0 : value
    if (value !== base) sets.push([path, value])
    return value
  }
  if (ancestors.has(value)) throw Error('Cyclic JSON')
  ancestors.add(value)
  const info = fields(value)
  const baseKeys = base && typeof base === 'object' ? Object.keys(base) : []
  // Deletions and appends preserve insertion order, but cannot reorder retained
  // keys. Compare the effective (including integer-key canonical) replay order.
  const compatible = base && typeof base === 'object' && Array.isArray(base) === info.array &&
    (!info.array || base.length === info.length) &&
    (info.array || replayOrderMatches(info.keys, baseKeys))
  const share = internal && isOwnedShell(base) && Array.isArray(base) === info.array
  const sameKeys = share && baseKeys.length === info.keys.length &&
    baseKeys.every((key, i) => key === info.keys[i])
  let copy = sameKeys ? null : (info.array ? [] : {})
  const childSets = compatible ? sets : []
  const childDeletes = compatible ? deletes : []
  for (let i = 0; i < info.keys.length; i++) {
    const key = info.keys[i]
    // Even replacements compare every descriptor value; never reread raw input.
    const before = (compatible || share) && own(base, key) ? base[key] : undefined
    const next = visit(info.descriptors[i].value, before,
      [...path, key], childSets, childDeletes, ancestors, internal)
    if (!copy && next !== before) {
      copy = info.array ? [] : {}
      for (let j = 0; j < i; j++) {
        const previous = info.keys[j]
        Object.defineProperty(copy, previous, { value: base[previous], enumerable: true,
          configurable: true, writable: true })
      }
    }
    if (copy) Object.defineProperty(copy, key, { value: next, enumerable: true, configurable: true, writable: true })
  }
  if (compatible) for (const key of baseKeys) {
    if (!info.keys.includes(key)) deletes.push([...path, key])
  }
  const result = copy || base
  if (internal && copy) {
    Object.freeze(copy)
    frozenOwned.add(copy)
  }
  if (!compatible) sets.push([path, result])
  ancestors.delete(value)
  return result
}
function capture(value, base, internal) {
  const sets = [], deletes = []
  const copy = visit(value, base, [], sets, deletes, new Set(), internal)
  return { copy, patch: { sets, deletes } }
}
export function captureShell(value, base) {
  return capture(value, base, false)
}
// Internal callers may share only checked, deeply frozen owned allocations.
export function captureOwnedShell(value, base) {
  return capture(value, base, true)
}
function shellPath(path) {
  if (!Array.isArray(path) || Object.getPrototypeOf(path) !== Array.prototype)
    throw Error('Invalid shell path')
  const info = fields(path)
  return info.descriptors.map(({ value: key }) => {
    if ((typeof key !== 'string' && (typeof key !== 'number' || !Number.isFinite(key))) || blocked(String(key)))
      throw Error('Invalid shell path')
    return String(key)
  })
}
export function replayShell(base, patch) {
  const result = captureShell(base).copy
  if (!patch || !Array.isArray(patch.sets) || !Array.isArray(patch.deletes)) throw Error('Invalid shell patch')
  // A root replacement must be the entire patch, never mixed with child edits.
  if (patch.sets.some(entry => Array.isArray(entry) && !shellPath(entry[0]).length)) {
    if (patch.sets.length !== 1 || patch.deletes.length || patch.sets[0].length !== 2)
      throw Error('Invalid root replacement')
    return captureShell(patch.sets[0][1]).copy
  }
  const paths = new Set()
  function target(path) {
    path = shellPath(path)
    if (!path.length) throw Error('Invalid shell path')
    const encoded = JSON.stringify(path)
    if (paths.has(encoded)) throw Error('Duplicate shell path')
    paths.add(encoded)
    let parent = result
    for (const key of path.slice(0, -1)) {
      if (!parent || typeof parent !== 'object' || !own(parent, key)) throw Error('Missing shell path')
      parent = parent[key]
    }
    const key = path.at(-1)
    if (!parent || typeof parent !== 'object' || (Array.isArray(parent) &&
        (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= parent.length))) throw Error('Invalid shell target')
    return [parent, key]
  }
  for (const path of patch.deletes) {
    const [parent, key] = target(path)
    if (Array.isArray(parent) || !own(parent, key)) throw Error('Invalid deletion')
    delete parent[key]
  }
  for (const entry of patch.sets) {
    if (!Array.isArray(entry) || entry.length !== 2) throw Error('Invalid shell set')
    const [parent, key] = target(entry[0])
    Object.defineProperty(parent, key, { value: captureShell(entry[1]).copy,
      enumerable: true, configurable: true, writable: true })
  }
  return result
}
