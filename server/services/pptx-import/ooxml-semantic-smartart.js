const { P_URIS, decodeXml } = require('./ooxml-text-run-xml')
const { relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const { smartArtSource } = require('./ooxml-semantic-smartart-source')
const { readTableText } = require('./ooxml-semantic-table-text')
const { readSmartArtLayout } = require('./ooxml-semantic-smartart-layout')
const { readSmartArtStyles } = require('./ooxml-semantic-smartart-style')
const { readSmartArtDrawing } = require('./ooxml-semantic-smartart-drawing')
const { readSourceStyleTree } = require('./ooxml-semantic-source-style-tree')
const {
  normalizeSmartArtDocument,
  SMARTART_PROPERTY_TYPES,
  SMARTART_ROLES,
  modelKey,
} = require('../../../shared/src/pptx-smartart-document')
const D_URIS = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/diagram',
  'http://purl.oclc.org/ooxml/drawingml/diagram',
])
const R_URIS = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const REL_URIS = new Set(['http://schemas.openxmlformats.org/package/2006/relationships'])

// Async functional reader. It returns source components, not a projector
// admission, layout evaluation, paint output or editor capability declaration.
async function readSemanticSmartArt(context) {
  const source = smartArtSource(context),
    owner = context.source
  const framePart = await source.load(owner.partUri)
  const frame = framePart.nodes.get(owner.id)
  if (
    !frame ||
    owner.kind !== 'graphic-frame' ||
    !P_URIS.has(frame.uri) ||
    frame.local !== 'graphicFrame'
  )
    framePart.fail(frame, 'wrong SmartArt owner')
  if (
    owner.preconditionHash !== framePart.hash ||
    owner.componentLocators?.[0]?.preconditionHash !== framePart.hash
  )
    framePart.fail(frame, 'stale frame source')
  const nv = framePart.required(frame, 'nvGraphicFramePr', P_URIS)
  const id = framePart.required(nv, 'cNvPr', P_URIS)
  const nativeId = id.attrs.filter((a) => a.name === 'id')
  if (nativeId.length !== 1 || decodeXml(nativeId[0].value) !== owner.nativeId)
    framePart.fail(id, 'wrong native identity')
  const graphic = framePart.required(frame, 'graphic')
  framePart.attrs(graphic)
  framePart.children(graphic, ['graphicData'])
  const payload = framePart.required(graphic, 'graphicData')
  if (!D_URIS.has(framePart.attrs(payload, ['uri']).uri))
    framePart.fail(payload, 'wrong graphicData URI')
  framePart.children(payload, ['relIds'], [], D_URIS)
  const refs = framePart.required(payload, 'relIds', D_URIS),
    referenceIds = {}
  framePart.children(refs)
  for (const attribute of refs.attrs) {
    if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue
    const [prefix, local, extra] = attribute.name.split(':')
    if (
      extra ||
      !R_URIS.has(refs.namespaces[prefix]) ||
      !['dm', 'lo', 'qs', 'cs'].includes(local) ||
      Object.hasOwn(referenceIds, local)
    )
      framePart.fail(refs, 'invalid relationship reference')
    referenceIds[local] = decodeXml(attribute.value)
  }
  const relPart = await source.load(relationshipPart(owner.partUri))
  const relRoot = relPart.roots[0]
  if (relRoot.local !== 'Relationships' || !REL_URIS.has(relRoot.uri))
    relPart.fail(relRoot, 'relationship namespace')
  relPart.attrs(relRoot)
  relPart.children(relRoot, ['Relationship'], ['Relationship'], REL_URIS)
  const relations = new Map()
  for (const node of relRoot.children) {
    const a = relPart.attrs(node, ['Id', 'Type', 'Target', 'TargetMode'])
    relPart.children(node)
    if (!a.Id || !a.Type || !a.Target || relations.has(a.Id))
      relPart.fail(node, 'ambiguous relationship')
    relations.set(a.Id, { ...a, node })
  }
  const relationships = [],
    bound = {}
  for (const [role, key] of [
    ['data', 'dm'],
    ['layout', 'lo'],
    ['style', 'qs'],
    ['colors', 'cs'],
  ]) {
    const r = relations.get(referenceIds[key])
    if (
      !r ||
      ![...R_URIS].some((ns) => r.Type === `${ns}/${SMARTART_ROLES[role]}`) ||
      (r.TargetMode !== undefined && r.TargetMode !== 'Internal')
    )
      framePart.fail(refs, `wrong/missing ${role} relationship`)
    let partUri
    try {
      partUri = resolveTarget(owner.partUri, r.Target)
    } catch {
      relPart.fail(r.node, 'unsafe relationship target')
    }
    const part = await source.load(partUri),
      root = part.roots[0]
    const expected = {
      data: 'dataModel',
      layout: 'layoutDef',
      style: 'styleDef',
      colors: 'colorsDef',
    }[role]
    if (!D_URIS.has(root.uri) || root.local !== expected)
      part.fail(root, 'wrong relationship target root')
    relationships.push({
      role,
      relationshipId: r.Id,
      relationshipType: r.Type,
      partUri,
      preconditionHash: part.hash,
    })
    bound[role] = part
  }
  const s = bound.data,
    root = s.roots[0]
  s.attrs(root)
  s.children(root, ['ptLst', 'cxnLst', 'bg', 'whole', 'extLst'], [], D_URIS)
  if (!/^ptLst(?:,cxnLst)?(?:,bg)?(?:,whole)?(?:,extLst)?$/.test(root.children.map((c) => c.local).join(',')))
    s.fail(root, 'invalid data model sequence')
  const sourceProperties = []
  function preserveStyle(node, ownerModelId) {
    if (!node.children.length && !node.attrs.filter(a => !a.name.startsWith('xmlns')).length) return
    const tree = readSourceStyleTree(s, node, (definition, entry) => {
      if (source.consumed.has(definition.id)) s.fail(entry, 'ambiguous source style constituent')
      source.consumed.add(definition.id)
    })
    sourceProperties.push({ ...(ownerModelId ? { ownerModelId } : {}), tree,
      fidelityStatus: 'source-style-uninterpreted' })
  }
  for (const local of ['bg', 'whole']) {
    const node = root.children.find((c) => c.local === local)
    if (node) preserveStyle(node)
  }
  const pointList = s.required(root, 'ptLst', D_URIS),
    connectionList = s.required(root, 'cxnLst', D_URIS)
  s.attrs(pointList)
  s.attrs(connectionList)
  s.children(pointList, ['pt'], ['pt'], D_URIS)
  s.children(connectionList, ['cxn'], ['cxn'], D_URIS)
  const componentId = s.component(root, 'property')
  const points = pointList.children.map((node) => {
    const a = s.attrs(node, ['modelId', 'type', 'cxnId'])
    if (modelKey(a.modelId) === null) s.fail(node, 'missing/invalid modelId')
    s.children(node, ['prSet', 'spPr', 't'], [], D_URIS)
    if (!/^(?:prSet)?(?:,?spPr)?(?:,?t)?$/.test(node.children.map((c) => c.local).join(',')))
      s.fail(node, 'invalid point sequence')
    const shapePr = node.children.find((c) => c.local === 'spPr')
    if (shapePr) preserveStyle(shapePr, a.modelId)
    const pointId = s.bind(node, 'diagram-node', null, 'property')
    const p = { componentId: pointId, modelId: a.modelId, type: a.type ?? 'node', properties: [] }
    if (a.cxnId !== undefined) p.connectionId = a.cxnId
    const properties = node.children.find((c) => c.local === 'prSet')
    if (properties) {
      const attrs = s.attrs(properties, Object.keys(SMARTART_PROPERTY_TYPES))
      s.children(properties)
      p.properties = Object.entries(attrs).map(([name, value]) => ({
        name,
        value:
          SMARTART_PROPERTY_TYPES[name] === 'integer'
            ? s.number(properties, value)
            : SMARTART_PROPERTY_TYPES[name] === 'boolean'
              ? s.boolean(properties, value)
              : value,
      }))
    }
    const text = node.children.find((c) => c.local === 't')
    if (text) p.textDocument = readTableText(text, pointId, s)
    return p
  })
  const connections = connectionList.children.map((node) => {
    const a = s.attrs(node, [
      'modelId',
      'type',
      'srcId',
      'destId',
      'srcOrd',
      'destOrd',
      'parTransId',
      'sibTransId',
      'presId',
    ])
    if (['modelId', 'srcId', 'destId'].some((name) => modelKey(a[name]) === null))
      s.fail(node, 'missing/invalid connection identity')
    s.children(node)
    const result = {
      componentId: s.bind(node, 'diagram-connection', null, 'connection'),
      modelId: a.modelId,
      type: a.type ?? 'parOf',
      sourceId: a.srcId,
      destinationId: a.destId,
      sourceOrder: s.number(node, a.srcOrd, 0, 4294967295),
      destinationOrder: s.number(node, a.destOrd, 0, 4294967295),
    }
    for (const [native, field] of [
      ['parTransId', 'parentTransitionId'],
      ['sibTransId', 'siblingTransitionId'],
      ['presId', 'presentationId'],
    ])
      if (a[native] !== undefined) result[field] = a[native]
    return result
  })
  const layout = readSmartArtLayout(bound.layout)
  const sourceStyles = await readSmartArtStyles(source, bound, owner.partUri)
  const drawingFallback = await readSmartArtDrawing(source, s, owner.id,
    root.children.find(node => node.local === 'extLst'))
  const smartArtDocument = s.checked(root, () =>
    normalizeSmartArtDocument({
      schemaVersion: 1,
      componentId,
      points,
      connections,
      relationships,
      layout,
      ...(sourceProperties.length ? { sourceProperties } : {}),
      ...(sourceStyles ? { sourceStyles } : {}),
    })
  )
  s.finish()
  return {
    smartArtDocument,
    ...(drawingFallback ? { drawingFallback } : {}),
    components: source.components,
    mappedDefinitionIds: [...source.consumed],
    layoutStatus: 'authored-layout-not-evaluated',
  }
}
module.exports = { readSemanticSmartArt }
