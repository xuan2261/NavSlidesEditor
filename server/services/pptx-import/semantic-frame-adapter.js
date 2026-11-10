const { P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { leafTransform } = require('../../../shared/src/pptx-affine')
const { frameSource } = require('./semantic-frame-adapter-source')

function readFrameIdentity(s, nonvisual, shape = false, readApplication) {
  const { attrs, children, boolean, fail, source, creationId } = s
  attrs(nonvisual)
  children(nonvisual, [
    [P_URIS, 'cNvPr'],
    [P_URIS, shape ? 'cNvSpPr' : 'cNvGraphicFramePr'],
    [P_URIS, 'nvPr'],
  ])
  const [identity, properties, application] = nonvisual.children
  const result = { identity: attrs(identity, ['id', 'name', 'descr', 'title', 'hidden']) }
  if (result.identity.id !== source.nativeId) fail(identity, 'wrong native owner')
  if (Object.hasOwn(result.identity, 'hidden'))
    result.identity.hidden = boolean(identity, result.identity.hidden)
  children(identity, creationId ? [[A_URIS, 'extLst']] : [])
  const declarations = attrs(properties, shape ? ['txBox'] : [])
  if (Object.hasOwn(declarations, 'txBox')) result.textBox = boolean(properties, declarations.txBox)
  children(
    properties,
    properties.children.length ? [[A_URIS, shape ? 'spLocks' : 'graphicFrameLocks']] : []
  )
  if (properties.children.length) {
    const locks = properties.children[0]
    const values = attrs(locks, [
      'noGrp',
      'noDrilldown',
      'noSelect',
      'noChangeAspect',
      'noMove',
      'noResize',
      ...(shape
        ? [
            'noRot',
            'noEditPoints',
            'noAdjustHandles',
            'noChangeArrowheads',
            'noChangeShapeType',
            'noTextEdit',
          ]
        : []),
    ])
    children(locks)
    result.locks = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, boolean(locks, v)])
    )
  }
  attrs(application)
  if (readApplication) {
    const placeholder = readApplication(application)
    if (placeholder) result.placeholder = placeholder
  } else children(application)
  return result
}

function readFrameTransform(s, xfrm) {
  const { attrs, children, integer, boolean } = s
  const values = attrs(xfrm, ['rot', 'flipH', 'flipV'])
  children(xfrm, [
    [A_URIS, 'off'],
    [A_URIS, 'ext'],
  ])
  const [off, ext] = xfrm.children
  const position = attrs(off, ['x', 'y']),
    extent = attrs(ext, ['cx', 'cy'])
  children(off)
  children(ext)
  const limit = 27273042316900
  const sourceTransform = {
    off: { x: integer(off, position.x, -limit, limit), y: integer(off, position.y, -limit, limit) },
    ext: { cx: integer(ext, extent.cx, 0, limit), cy: integer(ext, extent.cy, 0, limit) },
  }
  if (Object.hasOwn(values, 'rot'))
    sourceTransform.rotation = integer(xfrm, values.rot, -2147483648, 2147483647)
  for (const flag of ['flipH', 'flipV'])
    if (Object.hasOwn(values, flag)) sourceTransform[flag] = boolean(xfrm, values[flag])
  return {
    extent: sourceTransform.ext,
    sourceTransform,
    localTransform: leafTransform(sourceTransform),
  }
}

function readGraphicFrame(context) {
  const s = frameSource(context)
  const { source, node, attrs, children, fail } = s
  if (source.kind !== 'graphic-frame' || !P_URIS.has(node.uri) || node.local !== 'graphicFrame')
    fail(node, 'wrong graphic frame owner')
  attrs(node)
  children(node, [
    [P_URIS, 'nvGraphicFramePr'],
    [P_URIS, 'xfrm'],
    [A_URIS, 'graphic'],
  ])
  const [nonvisual, xfrm, graphic] = node.children
  const frameProperties = readFrameIdentity(s, nonvisual)
  const placement = readFrameTransform(s, xfrm)
  attrs(graphic)
  children(graphic, [[A_URIS, 'graphicData']])
  return { ...s, ...placement, frameProperties, payload: graphic.children[0] }
}

function finishFrame(s, mappedDefinitionIds) {
  const ids = new Set(mappedDefinitionIds)
  for (const c of s.metadata) {
    if (ids.has(c.id)) s.fail(s.node, 'duplicate metadata disposition')
    ids.add(c.id)
  }
  for (const c of s.components)
    if (!ids.has(c.id)) s.fail(s.nodes.get(c.id), 'unmapped required owner component')
  if (ids.has(s.source.id)) s.fail(s.node, 'duplicate owner disposition')
  return [s.source.id, ...ids]
}
module.exports = { readGraphicFrame, readFrameIdentity, readFrameTransform, finishFrame }
