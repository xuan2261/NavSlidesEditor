const INVALID = Symbol('invalid-own-data')

function isPlainRecord(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  } catch {
    return false
  }
}

function ownData(value, field) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, field)
    return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
      ? descriptor.value
      : INVALID
  } catch {
    return INVALID
  }
}

function ownKeys(value) {
  try {
    return Object.keys(value)
  } catch {
    return null
  }
}

function hasOnlyOwnFields(value, allowed, required = []) {
  if (!isPlainRecord(value)) return false
  const keys = ownKeys(value)
  return keys !== null && keys.every((field) => allowed.includes(field)) &&
    required.every((field) => ownData(value, field) !== INVALID)
}

function cloneFrozen(value) {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (Array.isArray(value)) {
    const result = []
    for (let index = 0; index < value.length; index += 1) {
      const item = ownData(value, String(index))
      if (item === INVALID) throw new TypeError('Invalid array value')
      result.push(cloneFrozen(item))
    }
    return Object.freeze(result)
  }
  if (!isPlainRecord(value)) throw new TypeError('Invalid record value')
  const result = Object.create(null)
  for (const key of ownKeys(value) || []) {
    const item = ownData(value, key)
    if (item === INVALID) throw new TypeError('Invalid record field')
    result[key] = cloneFrozen(item)
  }
  return Object.freeze(result)
}

module.exports = { INVALID, cloneFrozen, hasOnlyOwnFields, isPlainRecord, ownData, ownKeys }
