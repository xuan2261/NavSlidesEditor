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
  if (t.includes('area')) return 'line'
  if (t.includes('bubble')) return 'bar'
  if (t.includes('bar')) return 'bar'
  if (t.includes('stacked')) return 'bar'
  if (t.includes('stock')) return 'line'
  if (t.includes('surface')) return 'bar'
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

function mapCommonChart(element) {
  const colors = element.colors || []
  const firstSeries = element.data?.[0]
  const labels = firstSeries?.values?.map((v) => String(v.x ?? v.label ?? '')) || []

  const datasets = (element.data || []).map((series, i) => ({
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

function mapScatterChart(element) {
  const colors = element.colors || []
  const data = element.data || []

  // Format A: pptxtojson native [x-values, y-values] parallel arrays
  if (Array.isArray(data) && data.length >= 2 && Array.isArray(data[0]) && Array.isArray(data[1])) {
    const xValues = data[0] || []
    const yValues = data[1] || []
    const labels = xValues.map((v) => String(v ?? ''))
    return {
      chartType: 'line',
      chartData: {
        labels,
        datasets: [{
          label: 'Series 1',
          data: yValues.map((v) => (typeof v === 'number' ? v : 0)),
          color: colors[0] || DEFAULT_COLORS[0],
        }],
      },
      _pptxChartMeta: { originalType: 'scatterChart' },
    }
  }

  // Format B: CommonChart format (key/values) — fallback for PPTX with scatter rendered as series
  if (Array.isArray(data) && data.length > 0) {
    const firstSeries = data[0]
    const labels = (firstSeries?.values || []).map((v) => String(v.x ?? v.label ?? ''))
    const datasets = data.map((series, i) => ({
      label: String(series.key || `Series ${i + 1}`),
      data: (series.values || []).map((v) => (typeof v.y === 'number' ? v.y : 0)),
      color: colors[i] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }))
    return {
      chartType: 'line',
      chartData: { labels, datasets },
      _pptxChartMeta: { originalType: 'scatterChart' },
    }
  }

  return { chartType: 'line', chartData: { labels: [], datasets: [] }, _pptxChartMeta: { originalType: 'scatterChart' } }
}

function mapChart(element) {
  if (!element || element.type !== 'chart') return null

  const type = String(element.chartType || '').toLowerCase()
  const isCombo = Boolean(element.isCombo || element.combo)
  const originalType = element._pptxChartMeta?.originalType || element.chartType
  const supportType = isCombo ? 'comboChart' : originalType
  const support = supportRow(supportType)
  // scatter → mapScatterChart (native [x,y] format); bubble → mapCommonChart
  const isScatter = type.includes('scatter')

  let mapped
  if (isScatter) mapped = mapScatterChart(element)
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
      preservationTier: support.status === 'preserve-only' ? 'preserve-only' : 'editable',
      source: element._pptxChartMeta?.source || 'pptxtojson',
    },
  }
}

module.exports = { mapChart, mapChartType }
