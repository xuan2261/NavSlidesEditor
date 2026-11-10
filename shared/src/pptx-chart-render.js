const { normalizeChartDocument } = require('./pptx-chart-document')
const { projectChartSvg, sourceVisuals } = require('./pptx-chart-svg')
const { NATIVE_FAMILIES } = require('./pptx-chart-native')
const TYPES = {
  barChart: 'bar',
  lineChart: 'line',
  areaChart: 'line',
  pieChart: 'pie',
  doughnutChart: 'doughnut',
  scatterChart: 'scatter',
  radarChart: 'radar',
}
function points(channel) {
  if (!channel?.cache) return null
  const values = Array(channel.cache.count).fill(null)
  for (const p of channel.cache.points) values[p.index] = p.value
  return values
}
function label(channel) {
  return channel?.kind === 'text' ? channel.value : channel?.cache?.points[0]?.value ?? ''
}
function projectChartRender(document, renderOptions) {
  const d = normalizeChartDocument(document), reasons = []
  const hierarchical = []
  function inspect(value) {
    if (!value || typeof value !== 'object') return
    if (value.kind === 'multiLvlStrRef') hierarchical.push(...(value.cache?.levels ?? []).map(level => level.source))
    if (typeof value.kind === 'string') return
    Object.values(value).forEach(inspect)
  }
  inspect(d.plots); inspect(d.axes); inspect(d.title)
  if (hierarchical.length) return { supported: false,
    reasons: ['Native hierarchical category layout is not implemented'], source: d.source,
    diagnostics: hierarchical.map(source => ({ code: 'chart-hierarchical-category-layout-unimplemented', source })) }
  if (sourceVisuals(d) || d.plots.some(p => NATIVE_FAMILIES.has(p.family))) return projectChartSvg(d, renderOptions)
  const unsupported = detail => reasons.push(detail)
  if (d.style !== undefined) unsupported(`Unresolved native chart style ${d.style}`)
  function options(value, allowed, context) {
    for (const name of Object.keys(value ?? {}))
      if (!allowed.includes(name)) unsupported(`Unimplemented ${context} option ${name}`)
  }
  options(d.options, ['dispBlanksAs'], 'chart')
  if (d.options.dispBlanksAs === 'zero') unsupported('Native zero blank handling is not implemented')
  options(d.legend, ['legendPos'], 'legend')
  const datasets = [], scales = {}
  let labels
  for (const plot of d.plots) {
    const type = TYPES[plot.family]
    if (!type) { unsupported(`Unsupported native chart family ${plot.family}`); continue }
    options(plot.options, ['barDir', 'grouping', 'scatterStyle', 'radarStyle',
      'holeSize', 'firstSliceAng'], plot.family)
    if (plot.options.grouping === 'percentStacked')
      unsupported('Native percentStacked normalization is not implemented')
    if (plot.dataLabels || plot.series.some(s => s.dataLabels))
      unsupported('Native data-label drawing is not implemented')
    if (plot.options.radarStyle === 'filled') unsupported('Native filled radar drawing is not implemented')
    for (const series of plot.series) {
      options(series.options, ['smooth'], 'series')
      options(series.marker, ['symbol', 'size'], 'marker')
      const xy = plot.family === 'scatterChart'
      const values = points(series.data[xy ? 'yVal' : 'val'])
      if (!values) { unsupported(`Missing cache for ${series.id}`); continue }
      const categories = points(series.data.cat)
      if (!categories && ['bar', 'line', 'radar'].includes(type))
        unsupported(`Missing category cache for ${series.id}`)
      if (categories) {
        if (labels && JSON.stringify(labels) !== JSON.stringify(categories))
          unsupported('Independent per-series category domains are not implemented')
        labels ??= categories
      }
      const x = points(series.data.xVal)
      if (xy && !x) { unsupported(`Missing X cache for ${series.id}`); continue }
      const dataset = {
        type, label: String(label(series.data.tx)), data: xy
            ? Array.from({ length: Math.max(x.length, values.length) }, (_, i) =>
              x[i] === null || x[i] === undefined || values[i] === null || values[i] === undefined
                ? null : { x: x[i], y: values[i] })
            : values,
      }
      if (type === 'line' || xy) {
        dataset.fill = plot.family === 'areaChart'
        dataset.showLine = !xy || ['line', 'lineMarker', 'smooth', 'smoothMarker'].includes(plot.options.scatterStyle)
        dataset.tension = series.options.smooth || ['smooth', 'smoothMarker'].includes(plot.options.scatterStyle) ? 0.4 : 0
        if (xy && ['none', 'line', 'smooth'].includes(plot.options.scatterStyle)) dataset.pointRadius = 0
      }
      if (series.marker?.symbol && !['circle', 'none', 'auto'].includes(series.marker.symbol))
        unsupported(`Unimplemented marker symbol ${series.marker.symbol}`)
      if (series.marker?.symbol === 'none') dataset.pointRadius = 0
      if (series.marker?.size !== undefined) dataset.pointRadius = series.marker.size * 2 / 3
      const axes = plot.axisIds.map(id => d.axes.find(a => a.id === id))
      const horizontal = plot.options.barDir === 'bar'
      if (type === 'bar') dataset.indexAxis = horizontal ? 'y' : 'x'
      for (const axis of axes) {
        if (!axis) continue
        options(axis.options, ['axPos', 'delete', 'majorUnit'], 'axis')
        options(axis.scaling, ['min', 'max', 'orientation', 'logBase'], 'axis scaling')
        const valueAxis = axis.kind === 'valAx'
        if (axis.kind === 'dateAx' || axis.kind === 'serAx')
          unsupported(`Unimplemented axis kind ${axis.kind}`)
        const direction = ['b', 't'].includes(axis.options.axPos) ? 'x'
          : ['l', 'r'].includes(axis.options.axPos) ? 'y'
            : valueAxis ? horizontal ? 'x' : 'y' : horizontal ? 'y' : 'x'
        const id = `axis${axis.id}`
        dataset[`${direction}AxisID`] = id
        scales[id] = {
          axis: direction, type: axis.scaling?.logBase ? 'logarithmic' : valueAxis ? 'linear' : 'category',
          display: axis.options.delete !== true,
          reverse: axis.scaling?.orientation === 'maxMin',
          stacked: plot.options.grouping === 'stacked',
          ...(axis.scaling?.min !== undefined ? { min: axis.scaling.min } : {}),
          ...(axis.scaling?.max !== undefined ? { max: axis.scaling.max } : {}),
          ...(axis.options.majorUnit !== undefined ? { ticks: { stepSize: axis.options.majorUnit } } : {}),
          ...(axis.title ? { title: { display: true, text: String(label(axis.title)) } } : {}),
        }
        if (axis.scaling?.logBase && axis.scaling.logBase !== 10)
          unsupported('Only base-10 logarithmic axes are implemented')
        if (axis.numberFormat) unsupported('Native axis number formatting is not implemented')
      }
      if (type === 'doughnut' && plot.options.holeSize !== undefined)
        dataset.cutout = `${plot.options.holeSize}%`
      if (plot.options.firstSliceAng !== undefined) dataset.rotation = plot.options.firstSliceAng
      datasets.push(dataset)
    }
  }
  const coordinateFamilies = new Set(d.plots.map(p =>
    ['pieChart', 'doughnutChart'].includes(p.family) ? 'radial'
      : p.family === 'radarChart' ? 'radar' : 'cartesian'))
  if (coordinateFamilies.size > 1) unsupported('Mixed coordinate-system combo drawing is not implemented')
  if (reasons.length) return { supported: false, reasons, source: d.source }
  return { supported: true, reasons, source: d.source, config: {
    type: datasets[0].type, data: { labels: labels ?? [], datasets },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      spanGaps: d.options.dispBlanksAs === 'span',
      plugins: {
        title: { display: Boolean(d.title), text: String(label(d.title)) },
        legend: { display: Boolean(d.legend),
          position: { b: 'bottom', t: 'top', l: 'left', r: 'right', tr: 'right' }[d.legend?.legendPos] ?? 'top' },
      }, scales },
  } }
}
module.exports = { projectChartRender }
