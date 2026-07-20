const { createPrimitiveAdapters } = require('./primitive-ooxml-adapters')
const { createNativeTextAdapter } = require('./text-ooxml-adapter')
const { isPlainRecord } = require('./own-plain-data')

function entry(createAdapter, method, overrideKey, evidenceTestIds) {
  return Object.freeze({ createAdapter, method, overrideKey, evidenceTestIds: Object.freeze(evidenceTestIds) })
}

const PRIMITIVE_ADAPTER_REGISTRY = Object.freeze(Object.assign(Object.create(null), {
  'native-text-plain-run': entry(createNativeTextAdapter, 'applyTextPatch', 'nativeTextAdapter', [
    'text-ooxml-adapter.test.js::patches legal namespace aliases and binds source before to normalized after',
  ]),
  'native-primitive-transform': entry(createPrimitiveAdapters, 'applyPatch', 'nativePrimitiveAdapter', [
    'primitive-ooxml-adapters.test.js::patches transform precisely and preserves adjacent unknown XML',
  ]),
  'native-primitive-style': entry(createPrimitiveAdapters, 'applyPatch', 'nativePrimitiveAdapter', [
    'primitive-ooxml-adapters.test.js::patches solid fill and stroke without replacing line children',
  ]),
  'native-image-replacement': entry(createPrimitiveAdapters, 'applyPatch', 'nativePrimitiveAdapter', [
    'primitive-ooxml-adapters.test.js::replaces image bytes with exact impact closure',
  ]),
}))

function getPrimitiveAdapterDefinition(adapterId) {
  return typeof adapterId === 'string' && Object.prototype.hasOwnProperty.call(PRIMITIVE_ADAPTER_REGISTRY, adapterId)
    ? PRIMITIVE_ADAPTER_REGISTRY[adapterId]
    : null
}

function resolvePrimitiveAdapter(adapterId, overrides = {}) {
  try {
    const definition = getPrimitiveAdapterDefinition(adapterId)
    if (!definition || !isPlainRecord(overrides)) return null
    const descriptor = Object.getOwnPropertyDescriptor(overrides, definition.overrideKey)
    if (descriptor && !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null
    const adapter = descriptor ? descriptor.value : definition.createAdapter()
    const method = adapter && Object.getOwnPropertyDescriptor(adapter, definition.method)
    if (!method || !Object.prototype.hasOwnProperty.call(method, 'value') || typeof method.value !== 'function') return null
    const applyMethod = method.value
    return Object.freeze({ adapterId, apply: (bytes, operation) => applyMethod.call(adapter, bytes, operation) })
  } catch {
    return null
  }
}

module.exports = { PRIMITIVE_ADAPTER_REGISTRY, getPrimitiveAdapterDefinition, resolvePrimitiveAdapter }
