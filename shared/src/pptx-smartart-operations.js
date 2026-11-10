const { normalizeSmartArtDocument, modelKey } = require('./pptx-smartart-document')
const { cloneTextData } = require('./pptx-text-document')

function applySmartArtOperation(input, operation) {
  const source = normalizeSmartArtDocument(input)
  const d = cloneTextData(source), command = cloneTextData(operation)
  const fail = (detail, id = d.componentId) => {
    const error = new TypeError(`Invalid PPTX SmartArt operation: ${detail}`)
    error.code = 'PPTX_SMARTART_OPERATION_INVALID'
    error.componentId = id
    throw error
  }
  const fields = (names) => {
    if (!command || typeof command !== 'object' || Array.isArray(command) ||
      Object.keys(command).length !== names.length ||
      names.some((name) => !Object.hasOwn(command, name))) fail('command fields')
  }
  const point = (id) => {
    const value = d.points.find((p) => p.componentId === id)
    if (!value) fail('missing exact point ID', id)
    return value
  }
  const logical = (id) => {
    const p = point(id)
    if (!['node', 'asst'].includes(p.type)) fail('logical node required', id)
    return p
  }
  const connection = (id) => {
    const c = d.connections.find((entry) => entry.componentId === id)
    if (!c) fail('missing exact connection ID', id)
    return c
  }
  const authored = (id, owner) => {
    const prefix = `${owner}~authored:`
    if (typeof id !== 'string' || !id.startsWith(prefix) ||
      !/^[A-Za-z0-9_-]{1,128}$/.test(id.slice(prefix.length))) fail('authored component identity', id)
  }
  // Retained source identities may not change text owner, parent or node kind.
  const textIdentities = (document) => {
    const entries = new Map()
    if (!document) return entries
    entries.set(document.componentId, ['body', d.componentId])
    for (const p of document.paragraphs) {
      entries.set(p.componentId, ['paragraph', document.componentId])
      for (const r of p.runs) entries.set(r.componentId, [`run:${r.kind}`, p.componentId])
    }
    return entries
  }
  const checkText = (next, previous) => {
    if (!next || !Array.isArray(next.paragraphs)) fail('text document')
    if (previous) {
      if (next.componentId !== previous.componentId) fail('text body identity', next.componentId)
    } else authored(next.componentId, d.componentId)
    const old = textIdentities(previous)
    for (const [id, [kind, owner]] of textIdentities(next)) {
      if (old.has(id)) {
        if (old.get(id)[0] !== kind || old.get(id)[1] !== owner) fail('text identity owner/kind', id)
      } else if (id !== next.componentId) authored(id, next.componentId)
    }
  }
  switch (command?.type) {
    case 'label': {
      fields(['type', 'pointId', 'textDocument'])
      const p = logical(command.pointId)
      checkText(command.textDocument, p.textDocument)
      p.textDocument = command.textDocument
      break
    }
    case 'add': {
      fields(['type', 'point', 'connection'])
      const p = command.point, c = command.connection
      authored(p?.componentId, d.componentId)
      authored(c?.componentId, d.componentId)
      if (!['node', 'asst'].includes(p.type) || c.type !== 'parOf' ||
        modelKey(c.destinationId) !== modelKey(p.modelId)) fail('new node hierarchy')
      if (!d.points.some((parent) => modelKey(parent.modelId) === modelKey(c.sourceId) &&
        ['doc', 'node', 'asst'].includes(parent.type))) fail('new node parent')
      if (p.textDocument) checkText(p.textDocument)
      d.points.push(p)
      d.connections.push(c)
      break
    }
    case 'delete': {
      fields(['type', 'pointId'])
      const p = logical(command.pointId)
      d.points = d.points.filter((entry) => entry.componentId !== p.componentId)
      d.connections = d.connections.filter((c) =>
        !['sourceId', 'destinationId', 'parentTransitionId', 'siblingTransitionId', 'presentationId']
          .some((name) => Object.hasOwn(c, name) && modelKey(c[name]) === modelKey(p.modelId)))
      break
    }
    case 'reorder': {
      fields(['type', 'parentId', 'pointIds'])
      const parent = point(command.parentId)
      const edges = d.connections.filter((c) =>
        c.type === 'parOf' && modelKey(c.sourceId) === modelKey(parent.modelId))
      const ids = command.pointIds
      if (!Array.isArray(ids) || ids.length !== edges.length || new Set(ids).size !== ids.length)
        fail('complete sibling permutation required')
      const ordered = ids.map((id) => {
        const p = logical(id)
        const matching = edges.filter((c) => modelKey(c.destinationId) === modelKey(p.modelId))
        if (matching.length !== 1) fail('ambiguous/non-sibling point', id)
        return matching[0]
      })
      ordered.forEach((c, i) => { c.sourceOrder = i })
      break
    }
    case 'reparent': {
      fields(['type', 'pointId', 'parentId', 'connectionId'])
      const p = logical(command.pointId), parent = point(command.parentId)
      const c = connection(command.connectionId)
      const incoming = d.connections.filter((edge) => edge.type === 'parOf' &&
        modelKey(edge.destinationId) === modelKey(p.modelId))
      if (!['doc', 'node', 'asst'].includes(parent.type) ||
        c.type !== 'parOf' || incoming.length !== 1 || incoming[0] !== c)
        fail('exact single incoming hierarchy connection required', c.componentId)
      // Selecting the existing parent is not an implicit move-to-end command.
      if (modelKey(c.sourceId) === modelKey(parent.modelId)) break
      const orders = d.connections.filter((edge) => edge.componentId !== c.componentId &&
        edge.type === 'parOf' && modelKey(edge.sourceId) === modelKey(parent.modelId))
      c.sourceId = parent.modelId
      c.sourceOrder = orders.length ? Math.max(...orders.map((edge) => edge.sourceOrder)) + 1 : 0
      break
    }
    case 'connection': {
      if (command.action === 'add') {
        fields(['type', 'action', 'connection'])
        authored(command.connection?.componentId, d.componentId)
        d.connections.push(command.connection)
      } else if (command.action === 'delete') {
        fields(['type', 'action', 'connectionId'])
        connection(command.connectionId)
        d.connections = d.connections.filter((c) => c.componentId !== command.connectionId)
      } else fail('connection action')
      break
    }
    case 'style': {
      fields(['type', 'pointId', 'properties'])
      const p = logical(command.pointId)
      const allowed = ['presStyleLbl', 'presStyleIdx', 'presStyleCnt']
      if (!Array.isArray(command.properties) ||
        command.properties.some((property) => !allowed.includes(property.name)))
        fail('unsupported style property', p.componentId)
      p.properties = [...p.properties.filter((property) => !allowed.includes(property.name)),
        ...command.properties]
      break
    }
    case 'layout': {
      fields(['type', 'declarationId', 'attribute', 'value'])
      const declaration = d.layout?.declarations.find((entry) => entry.componentId === command.declarationId)
      if (!declaration) fail('missing exact layout declaration ID', command.declarationId)
      const { attributes, type } = declaration
      const attribute = command.attribute
      // Edit only existing executable values, never declaration topology,
      // selectors, algorithms, source locators or component ownership.
      if (!((type === 'param' && attribute === 'val') ||
        (type === 'constr' && ['val', 'fact'].includes(attribute))) ||
        !Object.hasOwn(attributes, attribute))
        fail('existing layout parameter/constraint value required', declaration.componentId)
      if (type === 'constr' && (typeof command.value !== 'number' ||
        !Number.isFinite(command.value) ||
        (['w', 'h', 'sp'].includes(attributes.type) && command.value < 0)))
        fail('finite valid constraint value required', declaration.componentId)
      attributes[attribute] = command.value
      break
    }
    default: fail('unknown command')
  }
  const result = normalizeSmartArtDocument(d)
  const incoming = new Map(result.points.map((p) => [modelKey(p.modelId), 0]))
  const kinds = new Map(result.points.map((p) => [modelKey(p.modelId), p.type]))
  for (const edge of result.connections.filter((c) => c.type === 'parOf')) {
    if (!['doc', 'node', 'asst'].includes(kinds.get(modelKey(edge.sourceId))) ||
      !['node', 'asst'].includes(kinds.get(modelKey(edge.destinationId))))
      fail('logical hierarchy endpoint kind', edge.componentId)
    const key = modelKey(edge.destinationId)
    incoming.set(key, incoming.get(key) + 1)
  }
  if (result.points.filter((p) => p.type === 'doc').length !== 1) fail('single hierarchy root required')
  for (const p of result.points)
    if (['node', 'asst'].includes(p.type) && incoming.get(modelKey(p.modelId)) !== 1)
      fail('logical node requires exactly one hierarchy parent', p.componentId)
  return result
}

module.exports = { applySmartArtOperation }
