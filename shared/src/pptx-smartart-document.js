const { cloneTextData, normalizeTextDocument } = require('./pptx-text-document')
const { normalizeSmartArtLayout } = require('./pptx-smartart-layout-declarations')
const { normalizeSmartArtStyles } = require('./pptx-smartart-style')
const { validateSourceStyleTree } = require('./pptx-source-style-tree')

// Source graph and optional authored declarations; placements are derived
// separately and never replace the graph or qualify native fidelity.
const SMARTART_PROPERTY_TYPES = Object.freeze({
  presAssocID: 'modelId',
  presName: 'string',
  presStyleLbl: 'string',
  presStyleIdx: 'integer',
  presStyleCnt: 'integer',
  loTypeId: 'string',
  loCatId: 'string',
  qsTypeId: 'string',
  qsCatId: 'string',
  csTypeId: 'string',
  csCatId: 'string',
  phldr: 'boolean',
  phldrT: 'string',
  coherent3DOff: 'boolean',
  custAng: 'integer',
  custFlipHor: 'boolean',
  custFlipVert: 'boolean',
  custLinFactNeighborX: 'integer',
  custLinFactNeighborY: 'integer',
  custLinFactX: 'integer',
  custLinFactY: 'integer',
  custRadScaleInc: 'integer',
  custRadScaleRad: 'integer',
  custScaleX: 'integer',
  custScaleY: 'integer',
  custSzX: 'integer',
  custSzY: 'integer',
  custT: 'boolean',
})
const SMARTART_ROLES = Object.freeze({
  data: 'diagramData',
  layout: 'diagramLayout',
  style: 'diagramQuickStyle',
  colors: 'diagramColors',
})
function smartArtFailure(detail, componentId) {
  const error = new TypeError(`Invalid PPTX SmartArt: ${detail}`)
  error.componentId = componentId
  throw error
}
function modelKey(value) {
  if (typeof value !== 'string') return null
  if (/^\d+$/.test(value) && Number(value) <= 4294967295) return String(Number(value))
  if (/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(value))
    return value.toLowerCase()
  if (/^[a-zA-Z_][a-zA-Z0-9._-]{0,255}$/.test(value))
    return value
  return null
}
function normalizeSmartArtDocument(input) {
  const d = cloneTextData(input),
    ids = new Set(),
    models = new Set()
  const fail = (detail, id = d.componentId) => smartArtFailure(detail, id)
  const record = (v, allowed, required = allowed) => {
    if (
      !v ||
      typeof v !== 'object' ||
      Array.isArray(v) ||
      Object.keys(v).some((k) => !allowed.includes(k)) ||
      required.some((k) => !Object.hasOwn(v, k))
    )
      fail('record fields', v?.componentId)
  }
  const identity = (id) => {
    if (typeof id !== 'string' || !id.length || id.length > 1024 || ids.has(id))
      fail('component identity', id)
    ids.add(id)
  }
  const integer = (n) => Number.isSafeInteger(n) && n >= 0 && n <= 4294967295
  const model = (entry) => {
    identity(entry.componentId)
    const key = modelKey(entry.modelId)
    if (key === null || models.has(key)) fail('duplicate/invalid model identity', entry.componentId)
    models.add(key)
  }
  record(
    d,
    ['schemaVersion', 'componentId', 'points', 'connections', 'relationships', 'layout', 'sourceStyles', 'sourceProperties'],
    ['schemaVersion', 'componentId', 'points', 'connections', 'relationships']
  )
  if (d.schemaVersion !== 1) fail('schema version')
  identity(d.componentId)
  if (
    !Array.isArray(d.points) ||
    !d.points.length ||
    d.points.length > 100000 ||
    !Array.isArray(d.connections) ||
    d.connections.length > 100000
  )
    fail('graph budget')
  for (const p of d.points) {
    record(
      p,
      ['componentId', 'modelId', 'type', 'connectionId', 'properties', 'textDocument'],
      ['componentId', 'modelId', 'type', 'properties']
    )
    model(p)
    if (!['node', 'doc', 'asst', 'pres', 'parTrans', 'sibTrans'].includes(p.type))
      fail('point type', p.componentId)
    if (!Array.isArray(p.properties)) fail('point properties', p.componentId)
    const seen = new Set()
    for (const prop of p.properties) {
      record(prop, ['name', 'value'])
      const type = SMARTART_PROPERTY_TYPES[prop.name],
        v = prop.value
      if (
        !Object.hasOwn(SMARTART_PROPERTY_TYPES, prop.name) ||
        seen.has(prop.name) ||
        (type === 'integer' && (!Number.isSafeInteger(v) || v < -2147483648 || v > 2147483647)) ||
        (type === 'boolean' && typeof v !== 'boolean') ||
        (type === 'string' && (typeof v !== 'string' || v.length > 1048576)) ||
        (type === 'modelId' && modelKey(v) === null)
      )
        fail('point property', p.componentId)
      seen.add(prop.name)
    }
    if (Object.hasOwn(p, 'textDocument')) {
      try {
        p.textDocument = normalizeTextDocument(p.textDocument)
      } catch (e) {
        fail(e.message, p.componentId)
      }
      identity(p.textDocument.componentId)
      for (const paragraph of p.textDocument.paragraphs) {
        identity(paragraph.componentId)
        for (const run of paragraph.runs) identity(run.componentId)
      }
    }
  }
  const points = new Set(d.points.map((p) => modelKey(p.modelId)))
  const pointTypes = new Map(d.points.map((p) => [modelKey(p.modelId), p.type]))
  for (const c of d.connections) {
    record(
      c,
      [
        'componentId',
        'modelId',
        'type',
        'sourceId',
        'destinationId',
        'sourceOrder',
        'destinationOrder',
        'parentTransitionId',
        'siblingTransitionId',
        'presentationId',
      ],
      [
        'componentId',
        'modelId',
        'type',
        'sourceId',
        'destinationId',
        'sourceOrder',
        'destinationOrder',
      ]
    )
    model(c)
    if (
      !['parOf', 'presOf', 'presParOf'].includes(c.type) ||
      !integer(c.sourceOrder) ||
      !integer(c.destinationOrder)
    )
      fail('connection type/order', c.componentId)
    for (const name of [
      'sourceId',
      'destinationId',
      'parentTransitionId',
      'siblingTransitionId',
      'presentationId',
    ])
      if (
        (Object.hasOwn(c, name) || ['sourceId', 'destinationId'].includes(name)) &&
        !points.has(modelKey(c[name]))
      )
        fail(`missing endpoint ${name}`, c.componentId)
    for (const [field, type] of [
      ['parentTransitionId', 'parTrans'],
      ['siblingTransitionId', 'sibTrans'],
    ])
      if (Object.hasOwn(c, field) && pointTypes.get(modelKey(c[field])) !== type)
        fail(`wrong transition type ${field}`, c.componentId)
  }
  const connections = new Set(d.connections.map((c) => modelKey(c.modelId)))
  for (const p of d.points) {
    if (Object.hasOwn(p, 'connectionId') && !connections.has(modelKey(p.connectionId)))
      fail('missing point connection', p.componentId)
    for (const prop of p.properties)
      if (prop.name === 'presAssocID' && !points.has(modelKey(prop.value)))
        fail('missing presentation association', p.componentId)
  }
  // Only hierarchy edge domains are acyclic. Presentation associations are not
  // interpreted as tree ancestry. Kahn's algorithm avoids a recursion-depth cap.
  for (const type of ['parOf', 'presParOf']) {
    const outgoing = new Map([...points].map((key) => [key, []]))
    const indegree = new Map([...points].map((key) => [key, 0]))
    const edges = d.connections.filter((c) => c.type === type)
    for (const c of edges) {
      outgoing.get(modelKey(c.sourceId)).push(modelKey(c.destinationId))
      const key = modelKey(c.destinationId)
      indegree.set(key, indegree.get(key) + 1)
    }
    const ready = [...points].filter((key) => indegree.get(key) === 0)
    for (let i = 0; i < ready.length; i++)
      for (const next of outgoing.get(ready[i])) {
        indegree.set(next, indegree.get(next) - 1)
        if (indegree.get(next) === 0) ready.push(next)
      }
    if (ready.length !== points.size)
      fail(
        'hierarchy cycle',
        edges.find((c) => indegree.get(modelKey(c.destinationId)) > 0).componentId
      )
  }
  if (!Array.isArray(d.relationships) || d.relationships.length !== 4) fail('relationship roles')
  const roles = new Set()
  for (const r of d.relationships) {
    record(r, ['role', 'relationshipId', 'relationshipType', 'partUri', 'preconditionHash'])
    if (
      !Object.hasOwn(SMARTART_ROLES, r.role) ||
      roles.has(r.role) ||
      typeof r.relationshipId !== 'string' ||
      !r.relationshipId ||
      ![
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'http://purl.oclc.org/ooxml/officeDocument/relationships',
      ].some((ns) => r.relationshipType === `${ns}/${SMARTART_ROLES[r.role]}`) ||
      typeof r.partUri !== 'string' ||
      !r.partUri ||
      /^(?:\/|[a-z]+:)|\\|(?:^|\/)\.\.?(?:\/|$)/i.test(r.partUri) ||
      !/^[a-f0-9]{64}$/.test(r.preconditionHash)
    )
      fail('relationship identity')
    roles.add(r.role)
  }
  if (Object.hasOwn(d, 'layout')) {
    d.layout = normalizeSmartArtLayout(
      d.layout,
      d.relationships.find((r) => r.role === 'layout')
    )
    for (const declaration of d.layout.declarations) identity(declaration.componentId)
  }
  if (Object.hasOwn(d, 'sourceStyles')) {
    d.sourceStyles = normalizeSmartArtStyles(d.sourceStyles, d.relationships)
    for (const label of d.sourceStyles.labels) {
      identity(label.componentId)
      if (label.textStyleDocument) {
        identity(label.textStyleDocument.componentId)
        for (const paragraph of label.textStyleDocument.paragraphs) identity(paragraph.componentId)
      }
    }
  }
  if (d.sourceProperties !== undefined) {
    if (!Array.isArray(d.sourceProperties) || d.sourceProperties.length > 100002) fail('source style budget')
    const data = d.relationships.find(r => r.role === 'data'), paths = new Set()
    for (const property of d.sourceProperties) {
      record(property, ['ownerModelId', 'tree', 'fidelityStatus'], ['tree', 'fidelityStatus'])
      if (property.fidelityStatus !== 'source-style-uninterpreted') fail('source style fidelity status')
      const tree = property.tree
      validateSourceStyleTree(tree, data)
      const path = JSON.stringify(tree.source.path)
      if (paths.has(path)) fail('duplicate source style')
      paths.add(path)
      if (property.ownerModelId !== undefined) {
        const point = d.points.find(p => p.modelId === property.ownerModelId)
        const ownerPath = point?.componentId.split(':').at(-1).split('.').map(Number)
        if (!point || tree.type !== 'spPr' || tree.source.path.length !== ownerPath.length + 1 ||
            !ownerPath.every((n, i) => tree.source.path[i] === n)) fail('source point style owner')
      } else if (!['bg', 'whole'].includes(tree.type) || tree.source.path.length !== 2) fail('source graph style owner')
    }
  }
  function freeze(v) {
    if (v && typeof v === 'object') {
      Object.values(v).forEach(freeze)
      Object.freeze(v)
    }
    return v
  }
  return freeze(d)
}
module.exports = { normalizeSmartArtDocument, SMARTART_PROPERTY_TYPES, SMARTART_ROLES, modelKey }
