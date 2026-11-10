const { modelKey } = require('./pptx-smartart-document')
const { layoutFailure } = require('./pptx-smartart-layout-declarations')

function instantiateLayout(document) {
  const declarations = new Map(document.layout.declarations.map((d) => [d.componentId, d]))
  const children = (d, type) =>
    d.children.map((id) => declarations.get(id)).filter((c) => c.type === type)
  const root = declarations.get(document.layout.rootId)
  const roots = children(root, 'layoutNode')
  if (roots.length !== 1) layoutFailure(root, 'requires one executable root layoutNode')
  // Compile every layout node before data selection. An empty iteration must
  // not hide unsupported algorithms or static presentation configurations.
  const programs = new Map()
  for (const d of declarations.values()) {
    if (d.type !== 'layoutNode') continue
    const algorithms = children(d, 'alg')
    if (algorithms.length !== 1) layoutFailure(d, 'requires one algorithm')
    const algorithm = algorithms[0],
      params = {}
    for (const p of children(algorithm, 'param')) {
      if (Object.hasOwn(params, p.attributes.type)) layoutFailure(p, 'duplicate parameter')
      params[p.attributes.type] = p.attributes.val
    }
    if (['composite', 'comp', 'sp'].includes(algorithm.attributes.type) && Object.keys(params).length)
      layoutFailure(algorithm, 'composite parameters')
    if (algorithm.attributes.type === 'lin') {
      const horizontal = ['fromL', 'fromR'].includes(params.linDir)
      const alignment = horizontal ? 'vertAlign' : 'horzAlign'
      if (!params.linDir || !params[alignment] || Object.keys(params).length !== 2)
        layoutFailure(algorithm, 'linear requires explicit direction and cross-axis alignment only')
    }
    const pres = children(d, 'presOf')[0],
      shape = children(d, 'shape')[0]
    if (shape && !pres) layoutFailure(shape, 'shape without logical presentation')
    programs.set(d.componentId, { algorithm, params, pres, shape })
  }
  const points = new Map(document.points.map((p) => [modelKey(p.modelId), p]))
  const docs = document.points.filter((p) => p.type === 'doc')
  if (docs.length !== 1) layoutFailure(root, 'requires one data document point')
  const outgoing = new Map(document.points.map((p) => [p, []]))
  for (const edge of document.connections.filter((e) => e.type === 'parOf'))
    outgoing.get(points.get(modelKey(edge.sourceId))).push(edge)
  for (const edges of outgoing.values()) edges.sort((a, b) => a.sourceOrder - b.sourceOrder)
  const select = (d, point) => {
    const a = d.attributes,
      axis = a.axis ?? 'self',
      selected = []
    const pending =
      axis === 'self' || axis === 'desOrSelf'
        ? [point]
        : outgoing
            .get(point)
            .map((e) => points.get(modelKey(e.destinationId)))
            .reverse()
    const seen = new Set()
    while (pending.length) {
      const p = pending.pop()
      if (seen.has(p)) layoutFailure(d, 'ambiguous data ancestry')
      seen.add(p)
      if (!a.ptType || a.ptType === 'all' || a.ptType === p.type) selected.push(p)
      if (axis === 'des' || axis === 'desOrSelf')
        pending.push(
          ...outgoing
            .get(p)
            .map((e) => points.get(modelKey(e.destinationId)))
            .reverse()
        )
    }
    return selected
  }
  const nodes = [],
    pending = [{ declaration: roots[0], point: docs[0], parent: null }]
  while (pending.length) {
    if (nodes.length + pending.length > 100000) layoutFailure(root, 'expanded layout budget')
    const item = pending.pop(),
      d = item.declaration
    if (d.type === 'forEach') {
      const selected = select(d, item.point)
      if (nodes.length + pending.length + selected.length * d.children.length > 100000)
        layoutFailure(d, 'expanded layout budget')
      for (let i = selected.length - 1; i >= 0; i--)
        for (let j = d.children.length - 1; j >= 0; j--)
          pending.push({
            declaration: declarations.get(d.children[j]),
            point: selected[i],
            parent: item.parent,
          })
      continue
    }
    if (d.type === 'choose') {
      let chosen = null
      for (const childId of d.children) {
        const branch = declarations.get(childId)
        if (branch.type === 'else') {
          chosen = branch
          break
        }
        if (branch.type === 'if') {
          const a = branch.attributes
          let count = 0
          if (!a.func || a.func === 'cnt') {
            count = select({ attributes: { axis: 'des', ptType: 'node' } }, item.point).length
          }
          const expected = Number(a.val)
          let match = false
          if (a.op === 'equ') match = count === expected
          else if (a.op === 'neq') match = count !== expected
          else if (a.op === 'gt') match = count > expected
          else if (a.op === 'gte') match = count >= expected
          else if (a.op === 'lt') match = count < expected
          else if (a.op === 'lte') match = count <= expected
          else match = count === expected
          if (match) {
            chosen = branch
            break
          }
        }
      }
      if (chosen) {
        for (let j = chosen.children.length - 1; j >= 0; j--) {
          pending.push({
            declaration: declarations.get(chosen.children[j]),
            point: item.point,
            parent: item.parent,
          })
        }
      }
      continue
    }
    const { algorithm, params, pres, shape } = programs.get(d.componentId)
    const node = {
      index: nodes.length,
      declaration: d,
      point: item.point,
      parent: item.parent,
      children: [],
      algorithm,
      params,
      constraints: children(d, 'constrLst').flatMap((c) => children(c, 'constr')),
    }
    nodes.push(node)
    if (item.parent) item.parent.children.push(node)
    if (pres) {
      const selected = select(pres, node.point)
      if (selected.length !== 1) layoutFailure(pres, 'presentation must select exactly one point')
      node.presented = selected[0]
    }
    node.shape = shape
    pending.push(
      ...d.children
        .map((id) => declarations.get(id))
        .filter((c) => ['layoutNode', 'forEach', 'choose'].includes(c.type))
        .reverse()
        .map((declaration) => ({ declaration, point: node.point, parent: node }))
    )
  }
  return nodes
}
module.exports = { instantiateLayout }
