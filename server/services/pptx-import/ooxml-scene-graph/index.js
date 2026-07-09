const { parseSpTree } = require('./parse-sptree')
const { parseRelationshipTargets, rejectTraversalTarget } = require('./parse-rels')
const { inspectOoxmlCoverage } = require('../ooxml-inspection')

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
        for (const r of rels) {
          if (/charts\/chart/i.test(r.target)) {
            next.rels.chartTarget = rejectTraversalTarget(r.target)
            next.graphicKind = next.graphicKind || 'chart'
          }
          if (/diagrams\/data/i.test(r.target)) {
            next.rels.diagramTarget = rejectTraversalTarget(r.target)
            next.graphicKind = next.graphicKind || 'diagram'
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
 * @returns {{ unmapped: object[], warnings: object[] }}
 */
function reconcileSceneGraph(graph, presentation, options = {}) {
  const strict = options.strict === true || process.env.PPTX_SLA_STRICT === '1'
  const warnings = []
  const unmapped = []

  const mappedBySlide = (presentation?.slides || []).map((slide) => (slide.elements || []).length)
  for (const gSlide of graph?.slides || []) {
    const graphCount = (gSlide.nodes || []).filter((n) => n.kind !== 'grpSp').length
    const mappedCount = mappedBySlide[gSlide.index] || 0
    // Inventory check: mapped elements should cover graph leaf nodes (heuristic)
    if (mappedCount < graphCount) {
      const gap = graphCount - mappedCount
      const detail = {
        slideIndex: gSlide.index,
        graphCount,
        mappedCount,
        gap,
      }
      unmapped.push(detail)
      warnings.push({
        slideIndex: gSlide.index,
        type: 'scene-graph-unmapped',
        message: `Scene graph has ${graphCount} leaf nodes but only ${mappedCount} mapped elements (gap ${gap})`,
      })
    }
  }

  if (strict && unmapped.length) {
    const err = new Error(`PPTX_SLA_STRICT: ${unmapped.length} slide(s) have unmapped scene-graph nodes`)
    err.type = 'import-failed'
    err.code = 'scene-graph-unmapped'
    err.unmapped = unmapped
    throw err
  }

  return { unmapped, warnings }
}

module.exports = {
  buildOoxmlSceneGraph,
  reconcileSceneGraph,
}
