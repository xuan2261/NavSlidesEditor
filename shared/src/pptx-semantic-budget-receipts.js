// Identity receipts belong only to descriptor-checked, internally allocated clones.
const { isCheckedImmutableSemanticValue, checkedCloneBudgetMetrics } = require('./pptx-semantic-records.js')
const ownKeys = Reflect.ownKeys
const descriptor = Object.getOwnPropertyDescriptor
const prototype = Object.getPrototypeOf
const isArray = Array.isArray
const objectPrototype = Object.prototype
const arrayPrototype = Array.prototype
const { jsonStringByteLength, primitiveCloneMetrics } = require('./pptx-semantic-clone-metrics.js')
const receipts = new WeakMap()
const forbidden = new Set([
  '__proto__', 'constructor', 'prototype', 'sourceAuthority', 'sourceRef', 'sourceMap',
  'packagePath', 'originalPath', 'packageRevisionId', 'aggregateGeneration',
  'fencingEpoch', 'adapterQualified', 'transactionEligible', 'level4Promoted',
  'controlCapabilityHash', 'capabilityHash',
])
const defaults = { maxInstances: 100000, maxComponents: 100000, maxDepth: 256, maxBytes: 8 * 1024 * 1024 }
function defaultFail(message) {
  const error = new Error(message)
  error.name = 'PptxSemanticValidationError'
  error.code = 'INVALID_PPTX_SEMANTIC_DOCUMENT'
  throw error
}
function safeDispatch(fail) {
  // Checked clones use ordinary records/arrays, even for null-prototype input.
  if (prototype(objectPrototype) !== null || prototype(arrayPrototype) !== objectPrototype)
    fail('Unsafe semantic JSON dispatch')
  for (const p of [objectPrototype, arrayPrototype]) {
    const d = descriptor(p, 'toJSON')
    if (d && (!('value' in d) || typeof d.value === 'function'))
      fail('Unsafe semantic JSON dispatch')
  }
}
// Charge only node/depth/array/cycle limits in historical traversal order.
// Raw descriptors/JSON values are checked by the subsequent clone, not here;
// only owned subtrees with measured receipts can bypass this traversal.
/**
 * measureSemanticBudget(value, limits?, ErrorConstructor?) -> frozen
 * { nodeCount, maxRelativeDepth, maxArrayLength, jsonBytes }.
 * Depth starts at zero; shared references count per occurrence. jsonBytes is
 * JSON.stringify's UTF-8 size for the checked clone, without a root string.
 * Inject the normalizer's ErrorConstructor to preserve instanceof identity.
 * Default errors retain compatible name/code/messages. This is NOT schema,
 * inventory, or relationship validation, nor document certification.
 */
function chargeSemanticBudget(value, options = {}, ErrorConstructor) {
  const fail = ErrorConstructor ? message => { throw new ErrorConstructor(message) } : defaultFail
  const limits = { ...defaults, ...options }
  for (const n of Object.values(limits))
    if (!Number.isSafeInteger(n) || n < 1) fail('Invalid semantic budget')
  safeDispatch(fail)
  const maxNodes = limits.maxInstances + limits.maxComponents * 10
  let nodes = 0
  const ancestors = new Set()
  // Preserve raw charge error order. Descend when a receipt fails a bound.
  function charge(v, depth) {
    const object = v !== null && typeof v === 'object'
    const r = object && isCheckedImmutableSemanticValue(v) && (checkedCloneBudgetMetrics(v) || receipts.get(v))
    if (r && depth + r.maxRelativeDepth <= limits.maxDepth &&
        nodes + r.nodeCount <= maxNodes && r.maxArrayLength <= limits.maxComponents) {
      nodes += r.nodeCount
      return
    }
    if (depth > limits.maxDepth || ++nodes > maxNodes) fail('Semantic data budget exceeded')
    if (!object) return
    if (ancestors.has(v)) fail('Semantic content cycle')
    if (isArray(v) && v.length > limits.maxComponents) fail('Semantic array budget exceeded')
    ancestors.add(v)
    for (const key of ownKeys(v)) {
      if (isArray(v) && key === 'length') continue
      const d = descriptor(v, key)
      if (d && 'value' in d) charge(d.value, depth + 1)
    }
    ancestors.delete(v)
  }
  charge(value, 0)
}

function measureSemanticBudget(value, options = {}, ErrorConstructor) {
  chargeSemanticBudget(value, options, ErrorConstructor)
  const fail = ErrorConstructor ? message => { throw new ErrorConstructor(message) } : defaultFail
  const limits = { ...defaults, ...options }
  function measure(v) {
    if (v === null || ['string', 'boolean', 'number'].includes(typeof v)) {
      if (typeof v === 'number' && !Number.isFinite(v))
        fail('Invalid numeric value in semantic data/transform')
      return { ...primitiveCloneMetrics(v), immutable: true }
    }
    if (!v || typeof v !== 'object') fail('Semantic content must be JSON data')
    const cached = isCheckedImmutableSemanticValue(v) && (checkedCloneBudgetMetrics(v) || receipts.get(v))
    if (cached) return { ...cached, immutable: true }
    const array = isArray(v)
    const proto = prototype(v)
    if (!array && proto !== objectPrototype && proto !== null)
      fail('Semantic content must be a plain data record')
    const keys = ownKeys(v).filter(key => !array || key !== 'length')
    if (array && keys.length !== v.length) fail('Invalid sparse semantic array')
    const immutable = isCheckedImmutableSemanticValue(v)
    const r = { nodeCount: 1, maxRelativeDepth: 0, maxArrayLength: array ? v.length : 0,
      jsonBytes: 2 + Math.max(0, keys.length - 1) }
    for (const key of keys) {
      if (typeof key !== 'string' || forbidden.has(key)) fail('Forbidden semantic authority key')
      const d = descriptor(v, key)
      if (!d || !('value' in d) || !d.enumerable)
        fail('Semantic content must use enumerable data property')
      if (array && !/^(?:0|[1-9]\d*)$/.test(key)) fail('Invalid semantic array key')
      if (array && (+key >= v.length || String(+key) !== key)) fail('Invalid sparse semantic array')
      const child = measure(d.value)
      r.nodeCount += child.nodeCount
      r.maxRelativeDepth = Math.max(r.maxRelativeDepth, 1 + child.maxRelativeDepth)
      r.maxArrayLength = Math.max(r.maxArrayLength, child.maxArrayLength)
      r.jsonBytes += child.jsonBytes + (array ? 0 : jsonStringByteLength(key) + 1)
    }
    Object.freeze(r)
    if (immutable) receipts.set(v, r)
    return { ...r, immutable }
  }
  const { immutable, ...result } = measure(value)
  if (result.jsonBytes > limits.maxBytes) fail('Semantic byte budget exceeded')
  return Object.freeze(result)
}
module.exports = { chargeSemanticBudget, measureSemanticBudget }
