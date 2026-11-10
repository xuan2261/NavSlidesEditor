/**
 * chart-output-to-navslides-mapper.js — Phase 4
 * Maps pptxtojson chart output to NavSlides chart schema.
 */

const { supportRow } = require('./chart-support-matrix')

const DEFAULT_COLORS = [
  '#6366f1', '#ef4444', '#22c55e', '#f59e0b',
  '#3b82f6', '#ec4899', '#14b8a6', '#8b5cf6',
]

function mapChartType(pptxType = '') {
  const t = String(pptxType || '').toLowerCase()
  if (t.includes('line')) return 'line'
  if (t.includes('pie')) return 'pie'
  if (t.includes('doughnut')) return 'doughnut'
  if (t.includes('radar')) return 'radar'
  if (t.includes('polar')) return 'polarArea'
  if (t.includes('bubble')) return 'bubble'
  if (t.includes('stock')) return 'stock'
  if (t.includes('surface')) return 'surface'
  if (t.includes('area')) return 'line'
  if (t.includes('bar')) return 'bar'
  if (t.includes('stacked')) return 'bar'
  if (t.includes('scatter')) return 'line'
  return 'bar'
}

// Translate pptxtojson grouping/type intent into the behavioral fields the
// renderers actually read. grouping is emitted separately from chartType
// (c:grouping/@val), so a stacked bar arrives as type 'barChart' + 'stacked'.
function chartGroupingFlags(element) {
  const grouping = String(element.grouping || '').toLowerCase()
  const rawType = String(element.chartType || '').toLowerCase()
  const flags = {}
  if (grouping.includes('stacked') || rawType.includes('stacked')) flags.stacked = true
  if (rawType.includes('area')) flags.areaFill = true
  return flags
}

function mapCommonChart(element, xyData) {
  const colors = element.colors || []
  const firstSeries = element.data?.[0]
  const labels = xyData?.labels ?? firstSeries?.values?.map((v) => String(v.x ?? v.label ?? '')) ?? []

  const datasets = xyData?.datasets ?? (element.data || []).map((series, i) => ({
    label: String(series.key || `Series ${i + 1}`),
    data: series.values?.map((v) => (typeof v.y === 'number' ? v.y : 0)) || [],
    color: colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }))

  return {
    chartType: mapChartType(element.chartType),
    chartData: { labels, datasets },
    legend: element.legendPos || null,
    xAxisTitle: element.xAxis?.title || null,
    yAxisTitle: element.yAxis?.title || null,
    _pptxChartMeta: {
      originalType: element.chartType,
      barDir: element.barDir,
      holeSize: element.holeSize,
      marker: element.marker,
      grouping: element.grouping,
      is3D: element.is3D || null,
      combo: element.isCombo || element.combo || null,
      comboDetected: String(element.chartType || '').toLowerCase().includes('combo'),
    },
  }
}

function mapXYChart(element) {
  const colors = element.colors || []
  const data = element.data || []
  const bubble = String(element.chartType || '').toLowerCase().includes('bubble')
  // The pinned parser emits parallel caches for one XY series, but point
  // objects for multiple series. Never inspect Array.prototype.values as data.
  const parallel = Array.isArray(data[0]) && Array.isArray(data[1])
  const datasets = parallel ? [{
    label: 'Series 1',
    data: data[1],
    xValues: data[0],
    ...(bubble ? { bubbleSizes: data[2] } : {}),
    color: colors[0] || DEFAULT_COLORS[0],
  }] : data.map((series, i) => {
    const points = series.values
    if (!Array.isArray(points)) throw new TypeError('Invalid XY chart series values')
    let count = series.pointCount ?? points.length
    for (const [ordinal, point] of points.entries()) count = Math.max(count, (point.index ?? ordinal) + 1)
    const xValues = Array(count).fill(null), values = Array(count).fill(null)
    const sizes = bubble ? Array(count).fill(null) : null
    for (const [ordinal, point] of points.entries()) {
      const index = point.index ?? ordinal
      xValues[index] = point.x ?? null
      values[index] = point.y ?? null
      if (sizes) sizes[index] = point.bubbleSize ?? null
    }
    return {
      label: String(series.key || `Series ${i + 1}`),
      data: values,
      xValues,
      ...(sizes ? { bubbleSizes: sizes } : {}),
      color: colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }
  })
  return mapCommonChart(element, {
    labels: datasets[0]?.xValues.map(value => String(value ?? '')) ?? [],
    datasets,
  })
}

function mapChart(element) {
  if (!element || element.type !== 'chart') return null

  const type = String(element.chartType || '').toLowerCase()
  const isCombo = Boolean(element.isCombo || element.combo)
  const originalType = element._pptxChartMeta?.originalType || element.chartType
  const supportType = isCombo ? 'comboChart' : originalType
  const support = supportRow(supportType)
  const isXY = type.includes('scatter') || type.includes('bubble')

  let mapped
  if (isXY) mapped = mapXYChart(element)
  else mapped = mapCommonChart(element)

  return {
    ...element,
    type: 'chart',
    // Chart.js receives only its supported display types. Preserve the exact OOXML
    // family in native metadata rather than leaking it into the render contract.
    chartType: mapped.chartType,
    chartData: mapped.chartData,
    legend: mapped.legend,
    xAxisTitle: mapped.xAxisTitle,
    yAxisTitle: mapped.yAxisTitle,
    ...chartGroupingFlags(element),
    _pptxChartMeta: {
      ...element._pptxChartMeta,
      ...mapped._pptxChartMeta,
      originalType,
      ...(isCombo ? { comboFamily: 'comboChart' } : {}),
      supportStatus: support.status,
      rowId: support.rowId,
      tier: support.tier,
      claimCeiling: support.claimCeiling,
      matrixHash: support.matrixHash,
      adapterId: support.adapterId,
      adapterQualified: support.adapterQualified,
      transactionEligible: support.transactionEligible,
      level4Promoted: support.level4Promoted,
      preservationTier: support.preservationTier,
      source: element._pptxChartMeta?.source || 'pptxtojson',
    },
  }
}

module.exports = { mapChart, mapChartType }
