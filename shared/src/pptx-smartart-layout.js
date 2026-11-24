const { normalizeSmartArtDocument } = require('./pptx-smartart-document')
const { instantiateLayout } = require('./pptx-smartart-layout-graph')
const { solveLayoutConstraints } = require('./pptx-smartart-layout-constraints')
const { layoutFailure, freezeLayout } = require('./pptx-smartart-layout-declarations')

// Pure logical placement, not paint, native qualification or a cached drawing.
// Bounds and literal spatial constraints use the same caller-provided layout
// coordinate system. No EMU/point conversion, fitting or text sizing is inferred.
function evaluateSmartArtLayout(input, bounds) {
  const document = normalizeSmartArtDocument(input)
  if (!document.layout) layoutFailure(null, 'missing authored layout')
  const root = document.layout.declarations[0]
  if (
    !bounds ||
    Object.keys(bounds).length !== 4 ||
    ['x', 'y', 'width', 'height'].some(
      (k) => !Object.hasOwn(bounds, k) || !Number.isFinite(bounds[k])
    ) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  )
    layoutFailure(root, 'invalid layout bounds')
  for (const point of document.points)
    if (point.properties.some((p) => p.name.startsWith('cust')))
      layoutFailure(
        {
          componentId: point.componentId,
          type: 'pt',
          source: { partUri: document.relationships.find((r) => r.role === 'data').partUri },
        },
        'custom point layout override'
      )
  const nodes = instantiateLayout(document),
    get = solveLayoutConstraints(nodes, bounds)
  const placements = [],
    placed = new Set()
  for (const node of nodes) {
    node.x = (node.parent ? node.parent.x : bounds.x) + get(node, 'l')
    node.y = (node.parent ? node.parent.y : bounds.y) + get(node, 't')
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y))
      layoutFailure(node.declaration, 'coordinate overflow')
    if (!node.presented) continue
    const p = node.presented
    if (placed.has(p.componentId)) layoutFailure(node.declaration, 'duplicate logical placement')
    placed.add(p.componentId)
    placements.push({
      componentId: p.componentId,
      modelId: p.modelId,
      layoutComponentId: node.declaration.componentId,
      algorithmComponentId: node.algorithm.componentId,
      source: node.declaration.source,
      x: node.x,
      y: node.y,
      width: get(node, 'w'),
      height: get(node, 'h'),
      ...(node.declaration.attributes.styleLbl !== undefined
        ? { styleLabel: node.declaration.attributes.styleLbl }
        : {}),
      ...(node.shape ? { shapeType: node.shape.attributes.type } : {}),
    })
  }
  for (const point of document.points)
    if (['node', 'asst'].includes(point.type) && !placed.has(point.componentId))
      layoutFailure(root, `unplaced logical node ${point.modelId}`)
  return freezeLayout({
    layoutStatus: 'authored-layout-evaluated',
    placements,
    relationships: document.relationships,
    graphComponentId: document.componentId,
  })
}
module.exports = { evaluateSmartArtLayout }
