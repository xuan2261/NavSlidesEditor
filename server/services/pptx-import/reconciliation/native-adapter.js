const { createInventory } = require('./inventory')
const { emuRectToUnits, pixelsToEmu } = require('./units')

function ancestryFor(node, byId) {
  const ancestry = []
  const seen = new Set()
  let parentId = node.parentId
  while (parentId != null && !seen.has(String(parentId))) {
    const id = String(parentId)
    seen.add(id)
    ancestry.unshift(id)
    parentId = byId.get(id)?.parentId
  }
  return ancestry
}

function emuRect(xfrm) {
  if (!xfrm) return null
  if (xfrm.emu) {
    const rect = {
      x: xfrm.emu.x,
      y: xfrm.emu.y,
      width: xfrm.emu.width ?? xfrm.emu.cx,
      height: xfrm.emu.height ?? xfrm.emu.cy,
    }
    return Object.values(rect).every(Number.isFinite) ? rect : null
  }
  const values = [xfrm.x, xfrm.y, xfrm.cx, xfrm.cy]
  if (values.some((value) => !Number.isFinite(value))) return null
  return {
    x: pixelsToEmu(xfrm.x),
    y: pixelsToEmu(xfrm.y),
    width: pixelsToEmu(xfrm.cx),
    height: pixelsToEmu(xfrm.cy),
  }
}

function relationshipsFor(node, slideRelationships) {
  return Object.entries(node.rels || {}).map(([role, idOrTarget]) => {
    const relation = slideRelationships.find((item) => item.id === idOrTarget)
    return {
      role,
      id: relation?.id || (String(idOrTarget).startsWith('rId') ? idOrTarget : null),
      target: relation?.target || idOrTarget,
      type: relation?.type || null,
    }
  })
}

function nativeKind(node) {
  if (node.kind === 'graphicFrame' && node.graphicKind) return node.graphicKind
  return node.kind
}

function adaptSlide(slide, options) {
  const nodes = slide.nodes || []
  const byId = new Map(nodes.map((node) => [String(node.id), node]))
  return {
    part: slide.path,
    index: slide.index,
    size: options.packageSize || null,
    inheritance: slide.inheritance || null,
    relationships: slide.rels || [],
    objects: nodes.map((node, zOrder) => {
      const rect = emuRect(node.xfrm)
      return {
        kind: nativeKind(node),
        nativeId: String(node.id),
        name: node.name || null,
        ancestry: ancestryFor(node, byId),
        zOrder,
        transform: rect ? emuRectToUnits(rect, options.canvas) : null,
        rawTransform: node.xfrm || null,
        style: {
          origin: node.styleOrigin || 'explicit',
          value: node.style || {},
        },
        placeholder: node.ph || null,
        relationships: relationshipsFor(node, slide.rels || []),
        dependentParts: Object.values(node.rels || {}).filter((value) =>
          typeof value === 'string' && !value.startsWith('rId')
        ),
        unknown: node.kind === 'contentPart' || node.graphicKind === 'unknown'
          ? { classification: node.graphicKind || node.kind }
          : null,
        editabilityTier: node.kind === 'contentPart' ? 'preserve' : 'native',
        lineage: {
          method: 'scene-graph',
          confidence: 1,
          warnings: [],
          evidence: [slide.path],
        },
      }
    }),
  }
}

function adaptNativeSceneGraph(graph, options = {}) {
  return createInventory({
    source: 'native',
    revisionId: options.revisionId || null,
    package: {
      size: options.packageSize || null,
      layoutParts: graph?.layouts || [],
      masterParts: graph?.masters || [],
      themeParts: graph?.theme?.path ? [graph.theme.path] : [],
      dependentParts: graph?.dependentParts || [],
    },
    slides: (graph?.slides || []).map((slide) => adaptSlide(slide, options)),
    warnings: graph?.error ? [graph.error] : [],
  })
}

module.exports = { adaptNativeSceneGraph }
