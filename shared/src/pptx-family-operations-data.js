// Persisted family journals share the semantic envelope's depth/byte budget,
// rather than the shallower rich-text-only cloning budget.
function cloneFamilyData(input) {
  const ancestors = new Set()
  let nodes = 0, bytes = 0
  function clone(value, depth) {
    if (++nodes > 1100000 || depth > 256) throw new TypeError('Family JSON budget')
    if (value === null || typeof value === 'boolean') return value
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      bytes += value.length * 2
      if (bytes > 8388608) throw new TypeError('Family JSON byte budget')
      return value
    }
    const list = Array.isArray(value)
    if (!value || typeof value !== 'object' || ancestors.has(value) ||
        Object.getPrototypeOf(value) !== (list ? Array.prototype : Object.prototype))
      throw new TypeError('Family JSON data required')
    const keys = Reflect.ownKeys(value).filter((key) => !(list && key === 'length'))
    if (keys.length > 100000 || (list && keys.length !== value.length))
      throw new TypeError('Family JSON keys')
    const result = list ? [] : {}
    ancestors.add(value)
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) ||
          !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
          (list && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)))
        throw new TypeError('Family JSON descriptor')
      bytes += key.length * 2 + 16
      if (bytes > 8388608) throw new TypeError('Family JSON byte budget')
      result[key] = clone(descriptor.value, depth + 1)
    }
    ancestors.delete(value)
    return result
  }
  return clone(input, 0)
}
module.exports = { cloneFamilyData }
