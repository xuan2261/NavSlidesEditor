const { normalizeOmmlDocument, OMML_LIMITS } = require('./pptx-omml-document')
const { token } = require('./pptx-omml-document-grammar')

function fail(detail) {
  throw new TypeError(`Invalid OMML operation: ${detail}`)
}
// Commands cross the persisted journal boundary. Never invoke a getter/toJSON.
function validateOmmlCommand(input) {
  let count = 0, bytes = 0
  const ancestors = new Set()
  function clone(value, depth = 0) {
    if (++count > OMML_LIMITS.maxNodes * 32 || depth > OMML_LIMITS.maxDepth * 2 + 8)
      fail('command budget')
    if (typeof value === 'string') {
      bytes += value.length * 2
      if (bytes > OMML_LIMITS.maxBytes) fail('command bytes')
      return value
    }
    if (value === null || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) return value
    const list = Array.isArray(value)
    if (!value || typeof value !== 'object' || ancestors.has(value) ||
      Object.getPrototypeOf(value) !== (list ? Array.prototype : Object.prototype)) fail('plain JSON')
    const keys = Reflect.ownKeys(value).filter((key) => !(list && key === 'length'))
    if ((list && keys.length !== value.length) || keys.length > OMML_LIMITS.maxNodes) fail('keys')
    const result = list ? [] : {}
    ancestors.add(value)
    for (const key of keys) {
      const d = Object.getOwnPropertyDescriptor(value, key)
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) ||
        !d.enumerable || !Object.hasOwn(d, 'value') ||
        (list && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) fail('descriptor')
      bytes += key.length * 2 + 16
      if (bytes > OMML_LIMITS.maxBytes) fail('command bytes')
      result[key] = clone(d.value, depth + 1)
    }
    ancestors.delete(value)
    return result
  }
  const command = clone(input)
  const fields = {
    setText: ['type', 'componentId', 'text'], insert: ['type', 'componentId', 'index', 'node'],
    remove: ['type', 'componentId'], replace: ['type', 'componentId', 'node'],
  }[command?.type]
  if (!fields || Object.keys(command).length !== fields.length ||
    fields.some((key) => !Object.hasOwn(command, key)) ||
    typeof command.componentId !== 'string' || !command.componentId.length) fail('command fields')
  if (command.type === 'setText' && typeof command.text !== 'string') fail('text')
  if (command.type === 'insert' && (!Number.isSafeInteger(command.index) || command.index < 0))
    fail('child index')
  return command
}
function applyOmmlOperation(input, value) {
  const source = normalizeOmmlDocument(input)
  const command = validateOmmlCommand(value)
  // Work only on a detached, already descriptor-safe tree.
  const document = JSON.parse(JSON.stringify(source)), identities = new Map()
  let target, parent
  function visit(node, owner) {
    identities.set(node.componentId, node)
    if (node.componentId === command.componentId) { target = node; parent = owner }
    node.children.forEach((child) => visit(child, node))
  }
  visit(document.root)
  if (!target) fail('unknown component')
  if (command.type === 'setText') {
    if (token(target) !== 'm:t') fail('text target')
    target.text = command.text
  } else if (command.type === 'remove') {
    if (!parent) fail('cannot remove equation root')
    parent.children.splice(parent.children.indexOf(target), 1)
  } else {
    const subtree = command.node
    if (!subtree || typeof subtree !== 'object') fail('subtree')
    if (command.type === 'replace' && subtree.componentId !== target.componentId)
      fail('replacement identity')
    const retained = new Set()
    function collect(node) {
      retained.add(node.componentId)
      node.children.forEach(collect)
    }
    if (command.type === 'replace') collect(target)
    function check(node) {
      if (!node || typeof node !== 'object' || !Array.isArray(node.children)) fail('subtree node')
      const existing = identities.get(node.componentId)
      if (existing) {
        if (!retained.has(node.componentId) || existing.type !== node.type ||
          existing.namespaceUri !== node.namespaceUri) fail('component identity reuse')
      } else if (typeof node.componentId !== 'string' ||
        !node.componentId.startsWith(`${source.root.componentId}~authored:`) ||
        node.componentId.length <= source.root.componentId.length + 10) fail('authored identity')
      node.children.forEach(check)
    }
    check(subtree)
    if (command.type === 'insert') {
      if (command.index > target.children.length) fail('child index')
      target.children.splice(command.index, 0, subtree)
    } else if (parent) parent.children[parent.children.indexOf(target)] = subtree
    else document.root = subtree
  }
  return normalizeOmmlDocument(document)
}
function applyOmmlOperations(document, commands) {
  if (!Array.isArray(commands) || commands.length > 32768 ||
    Object.getPrototypeOf(commands) !== Array.prototype ||
    Reflect.ownKeys(commands).length !== commands.length + 1) fail('journal')
  const values = []
  for (let index = 0; index < commands.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(commands, String(index))
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail('journal descriptor')
    values.push(validateOmmlCommand(descriptor.value))
  }
  let result = normalizeOmmlDocument(document)
  for (const command of values) result = applyOmmlOperation(result, command)
  return result
}
module.exports = { applyOmmlOperation, applyOmmlOperations, validateOmmlCommand }
