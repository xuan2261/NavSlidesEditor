/**
 * Parse OOXML ppt/charts/chartN.xml into NavSlides chart payload (Phase 05).
 * Extracts cached categories/values from chart series (no xlsx embedding required when cache present).
 */

const path = require('node:path').posix
const { assertStrictChartSupport } = require('./chart-support-matrix')
const { mapChartType } = require('./chart-output-to-navslides-mapper')
const { nativeChartMetadata } = require('./chart-native-metadata')

const CHART_KIND_RE = /<(?:[a-z0-9]+:)?([a-z][a-z0-9]*Chart)\b/i

function textBetween(xml, openRe, closeTag) {
  const m = String(xml || '').match(openRe)
  if (!m) return ''
  const start = m.index + m[0].length
  const close = String(xml).indexOf(closeTag, start)
  if (close < 0) return String(xml).slice(start)
  return String(xml).slice(start, close)
}

function parsePtValues(fragment) {
  const pts = []
  for (const m of String(fragment || '').matchAll(/<(?:[a-z0-9]+:)?pt\b[^>]*idx=(["'])(\d+)\1[^>]*>\s*<(?:[a-z0-9]+:)?v>([\s\S]*?)<\/(?:[a-z0-9]+:)?v>/gi)) {
    pts.push({ idx: Number(m[2]), v: m[3].trim() })
  }
  pts.sort((a, b) => a.idx - b.idx)
  return pts.map((p) => p.v)
}

function parseSeriesBlocks(xml) {
  const blocks = []
  const re = /<(?:[a-z0-9]+:)?ser\b[^>]*>([\s\S]*?)<\/(?:[a-z0-9]+:)?ser>/gi
  let m
  while ((m = re.exec(String(xml || '')))) blocks.push(m[1])
  return blocks
}

function seriesName(serXml) {
  // Prefer cached str: <c:tx>...<c:v>Name</c:v>
  const tx = textBetween(serXml, /<(?:[a-z0-9]+:)?tx\b[^>]*>/i, '</c:tx>')
  const cached = parsePtValues(tx)
  if (cached[0]) return cached[0]
  const plain = serXml.match(/<(?:[a-z0-9]+:)?v>([^<]+)<\/(?:[a-z0-9]+:)?v>/i)
  return plain ? plain[1].trim() : null
}

function seriesColor(serXml) {
  const m = String(serXml || '').match(/<(?:[a-z0-9]+:)?srgbClr\b[^>]*val=(["'])([0-9A-Fa-f]{6})\1/i)
  return m ? `#${m[2]}` : null
}

function seriesCategories(serXml) {
  const cat = textBetween(serXml, /<(?:[a-z0-9]+:)?cat\b[^>]*>/i, '</c:cat>')
  if (!cat) return []
  // multiLvlStrCache or strCache
  return parsePtValues(cat)
}

function seriesValues(serXml) {
  const val = textBetween(serXml, /<(?:[a-z0-9]+:)?val\b[^>]*>/i, '</c:val>')
  if (!val) {
    // scatter yVal
    const yVal = textBetween(serXml, /<(?:[a-z0-9]+:)?yVal\b[^>]*>/i, '</c:yVal>')
    return parsePtValues(yVal).map((v) => Number(v)).map((n) => (Number.isFinite(n) ? n : 0))
  }
  return parsePtValues(val).map((v) => Number(v)).map((n) => (Number.isFinite(n) ? n : 0))
}

function chartSupportMetadata(row) {
  return {
    supportStatus: row.status,
    rowId: row.rowId,
    tier: row.tier,
    claimCeiling: row.claimCeiling,
    matrixHash: row.matrixHash,
    adapterId: row.adapterId,
    adapterQualified: row.adapterQualified,
    transactionEligible: row.transactionEligible,
    level4Promoted: row.level4Promoted,
    preservationTier: row.preservationTier,
  }
}

function detectOoxmlChartType(xml) {
  const plotArea = textBetween(
    String(xml || ''),
    /<(?:[a-z0-9]+:)?plotArea\b[^>]*>/i,
    '</c:plotArea>'
  )
  const kinds = [
    ...plotArea.matchAll(
      /<(?:[a-z0-9]+:)?([a-z][a-z0-9]*Chart)\b/gi
    ),
  ].map((match) => match[1].toLowerCase())
  if (new Set(kinds).size > 1) return 'comboChart'
  const m = String(xml || '').match(CHART_KIND_RE)
  return m ? m[1] : 'unknownChart'
}

/**
 * @param {string} chartXml
 * @returns {{ ooxmlType: string, navType: string, supportStatus: string, chartData: { labels: string[], datasets: object[] }, title: string|null } | null}
 */
function parseOoxmlChart(chartXml, options = {}) {
  if (!chartXml || typeof chartXml !== 'string') return null
  const ooxmlType = detectOoxmlChartType(chartXml)
  const row = assertStrictChartSupport(ooxmlType, options.strict === true, options.context)
  const native = nativeChartMetadata(
    chartXml,
    options.chartPath || options.context?.chartPath || '',
    options.relationshipsXml
  )
  const seriesBlocks = parseSeriesBlocks(chartXml)
  if (!seriesBlocks.length) {
    return {
      ooxmlType,
      navType: row.navType,
      displayType: mapChartType(ooxmlType),
      ...chartSupportMetadata(row),
      chartData: { labels: [], datasets: [] },
      title: null,
      empty: true,
      native,
    }
  }

  let labels = seriesCategories(seriesBlocks[0])
  const datasets = seriesBlocks.map((ser, i) => {
    const cats = seriesCategories(ser)
    if ((!labels || !labels.length) && cats.length) labels = cats
    const values = seriesValues(ser)
    // Align labels length
    if (values.length && labels.length < values.length) {
      labels = values.map((_, idx) => labels[idx] || String(idx + 1))
    }
    return {
      label: seriesName(ser) || `Series ${i + 1}`,
      data: values,
      color: seriesColor(ser) || undefined,
    }
  })

  const titleMatch = String(chartXml).match(/<(?:[a-z0-9]+:)?title\b[\s\S]*?<(?:[a-z0-9]+:)?t>([\s\S]*?)<\/(?:[a-z0-9]+:)?t>/i)
  const title = titleMatch ? titleMatch[1].trim() : null

  return {
    ooxmlType,
    navType: row.navType,
    displayType: mapChartType(ooxmlType),
    ...chartSupportMetadata(row),
    chartData: {
      labels: labels.length ? labels : datasets[0]?.data.map((_, i) => String(i + 1)) || [],
      datasets: datasets.map((d, i) => ({
        label: d.label,
        data: d.data,
        color: d.color || ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6'][i % 5],
      })),
    },
    title,
    empty: false,
    native,
  }
}

async function readZipText(zip, entry) {
  const file = zip?.file?.(entry)
  if (!file) return ''
  try {
    return await file.async('string')
  } catch {
    return ''
  }
}

function chartRelationshipsPath(chartPath) {
  const normalized = path.normalize(String(chartPath || '')).replace(/^\.\//, '')
  if (!/^ppt\/charts\/[^/]+\.xml$/i.test(normalized)) return null
  return `${path.dirname(normalized)}/_rels/${path.basename(normalized)}.rels`
}

/**
 * Inject native chart elements for scene-graph chart nodes missing a mapped chart.
 */
function scaleAxis(scale) {
  if (!scale || typeof scale !== 'object') return { x: 1, y: 1 }
  const x = Number(scale.x)
  const y = Number(scale.y)
  return {
    x: Number.isFinite(x) && x > 0 ? x : 1,
    y: Number.isFinite(y) && y > 0 ? y : 1,
  }
}

function applyScaleBox(node, scale) {
  const s = scaleAxis(scale)
  const x = Number(node?.xfrm?.x)
  const y = Number(node?.xfrm?.y)
  const w = Number(node?.xfrm?.cx)
  const h = Number(node?.xfrm?.cy)
  return {
    x: Number.isFinite(x) ? Math.round(x * s.x * 10) / 10 : 80,
    y: Number.isFinite(y) ? Math.round(y * s.y * 10) / 10 : 80,
    width: Number.isFinite(w) && w > 0 ? Math.max(1, Math.round(w * s.x * 10) / 10) : 400,
    height: Number.isFinite(h) && h > 0 ? Math.max(1, Math.round(h * s.y * 10) / 10) : 280,
  }
}

async function stampClaimedChartMetadata(element, node, zip, slideIndex, strict, warnings) {
  const chartPath = node.rels?.chartTarget
  if (!chartPath) return

  const xml = await readZipText(zip, chartPath)
  const relationshipsPath = chartRelationshipsPath(chartPath)
  const relationshipsXml = relationshipsPath ? await readZipText(zip, relationshipsPath) : ''
  const parsed = parseOoxmlChart(xml, {
    strict,
    context: { slideIndex, chartPath, nodeId: String(node.id) },
    relationshipsXml,
  })
  if (!parsed || parsed.empty) return

  const preserveOnly = parsed.preservationTier !== 'editable'
  element._pptxChartMeta = {
    ...(element._pptxChartMeta || {}),
    originalType: parsed.ooxmlType,
    source: 'ooxml-chart-parser',
    chartPath,
    supportStatus: parsed.supportStatus,
    rowId: parsed.rowId,
    tier: parsed.tier,
    claimCeiling: parsed.claimCeiling,
    matrixHash: parsed.matrixHash,
    adapterId: parsed.adapterId,
    adapterQualified: parsed.adapterQualified,
    transactionEligible: parsed.transactionEligible,
    level4Promoted: parsed.level4Promoted,
    preservationTier: parsed.preservationTier,
    native: parsed.native,
    title: parsed.title,
  }
  if (preserveOnly) {
    warnings.push({
      slideIndex,
      type: 'native-chart-preserved',
      message: `Chart ${chartPath} remains native preserve-only (${parsed.ooxmlType})`,
    })
  }
}

async function injectChartsFromSceneGraph({
  elements,
  graphSlide,
  zip,
  slideIndex = 0,
  stats = {},
  warnings = [],
  strict = false,
  scale = { x: 1, y: 1 },
}) {
  const list = Array.isArray(elements) ? [...elements] : []
  if (!zip || !graphSlide) return list

  const chartNodes = (graphSlide.nodes || []).filter(
    (n) => n.graphicKind === 'chart' || n.rels?.chartTarget || /chart/i.test(n.name || '')
  )
  if (!chartNodes.length) return list

  // Claim unstamped parser charts first (pptxtojson path has no nodeId/chartPath yet).
  const claimedCharts = new Set()
  const unstampedCharts = list.filter(
    (el) => el?.type === 'chart' && !el._pptxSource?.nodeId && !el._pptxChartMeta?.chartPath
  )
  let unstampedIdx = 0
  for (const node of chartNodes) {
    const byId = list.find(
      (el) => el?.type === 'chart' && el._pptxSource?.nodeId === String(node.id)
    )
    if (byId) {
      claimedCharts.add(byId)
      await stampClaimedChartMetadata(byId, node, zip, slideIndex, strict, warnings)
      continue
    }
    const byPath =
      node.rels?.chartTarget &&
      list.find(
        (el) => el?.type === 'chart' && el._pptxChartMeta?.chartPath === node.rels.chartTarget
      )
    if (byPath) {
      claimedCharts.add(byPath)
      byPath._pptxSource = {
        ...(byPath._pptxSource || {}),
        nodeId: String(node.id),
        kind: 'graphicFrame',
        graphicKind: 'chart',
        slideIndex,
        matchedBy: 'relationship',
        authoritative: true,
      }
      byPath._pptxChartMeta = {
        ...(byPath._pptxChartMeta || {}),
        chartPath: node.rels.chartTarget,
        source: byPath._pptxChartMeta?.source || 'parser',
      }
      await stampClaimedChartMetadata(byPath, node, zip, slideIndex, strict, warnings)
      continue
    }
    if (unstampedIdx < unstampedCharts.length) {
      const el = unstampedCharts[unstampedIdx++]
      claimedCharts.add(el)
      el._pptxSource = {
        ...(el._pptxSource || {}),
        nodeId: String(node.id),
        kind: 'graphicFrame',
        graphicKind: 'chart',
        slideIndex,
        name: node.name || null,
        matchedBy: 'order',
        authoritative: false,
      }
      if (node.rels?.chartTarget) {
        el._pptxChartMeta = {
          ...(el._pptxChartMeta || {}),
          chartPath: node.rels.chartTarget,
          source: el._pptxChartMeta?.source || 'parser-claimed',
        }
        await stampClaimedChartMetadata(el, node, zip, slideIndex, strict, warnings)
      }
    }
  }

  for (const node of chartNodes) {
    const already = list.some(
      (el) =>
        el?.type === 'chart' &&
        (el._pptxSource?.nodeId === String(node.id) ||
          (el._pptxChartMeta?.chartPath && el._pptxChartMeta.chartPath === node.rels?.chartTarget))
    )
    if (already) continue

    const chartPath = node.rels?.chartTarget
    if (!chartPath) {
      warnings.push({
        slideIndex,
        type: 'native-chart-degraded',
        message: `Chart node ${node.id} has no chart relationship target`,
      })
      continue
    }

    const xml = await readZipText(zip, chartPath)
    const relationshipsPath = chartRelationshipsPath(chartPath)
    const relationshipsXml = relationshipsPath ? await readZipText(zip, relationshipsPath) : ''
    const parsed = parseOoxmlChart(xml, {
      strict,
      context: { slideIndex, chartPath, nodeId: String(node.id) },
      relationshipsXml,
    })
    if (!parsed || parsed.empty) {
      warnings.push({
        slideIndex,
        type: 'native-chart-degraded',
        message: `Chart ${chartPath} produced no series data`,
      })
      continue
    }
    const preserveOnly = parsed.preservationTier !== 'editable'
    if (preserveOnly) {
      warnings.push({
        slideIndex,
        type: 'native-chart-preserved',
        message: `Chart ${chartPath} remains native preserve-only (${parsed.ooxmlType})`,
      })
    }

    const box = applyScaleBox(node, scale)
    list.push({
      id: `chart-ooxml-${node.id}-${slideIndex}`,
      type: 'chart',
      chartType: parsed.displayType,
      chartData: parsed.chartData,
      ...box,
      zIndex: list.length + 1,
      rotation: 0,
      opacity: 1,
      _pptxSource: {
        nodeId: String(node.id),
        kind: 'graphicFrame',
        graphicKind: 'chart',
        slideIndex,
        name: node.name || null,
        matchedBy: 'relationship',
        authoritative: true,
      },
      _pptxChartMeta: {
        originalType: parsed.ooxmlType,
        source: 'ooxml-chart-parser',
        chartPath,
        supportStatus: parsed.supportStatus,
        rowId: parsed.rowId,
        tier: parsed.tier,
        claimCeiling: parsed.claimCeiling,
        matrixHash: parsed.matrixHash,
        adapterId: parsed.adapterId,
        adapterQualified: parsed.adapterQualified,
        transactionEligible: parsed.transactionEligible,
        level4Promoted: parsed.level4Promoted,
        preservationTier: parsed.preservationTier,
        native: parsed.native,
        title: parsed.title,
      },
    })
    stats.chartCount = (stats.chartCount || 0) + 1
  }

  return list
}

module.exports = {
  parseOoxmlChart,
  detectOoxmlChartType,
  injectChartsFromSceneGraph,
  parseSeriesBlocks,
  seriesValues,
  seriesCategories,
}
