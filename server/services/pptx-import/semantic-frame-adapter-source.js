const { createHash } = require('node:crypto')
const { parseXml, decodeXml } = require('./ooxml-text-run-xml')
const { PptxImportError } = require('./diagnostics')
const { readNativeCreationIdentity } = require('./ooxml-native-creation-identity')

function frameSource(context) {
  const { source, node, xml, nodes } = context
  const path = source.componentLocators?.[0]?.path
  const paths = new Map()
  function fail(entry, detail) {
    const error = new PptxImportError(`Semantic frame ${detail}: ${source.partUri}`, {
      status: 422,
    })
    error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
    error.sourceLocation = {
      partUri: source.partUri,
      definitionId: source.id,
      path: paths.get(entry) ?? path,
      localName: entry?.local,
    }
    throw error
  }
  if (
    !Array.isArray(path) ||
    !path.length ||
    path.some((n) => !Number.isSafeInteger(n) || n < 0) ||
    source.componentLocators.length !== 1 ||
    source.componentLocators[0].preconditionHash !== source.preconditionHash ||
    nodes.get(source.id) !== node ||
    createHash('sha256').update(xml).digest('hex') !== source.preconditionHash
  )
    fail(node, 'wrong root binding or stale source')
  let actual
  try {
    actual = { children: parseXml(xml) }
    for (const index of path) actual = actual?.children[index]
  } catch {
    fail(node, 'invalid XML')
  }
  if (
    !actual ||
    JSON.stringify(actual) !== JSON.stringify(node) ||
    source.namespaceUri !== node.uri ||
    source.localName !== node.local
  )
    fail(node, 'wrong root locator or parser tree')
  if (context.inventory) {
    const owners = context.inventory.definitions.filter((d) => d.id === source.id)
    if (owners.length !== 1 || JSON.stringify(owners[0]) !== JSON.stringify(source))
      fail(node, 'wrong inventory owner')
  }
  function walk(entry, current) {
    paths.set(entry, current)
    entry.children.forEach((child, i) => walk(child, [...current, i]))
  }
  walk(node, path)
  function attrs(entry, allowed = []) {
    const result = {}
    for (const a of entry.attrs) {
      if (a.name === 'xmlns' || a.name.startsWith('xmlns:')) continue
      if (!allowed.includes(a.name) || Object.hasOwn(result, a.name))
        fail(entry, `unsupported/duplicate attribute ${a.name}`)
      const value = decodeXml(a.value)
      if (value === null) fail(entry, 'invalid attribute entity')
      result[a.name] = value
    }
    return result
  }
  function children(entry, expected = []) {
    if (
      entry.children.length !== expected.length ||
      entry.children.some(
        (child, i) => !expected[i][0].has(child.uri) || child.local !== expected[i][1]
      )
    )
      fail(entry, 'unsupported child sequence')
    if (entry.selfClosing) return
    let cursor = entry.end + 1
    for (const child of entry.children) {
      if (xml.slice(cursor, child.start).trim()) fail(entry, 'unexpected text')
      cursor = child.closeEnd + 1
    }
    if (xml.slice(cursor, entry.closeStart).trim()) fail(entry, 'unexpected text')
  }
  function integer(entry, value, min, max) {
    if (
      !/^-?\d+$/.test(value ?? '') ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) < min ||
      Number(value) > max
    )
      fail(entry, 'invalid integer')
    return Number(value)
  }
  function boolean(entry, value) {
    if (!['0', '1', 'false', 'true'].includes(value)) fail(entry, 'invalid boolean')
    return value === '1' || value === 'true'
  }
  const creationId = readNativeCreationIdentity(context, (_source, detail) => fail(node, detail))
  if (context.creationId && JSON.stringify(context.creationId) !== JSON.stringify(creationId))
    fail(node, 'wrong creation identity')
  if (creationId) {
    const d = context.components.find((c) => c.id === creationId.componentId)
    const entry = nodes.get(d.id),
      locator = d.componentLocators?.[0]
    if (
      !paths.has(entry) ||
      d.kind !== 'unknown-extension' ||
      d.partUri !== source.partUri ||
      d.preconditionHash !== source.preconditionHash ||
      d.parentDefinitionId !== source.id ||
      d.namespaceUri !== entry.uri ||
      d.localName !== entry.local ||
      d.componentLocators.length !== 1 ||
      locator?.preconditionHash !== source.preconditionHash ||
      JSON.stringify(locator.path) !== JSON.stringify(paths.get(entry))
    )
      fail(entry, 'wrong native creation component binding')
  }
  const metadata = creationId
    ? [
        {
          id: creationId.componentId,
          kind: 'property',
          partUri: source.partUri,
          locator: context.components.find((c) => c.id === creationId.componentId)
            .componentLocators[0],
        },
      ]
    : []
  return { ...context, paths, fail, attrs, children, integer, boolean, creationId, metadata }
}
module.exports = { frameSource }
