const { INVALID, cloneFrozen, isPlainRecord, ownData } = require('./own-plain-data')

// Semantic dictionaries already use atomic record replacement in semantic-records.
// Keep catalog arrays atomic too: index-level edits would make inverse/replay ordering unsafe.
const DICTIONARIES = new Set(['definitions', 'instances', 'styles', 'fonts'])
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
function invalid() { throw new TypeError('Invalid generic journal: unsafe semantic property path') }
function assertSegment(segment) {
  if (typeof segment !== 'string' || !segment || segment.length > 1024 || UNSAFE_KEYS.has(segment)) invalid()
  return segment
}
function semanticPropertyDeltas(before, after, emit) {
  for (const field of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const left = Object.hasOwn(before, field) ? before[field] : undefined
    const right = Object.hasOwn(after, field) ? after[field] : undefined
    assertSegment(field)
    if (DICTIONARIES.has(field) && isPlainRecord(left) && isPlainRecord(right)) {
      for (const id of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
        assertSegment(id)
        emit([field, id], Object.hasOwn(left, id) ? left[id] : undefined, Object.hasOwn(right, id) ? right[id] : undefined)
      }
    } else emit([field], left, right)
  }
}
function propertyPath(operation) {
  const descriptor = Object.getOwnPropertyDescriptor(operation, 'path')
  if (!descriptor) {
    if ('path' in operation) invalid()
    return []
  }
  if (!isPlainRecord(operation) || !('value' in descriptor)) invalid()
  for (const key of Reflect.ownKeys(operation)) {
    if (typeof key !== 'string' || ownData(operation, key) === INVALID) invalid()
  }
  if (ownData(operation, 'kind') !== 'property-change' || ownData(operation, 'targetKind') !== 'presentation' ||
      ownData(operation, 'property') !== 'pptxSemantic') invalid()
  const path = descriptor.value
  if (!Array.isArray(path) || path.length < 1 || path.length > 2) invalid()
  const result = []
  for (let index = 0; index < path.length; index += 1) result.push(assertSegment(ownData(path, String(index))))
  if (result.length === 2 && !DICTIONARIES.has(result[0])) invalid()
  for (const field of ['before', 'after']) {
    const value = ownData(operation, field)
    if (value !== INVALID && value !== undefined) cloneFrozen(value)
  }
  const inverse = ownData(operation, 'inverse')
  if (inverse !== INVALID) {
    if (!isPlainRecord(inverse)) invalid()
    const value = ownData(inverse, 'value')
    // JSON transport omits undefined inverse values for record additions.
    if (value === INVALID && Object.hasOwn(inverse, 'value')) invalid()
    if (value !== INVALID && value !== undefined) cloneFrozen(value)
  }
  return result
}
function propertySlot(target, operation) {
  const path = propertyPath(operation)
  if (!path.length) return target ? { target, property: operation.property } : null
  let owner = target && ownData(target, operation.property)
  for (const key of path.slice(0, -1)) {
    if (!isPlainRecord(owner)) return null
    owner = ownData(owner, key)
  }
  return isPlainRecord(owner) ? { target: owner, property: path[path.length - 1] } : null
}
function propertyEnvelope(operation, value) {
  const path = propertyPath(operation)
  let result = value
  for (let index = path.length - 1; index >= 0; index -= 1) result = { [path[index]]: result }
  return result
}
function propertyEnvelopeValue(operation, envelope) {
  let value = envelope
  for (const key of propertyPath(operation)) {
    value = ownData(value, key)
    if (value === INVALID) invalid()
  }
  return value
}
module.exports = { semanticPropertyDeltas, propertyPath, propertySlot, propertyEnvelope, propertyEnvelopeValue }
