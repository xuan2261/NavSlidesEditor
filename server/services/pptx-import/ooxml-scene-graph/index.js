const { parseSpTree } = require('./parse-sptree')
const { parseRelationshipTargets, rejectTraversalTarget } = require('./parse-rels')
const { inspectOoxmlCoverage } = require('../ooxml-inspection')
const { collectMappedNodeIds, leafNodes, sourceKey } = require('./attach-source-nodes')
const { resolveSceneGraphStrictPolicy } = require('./strict-policy')

async function readZipText(zip, entry) {
  const file = zip?.file?.(entry)
  if (!file) return ''
  try {
    return await file.async('string')
  } catch {
    return ''
  }
}

function listZipEntries(zip) {
  return Object.keys(zip?.files || {})
    .map((e) => e.replace(/\\/g, '/'))
    .filter(Boolean)
}

/**
 * Build OOXML scene graph inventory from package zip (JSZip).
 * @param {import('jszip')} zip
 */
async function buildOoxmlSceneGraph(zip) {
  const entries = listZipEntries(zip)
  const slidePaths = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e))
    .sort((a, b) => {
      const ai = Number(a.match(/slide(\d+)/i)?.[1] || 0)
      const bi = Number(b.match(/slide(\d+)/i)?.[1] || 0)
      return ai - bi
    })

  const slides = []
  for (const slidePath of slidePaths) {
    const index = Number(slidePath.match(/slide(\d+)/i)?.[1] || 1) - 1
    const relPath = `ppt/slides/_rels/slide${index + 1}.xml.rels`
    const slideXml = await readZipText(zip, slidePath)
    const relXml = await readZipText(zip, relPath)
    const rels = parseRelationshipTargets(relXml, relPath)
    const relById = Object.fromEntries(rels.filter((r) => r.id).map((r) => [r.id, r]))

    const nodes = parseSpTree(slideXml).map((node) => {
      const next = { ...node, rels: { ...node.rels } }
      if (next.rels.blipEmbed && relById[next.rels.blipEmbed]) {
        const target = rejectTraversalTarget(relById[next.rels.blipEmbed].target)
        next.rels.blipTarget = target
      }
      if (next.kind === 'graphicFrame') {
        // Bind only the relationship declared on this frame (not every chart/diagram on the slide).
        const rid = next.rels.graphicRelId
        if (rid && relById[rid]) {
          const target = rejectTraversalTarget(relById[rid].target)
          if (target) {
            if (/charts\/chart/i.test(target)) {
              next.rels.chartTarget = target
              next.graphicKind = next.graphicKind || 'chart'
            } else if (/diagrams\/data/i.test(target)) {
              next.rels.diagramTarget = target
              next.graphicKind = next.graphicKind || 'diagram'
            } else {
              next.rels.graphicTarget = target
            }
          }
        }
      }
      return next
    })

    slides.push({ index, path: slidePath, nodes, rels })
  }

  const themePath = entries.find((e) => /^ppt\/theme\/theme\d+\.xml$/i.test(e)) || null
  const ooxml = await inspectOoxmlCoverage(zip)
  const allNodes = slides.flatMap((s) => s.nodes)
  const stats = {
    slideCount: slides.length,
    nodeCount: allNodes.length,
    byKind: allNodes.reduce((acc, n) => {
      acc[n.kind] = (acc[n.kind] || 0) + 1
      return acc
    }, {}),
    chartNodes: allNodes.filter((n) => n.graphicKind === 'chart' || n.rels?.chartTarget).length,
    diagramNodes: allNodes.filter((n) => n.graphicKind === 'diagram' || n.rels?.diagramTarget).length,
  }

  return {
    slides,
    theme: themePath ? { path: themePath } : null,
    masters: entries.filter((e) => /^ppt\/slideMasters\//i.test(e)),
    layouts: entries.filter((e) => /^ppt\/slideLayouts\//i.test(e)),
    stats,
    ooxml,
  }
}

/**
 * Reconcile mapped presentation elements against scene graph inventory.
 *
 * Prefers nodeId coverage via `_pptxSource.nodeId` when present.
 * Count comparison remains soft diagnostic.
 * Strict fail:
 *   - PPTX_SLA_STRICT_COUNT=1 → empty-mapped slides
 *   - PPTX_SLA_STRICT_NODES=1 / options.strictNodeGate → unmapped leaf nodeIds
 *
 * @returns {{ unmapped: object[], warnings: object[], mappedNodeIds: string[] }}
 */
function reconcileSceneGraph(graph, presentation, options = {}) {
  const policy = resolveSceneGraphStrictPolicy(options)
  const strictCount = policy.strictCountGate
  const strictNodes = policy.strictNodeGate
  const warnings = []
  const unmapped = []
  const mappedIds = collectMappedNodeIds(presentation)

  for (const gSlide of graph?.slides || []) {
    const leaves = leafNodes(gSlide.nodes)
    const graphCount = leaves.length
    const mappedElements = presentation?.slides?.[gSlide.index]?.elements || []
    const mappedCount = mappedElements.length
    const authoritativeIds = new Set(
      mappedElements
        .filter((element) => element?._pptxSource?.authoritative !== false)
        .map((element) => element?._pptxSource?.nodeId)
        .filter((id) => id != null && id !== '')
        .map((id) => sourceKey(gSlide.index, id))
    )

    if (graphCount > 0 && mappedCount === 0) {
      unmapped.push({
        slideIndex: gSlide.index,
        graphCount,
        mappedCount,
        gap: graphCount,
        severity: 'empty-mapped',
      })
      warnings.push({
        slideIndex: gSlide.index,
        type: 'scene-graph-unmapped',
        message: `Scene graph has ${graphCount} leaf nodes but mapped slide is empty`,
      })
      continue
    }

    if (authoritativeIds.size > 0) {
      const missing = leaves.filter((n) => !mappedIds.has(sourceKey(gSlide.index, n.id)))
      for (const node of missing) {
        unmapped.push({
          slideIndex: gSlide.index,
          nodeId: String(node.id),
          kind: node.kind,
          severity: 'node-unmapped',
        })
      }
      if (missing.length) {
        warnings.push({
          slideIndex: gSlide.index,
          type: 'scene-graph-unmapped',
          message: `${missing.length} scene-graph leaf node(s) lack _pptxSource mapping on slide ${gSlide.index + 1}`,
        })
      }
    } else if (strictNodes && graphCount > 0) {
      for (const node of leaves) {
        unmapped.push({
          slideIndex: gSlide.index,
          nodeId: String(node.id),
          kind: node.kind,
          severity: 'node-unverifiable',
        })
      }
      warnings.push({
        slideIndex: gSlide.index,
        type: 'scene-graph-unverifiable',
        message: `${graphCount} scene-graph leaf node(s) lack authoritative identity on slide ${gSlide.index + 1}`,
      })
    } else if (mappedCount < graphCount) {
      const gap = graphCount - mappedCount
      unmapped.push({
        slideIndex: gSlide.index,
        graphCount,
        mappedCount,
        gap,
        severity: 'count-heuristic',
      })
      warnings.push({
        slideIndex: gSlide.index,
        type: 'scene-graph-unmapped',
        message: `Scene graph leaf count ${graphCount} > mapped elements ${mappedCount} (gap ${gap}; no nodeId stamps)`,
      })
    }
  }

  const hardEmpty = unmapped.filter((u) => u.severity === 'empty-mapped')
  if (strictCount && hardEmpty.length) {
    const err = new Error(
      `PPTX_SLA_STRICT_COUNT: ${hardEmpty.length} slide(s) have empty mapping for non-empty scene graph`
    )
    err.type = 'import-failed'
    err.code = 'scene-graph-unmapped'
    err.unmapped = hardEmpty
    throw err
  }

  const hardNodes = unmapped.filter(
    (u) => u.severity === 'node-unmapped' || u.severity === 'node-unverifiable'
  )
  if (strictNodes && hardNodes.length) {
    const err = new Error(`PPTX_SLA_STRICT_NODES: ${hardNodes.length} leaf node(s) unmapped`)
    err.type = 'import-failed'
    err.code = 'scene-graph-unmapped'
    err.unmapped = hardNodes
    throw err
  }

  return { unmapped, warnings, mappedNodeIds: [...mappedIds] }
}

module.exports = {
  buildOoxmlSceneGraph,
  reconcileSceneGraph,
}
