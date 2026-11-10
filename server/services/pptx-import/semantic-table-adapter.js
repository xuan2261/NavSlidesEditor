const { P_URIS, A_URIS, decodeXml } = require('./ooxml-text-run-xml')
const { PptxImportError } = require('./diagnostics')
const { leafTransform } = require('../../../shared/src/pptx-affine')
const { readSemanticTable } = require('./ooxml-semantic-table')
const { tableSource } = require('./ooxml-semantic-table-source')
const { readTableStyleReference } = require('./ooxml-semantic-table-style')
const P14_URI = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
const P14_URIS = new Set([P14_URI])
const MOD_ID_EXTENSION_URI = '{D42A27DB-BD31-4B8C-83A1-F6EECF244321}'

async function projectTableFrame(context) {
  const { source, node, xml } = context
  const semanticContext = {
    ...context,
    components: context.components.filter((item) => item.id !== context.creationId?.componentId),
  }
  const admission = tableSource(semanticContext)
  const paths = new Map()
  function walk(entry, path) {
    paths.set(entry, path)
    entry.children.forEach((nested, index) => walk(nested, [...path, index]))
  }
  walk(node, source.componentLocators[0].path)
  function fail(entry, detail) {
    const error = new PptxImportError(`Semantic table frame ${detail}: ${source.partUri}`, {
      status: 422,
    })
    error.code = 'PPTX_SEMANTIC_ADMISSION_FAILED'
    error.sourceLocation = {
      partUri: source.partUri,
      definitionId: source.id,
      path: paths.get(entry),
      localName: entry.local,
    }
    throw error
  }
  function attrs(entry, allowed = []) {
    const result = {}
    for (const attribute of entry.attrs) {
      if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue
      if (!allowed.includes(attribute.name) || Object.hasOwn(result, attribute.name))
        fail(entry, `unsupported/duplicate attribute ${attribute.name}`)
      const value = decodeXml(attribute.value)
      if (value === null) fail(entry, 'invalid attribute entity')
      result[attribute.name] = value
    }
    return result
  }
  function children(entry, expected) {
    if (
      entry.children.length !== expected.length ||
      entry.children.some((nested, index) => {
        const [uris, local] = expected[index]
        return !uris.has(nested.uri) || nested.local !== local
      })
    )
      fail(entry, 'unsupported child sequence')
    if (entry.selfClosing) return
    let cursor = entry.end + 1
    for (const nested of entry.children) {
      if (xml.slice(cursor, nested.start).trim()) fail(entry, 'unexpected text')
      cursor = nested.closeEnd + 1
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
  function validateModificationId(entry) {
    attrs(entry)
    children(entry, [[P_URIS, 'extLst']])
    if (entry.children.length !== 1) fail(entry, 'invalid modification extension count')
    const list = entry.children[0]
    attrs(list)
    children(list, [[P_URIS, 'ext']])
    if (list.children.length !== 1) fail(list, 'invalid modification extension payload')
    const extension = list.children[0]
    const declaration = attrs(extension, ['uri'])
    if (declaration.uri !== MOD_ID_EXTENSION_URI) fail(extension, 'unsupported modification extension URI')
    children(extension, [[P14_URIS, 'modId']])
    if (extension.children.length !== 1) fail(extension, 'invalid modification identifier count')
    const identity = extension.children[0]
    const properties = attrs(identity, ['val'])
    children(identity, [])
    integer(identity, properties.val, 0, 4294967295)
    admission.bind(identity, 'unknown-extension', source.id, 'property')
  }
  function boolean(entry, value) {
    if (!['0', '1', 'false', 'true'].includes(value)) fail(entry, 'invalid boolean')
    return value === '1' || value === 'true'
  }
  attrs(node)
  children(node, [
    [P_URIS, 'nvGraphicFramePr'],
    [P_URIS, 'xfrm'],
    [A_URIS, 'graphic'],
  ])
  const [nonvisual, xfrm] = node.children
  attrs(nonvisual)
  children(nonvisual, [
    [P_URIS, 'cNvPr'],
    [P_URIS, 'cNvGraphicFramePr'],
    [P_URIS, 'nvPr'],
  ])
  const [identity, nonvisualProperties, applicationProperties] = nonvisual.children
  const frameProperties = {
    identity: attrs(identity, ['id', 'name', 'descr', 'title', 'hidden']),
  }
  if (frameProperties.identity.id !== source.nativeId) fail(identity, 'wrong native owner')
  if (Object.hasOwn(frameProperties.identity, 'hidden'))
    frameProperties.identity.hidden = boolean(identity, frameProperties.identity.hidden)
  children(identity, context.creationId ? [[A_URIS, 'extLst']] : [])
  attrs(nonvisualProperties)
  children(
    nonvisualProperties,
    nonvisualProperties.children.length ? [[A_URIS, 'graphicFrameLocks']] : []
  )
  if (nonvisualProperties.children.length) {
    const locks = nonvisualProperties.children[0]
    const declarations = attrs(locks, [
      'noGrp',
      'noDrilldown',
      'noSelect',
      'noChangeAspect',
      'noMove',
      'noResize',
    ])
    children(locks, [])
    frameProperties.locks = Object.fromEntries(
      Object.entries(declarations).map(([key, value]) => [key, boolean(locks, value)])
    )
  }
  attrs(applicationProperties)
  if (applicationProperties.children.length) validateModificationId(applicationProperties)
  else children(applicationProperties, [])
  const transformAttributes = attrs(xfrm, ['rot', 'flipH', 'flipV'])
  children(xfrm, [
    [A_URIS, 'off'],
    [A_URIS, 'ext'],
  ])
  const [off, ext] = xfrm.children
  const position = attrs(off, ['x', 'y']),
    extent = attrs(ext, ['cx', 'cy'])
  children(off, [])
  children(ext, [])
  const limit = 27273042316900
  const sourceTransform = {
    off: { x: integer(off, position.x, -limit, limit), y: integer(off, position.y, -limit, limit) },
    ext: { cx: integer(ext, extent.cx, 0, limit), cy: integer(ext, extent.cy, 0, limit) },
  }
  if (Object.hasOwn(transformAttributes, 'rot'))
    sourceTransform.rotation = integer(xfrm, transformAttributes.rot, -2147483648, 2147483647)
  for (const flag of ['flipH', 'flipV'])
    if (Object.hasOwn(transformAttributes, flag))
      sourceTransform[flag] = boolean(xfrm, transformAttributes[flag])
  const table = readSemanticTable(semanticContext, admission)
  const style = await readTableStyleReference(context, table.tableDocument)
  const metadata = context.creationId
    ? [
        {
          id: context.creationId.componentId,
          kind: 'property',
          locator: context.components.find((item) => item.id === context.creationId.componentId)
            .componentLocators[0],
        },
      ]
    : []
  return {
    kind: 'table',
    content: { tableDocument: table.tableDocument, frameProperties, extent: sourceTransform.ext,
      ...(style ? { tableStyleReference: style.reference } : {}) },
    components: [...table.components, ...metadata],
    extent: sourceTransform.ext,
    sourceTransform,
    localTransform: leafTransform(sourceTransform),
    compatibility: {
      type: 'table',
      data: table.tableDocument.rows.map((row) =>
        row.cells.map((cell) =>
          cell.textDocument.paragraphs
            .map((paragraph) =>
              paragraph.runs.map((run) => (run.kind === 'break' ? '\n' : (run.text ?? ''))).join('')
            )
            .join('\n')
        )
      ),
    },
    mappedDefinitionIds: [
      source.id,
      ...table.mappedDefinitionIds,
      ...(style?.mappedDefinitionIds ?? []),
      ...metadata.map((item) => item.id),
    ],
  }
}

module.exports = { projectTableFrame }
