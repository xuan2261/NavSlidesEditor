const { validateOmmlNode, token } = require('./pptx-omml-document-grammar')

const OMML_LIMITS = Object.freeze({ maxNodes: 32768, maxDepth: 64, maxBytes: 8388608 })
function ommlFailure(detail, componentId) {
  const error = new TypeError(`Invalid PPTX OMML contract: ${detail}`)
  error.componentId = componentId
  throw error
}
// Descriptor-safe JSON cloning without invoking getters, coercions or toJSON.
// Math trees need a larger depth budget than the paragraph/run text contract.
function cloneOmmlData(input) {
  const ancestors = new Set()
  let count = 0, bytes = 0
  function clone(value, depth) {
    if (++count > OMML_LIMITS.maxNodes * 32 || depth > OMML_LIMITS.maxDepth * 2 + 8)
      ommlFailure('JSON budget')
    if (typeof value === 'string') {
      bytes += value.length * 2
      if (bytes > OMML_LIMITS.maxBytes) ommlFailure('JSON bytes')
      return value
    }
    if (value === null || typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))) return value
    if (!value || typeof value !== 'object' || ancestors.has(value)) ommlFailure('plain JSON')
    const list = Array.isArray(value)
    if (Object.getPrototypeOf(value) !== (list ? Array.prototype : Object.prototype))
      ommlFailure('JSON prototype')
    const keys = Reflect.ownKeys(value).filter((key) => !(list && key === 'length'))
    if (keys.length > OMML_LIMITS.maxNodes || (list && keys.length !== value.length))
      ommlFailure('JSON keys')
    const result = list ? [] : {}
    ancestors.add(value)
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) ||
          !descriptor.enumerable || !Object.hasOwn(descriptor, 'value') ||
          (list && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)))
        ommlFailure('JSON descriptor')
      bytes += key.length * 2 + 16
      if (bytes > OMML_LIMITS.maxBytes) ommlFailure('JSON bytes')
      result[key] = clone(descriptor.value, depth + 1)
    }
    ancestors.delete(value)
    return result
  }
  return clone(input, 0)
}
function record(value, required, optional = [], componentId) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      required.some((key) => !Object.hasOwn(value, key)) ||
      Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key)))
    ommlFailure('record fields', componentId)
}
function xmlText(value) {
  if (typeof value !== 'string') return false
  for (const character of value) {
    const n = character.codePointAt(0)
    if (!(n === 9 || n === 10 || n === 13 || (n >= 32 && n <= 0xD7FF) ||
      (n >= 0xE000 && n <= 0xFFFD) || (n >= 0x10000 && n <= 0x10FFFF))) return false
  }
  return true
}
function normalizeOmmlDocument(input) {
  const document = cloneOmmlData(input), ids = new Set()
  record(document, ['schemaVersion', 'root'])
  if (document.schemaVersion !== 1) ommlFailure('schema version')
  let count = 0
  function visit(node, depth) {
    const id = node?.componentId, fail = (message) => ommlFailure(message, id)
    if (++count > OMML_LIMITS.maxNodes || depth > OMML_LIMITS.maxDepth) fail('tree budget')
    record(node, ['componentId', 'namespaceUri', 'type', 'attributes', 'children'], ['text'], id)
    if (typeof id !== 'string' || !id.length || id.length > 1024 || ids.has(id)) fail('component identity')
    ids.add(id)
    if (typeof node.namespaceUri !== 'string' || typeof node.type !== 'string' ||
        !Array.isArray(node.children) || !Array.isArray(node.attributes)) fail('node shape')
    for (const attribute of node.attributes) {
      record(attribute, ['namespaceUri', 'name', 'value'], [], id)
      if (typeof attribute.namespaceUri !== 'string' || typeof attribute.name !== 'string' ||
          !xmlText(attribute.value)) fail('attribute shape')
    }
    if (Object.hasOwn(node, 'text') && !xmlText(node.text)) fail('XML text')
    // Children first: matrix declarations and rows are safe to inspect afterwards.
    node.children.forEach((child) => visit(child, depth + 1))
    validateOmmlNode(node, fail)
  }
  visit(document.root, 0)
  if (!['m:oMath', 'm:oMathPara'].includes(token(document.root)))
    ommlFailure('equation root', document.root.componentId)
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze)
      Object.freeze(value)
    }
    return value
  }
  return freeze(document)
}
module.exports = { normalizeOmmlDocument, OMML_LIMITS, cloneOmmlData }
