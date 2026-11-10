const { decodeXml } = require('./pptx-xml-entities')
const P = new Set(['http://schemas.openxmlformats.org/presentationml/2006/main',
  'http://purl.oclc.org/ooxml/presentationml/main'])
const fail = detail => { throw new TypeError(`Invalid PPTX timing: ${detail}`) }
const sameLocator = (a, b) => a?.preconditionHash === b?.preconditionHash &&
  JSON.stringify(a?.path) === JSON.stringify(b?.path)
function record(value, fields, required = fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !fields.includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) fail('record fields')
}
function validateTimingDefinition(definition) {
  const source = definition.content.timingDocument
  if (source === undefined) return
  record(source, ['schemaVersion', 'xml', 'tree', 'targetReferences'])
  if (source.schemaVersion !== 1 || definition.kind !== 'opaque' || definition.origin === 'project' ||
      typeof source.xml !== 'string' || !source.xml.length || !Array.isArray(source.targetReferences)) fail('source record')
  const paths = new Set(), targets = new Map()
  function visit(node, path) {
    record(node, ['namespace', 'name', 'attributes', 'locator', 'text', 'children'])
    record(node.locator, ['path', 'preconditionHash'])
    if (!(node.namespace === null || typeof node.namespace === 'string') ||
        typeof node.name !== 'string' || !node.name.length || typeof node.text !== 'string' ||
        !Array.isArray(node.attributes) || !Array.isArray(node.children) ||
        !sameLocator(node.locator, { path, preconditionHash: definition.source.preconditionHash }) ||
        !path.length || path.some(value => !Number.isSafeInteger(value) || value < 0)) fail('source tree locator')
    const key = JSON.stringify(path)
    if (paths.has(key)) fail('duplicate source node')
    paths.add(key)
    const attrs = new Set()
    for (const entry of node.attributes) {
      record(entry, ['name', 'value'])
      if (typeof entry.name !== 'string' || typeof entry.value !== 'string' || attrs.has(entry.name)) fail('source attribute')
      attrs.add(entry.name)
    }
    if (P.has(node.namespace) && node.name === 'spTgt') {
      const spid = attributes(node).spid
      if (typeof spid !== 'string' || !decodeXml(spid)) fail('source target reference')
      targets.set(key, decodeXml(spid))
    }
    node.children.forEach((child, index) => visit(child, [...path, index]))
  }
  const path = definition.source.componentLocator?.path
  if (!Array.isArray(path)) fail('missing source tree root')
  visit(source.tree, path)
  if (!P.has(source.tree.namespace) || source.tree.name !== 'timing') fail('source timing root')
  for (const target of source.targetReferences) {
    record(target, ['spid', 'locator'])
    record(target.locator, ['path', 'preconditionHash'])
    const key = JSON.stringify(target.locator.path)
    if (typeof target.spid !== 'string' || !target.spid.length || target.spid.length > 1024 ||
        target.locator.preconditionHash !== definition.source.preconditionHash ||
        targets.get(key) !== target.spid || !targets.delete(key)) fail('source target reference')
  }
  if (targets.size) fail('missing source target reference')
}
const attributes = node => Object.fromEntries(node.attributes.filter(entry => !/^xmlns(?::|$)/.test(entry.name))
  .map(entry => [entry.name, entry.value]))
const children = (node, name) => node.children.filter(child => P.has(child.namespace) && child.name === name)
const one = (node, name) => { const found = children(node, name); return found.length === 1 ? found[0] : null }
const descendants = node => [node, ...node.children.flatMap(descendants)]
const TRIGGERS = Object.freeze(['onClick', 'withPrevious', 'afterPrevious'])
module.exports = { P, fail, record, sameLocator, validateTimingDefinition, attributes, children, one, descendants, TRIGGERS }
