const { normalizeChartDocument, validateChartOption } = require('./pptx-chart-document')
const { validateChartVisual } = require('./pptx-chart-visual-contract')
const { validateView3D } = require('./pptx-chart-native-contract')
const fail = (detail) => { throw new TypeError(`Invalid chart edit: ${detail}`) }
const own = (o, k) => Object.hasOwn(o, k)
const SHAPES = {
  'chart.data.set-point': ['seriesId', 'channel', 'index', 'value'],
  'chart.data.convert-local': ['seriesId', 'channel', 'basis'],
  'chart.series.rename': ['seriesId', 'value'],
  'chart.title.set': ['value'],
  'chart.title.convert-local': ['basis'],
  'chart.axis.title.set': ['axisId', 'value'],
  'chart.axis.title.convert-local': ['axisId', 'basis'],
  'chart.marker.set': ['seriesId', 'values'],
  'chart.point.paint.set': ['seriesId', 'index', 'value'],
  'chart.view3D.set': ['values'],
  'chart.style.set': ['value'],
  'chart.paint.set': ['target', 'seriesId', 'axisId', 'value'],
  'chart.options.set': ['target', 'plotIndex', 'seriesId', 'axisId', 'values'],
}
const TARGET_OPTIONS = {
  chart: ['dispBlanksAs', 'plotVisOnly', 'showDLblsOverMax', 'autoTitleDeleted', 'roundedCorners'],
  plot: ['barDir', 'grouping', 'scatterStyle', 'radarStyle', 'varyColors', 'gapWidth',
    'overlap', 'holeSize', 'firstSliceAng', 'bubbleScale', 'showNegBubbles', 'sizeRepresents',
    'gapDepth', 'shape', 'wireframe', 'ofPieType', 'splitType', 'splitPos', 'secondPieSize',
    'smooth', 'marker'],
  series: ['smooth', 'explosion', 'bubble3D', 'shape', 'invertIfNegative'],
  axis: ['min', 'max', 'logBase', 'orientation', 'axPos', 'delete', 'majorUnit', 'minorUnit',
    'crosses', 'crossesAt', 'crossBetween', 'tickLblPos', 'majorTickMark', 'minorTickMark'],
  legend: ['legendPos', 'overlay'],
  labels: ['showVal', 'showCatName', 'showSerName', 'showPercent', 'showBubbleSize',
    'showLegendKey', 'showLeaderLines', 'dLblPos', 'separator'],
}
// These are source-family properties, not Chart.js approximations. The same
// ownership table drives inspector controls and rejects cross-family commands.
const PLOT_OPTIONS = {
  barChart: ['barDir', 'grouping', 'varyColors', 'gapWidth', 'overlap'],
  bar3DChart: ['barDir', 'grouping', 'varyColors', 'gapWidth', 'gapDepth', 'shape', 'overlap'],
  lineChart: ['grouping', 'varyColors', 'marker', 'smooth'],
  line3DChart: ['grouping', 'varyColors', 'gapDepth', 'marker', 'smooth'],
  areaChart: ['grouping', 'varyColors'],
  area3DChart: ['grouping', 'varyColors', 'gapDepth'],
  pieChart: ['varyColors', 'firstSliceAng'],
  pie3DChart: ['varyColors', 'firstSliceAng'],
  doughnutChart: ['varyColors', 'firstSliceAng', 'holeSize'],
  ofPieChart: ['ofPieType', 'varyColors', 'gapWidth', 'splitType', 'splitPos', 'secondPieSize'],
  scatterChart: ['scatterStyle', 'varyColors'],
  bubbleChart: ['varyColors', 'bubbleScale', 'showNegBubbles', 'sizeRepresents'],
  radarChart: ['radarStyle', 'varyColors'],
  stockChart: [],
  surfaceChart: ['wireframe'],
  surface3DChart: ['wireframe'],
}
function seriesPlot(d, id) {
  const plot = d.plots.find(p => p.series.some(s => s.id === id))
  if (!plot) fail('series identity')
  return plot
}
function axisFor(d, id) {
  const axis = d.axes.find(a => a.id === id)
  if (!axis) fail('axis identity')
  return axis
}
function convertLocal(channel, basis) {
  if (basis !== 'cache-snapshot' || !['numRef', 'strRef'].includes(channel?.kind) || !channel.cache)
    fail('conversion requires an available numeric or string reference cache snapshot; hierarchical categories remain source-bound')
  channel.detachedFrom = { kind: channel.kind, formula: channel.formula, basis }
  channel.kind = channel.kind.replace('Ref', 'Lit')
  delete channel.formula
}
function seriesOptionAllowed(family, name) {
  return ({ smooth: ['lineChart', 'line3DChart', 'scatterChart'],
    explosion: ['pieChart', 'pie3DChart', 'doughnutChart', 'ofPieChart'],
    bubble3D: ['bubbleChart'], shape: ['bar3DChart'],
    invertIfNegative: ['barChart', 'bar3DChart', 'bubbleChart'] }[name] ?? []).includes(family)
}
function text(value) {
  if (typeof value !== 'string' || value.length > 1048576) fail('text')
  return value
}
function seriesFor(d, id) {
  const series = d.plots.flatMap(p => p.series).find(s => s.id === id)
  if (!series) fail('series identity')
  return series
}
function dataFor(d, op) {
  if (!['tx', 'cat', 'val', 'xVal', 'yVal', 'bubbleSize'].includes(op.channel)) fail('channel')
  const channel = seriesFor(d, op.seriesId).data[op.channel]
  if (!channel) fail('missing channel')
  return channel
}
function literal(channel) {
  if (channel.kind.endsWith('Ref')) fail('reference requires explicit project-local conversion')
}
function rename(channel, value) {
  text(value)
  if (!channel) return { kind: 'text', value }
  literal(channel)
  if (channel.kind === 'text') channel.value = value
  else if (channel.kind === 'strLit' && channel.cache.count === 1 &&
    channel.cache.points.length === 1) channel.cache.points[0].value = value
  else fail('rename requires a single text value')
  return channel
}
function setOptions(d, op) {
  if (!own(TARGET_OPTIONS, op.target) || !op.values || typeof op.values !== 'object' ||
    Array.isArray(op.values) || !Object.keys(op.values).length) fail('options target/values')
  const selector = { plot: 'plotIndex', series: 'seriesId', axis: 'axisId', labels: 'seriesId' }[op.target]
  for (const key of ['plotIndex', 'seriesId', 'axisId'])
    if (own(op, key) !== (key === selector)) fail('option selector')
  for (const [name, value] of Object.entries(op.values)) {
    if (!TARGET_OPTIONS[op.target].includes(name)) fail(`option ${name}`)
    validateChartOption(name, value)
  }
  let target
  if (op.target === 'chart') target = d.options
  if (op.target === 'legend') target = d.legend ??= {}
  if (op.target === 'plot') {
    if (!Number.isSafeInteger(op.plotIndex) || !d.plots[op.plotIndex]) fail('plot index')
    const plot = d.plots[op.plotIndex]
    for (const name of Object.keys(op.values))
      if (!PLOT_OPTIONS[plot.family].includes(name) ||
          name === 'grouping' && op.values[name] === 'clustered' && !plot.family.startsWith('bar'))
        fail(`unsupported ${plot.family} option ${name}`)
    if (own(op.values, 'splitType') && op.values.splitType === 'cust')
      fail('custom pie splitting requires unsupported source point membership edits')
    target = plot.options
  }
  if (op.target === 'series') {
    const plot = seriesPlot(d, op.seriesId)
    for (const name of Object.keys(op.values))
      if (!seriesOptionAllowed(plot.family, name)) fail(`unsupported ${plot.family} series option ${name}`)
    target = seriesFor(d, op.seriesId).options
  }
  if (op.target === 'labels') {
    const series = seriesFor(d, op.seriesId)
    target = (series.dataLabels ??= { options: {}, labels: [] }).options
  }
  if (op.target === 'axis') {
    const axis = axisFor(d, op.axisId)
    for (const name of Object.keys(op.values)) {
      if (['min', 'max', 'majorUnit', 'minorUnit'].includes(name) && !['valAx', 'dateAx'].includes(axis.kind) ||
          name === 'logBase' && axis.kind !== 'valAx' ||
          name === 'crossBetween' && axis.kind !== 'valAx') fail(`unsupported ${axis.kind} option ${name}`)
    }
    for (const [name, value] of Object.entries(op.values)) {
      const field = ['min', 'max', 'logBase', 'orientation'].includes(name) ? 'scaling' : 'options'
      ;(axis[field] ??= {})[name] = value
    }
    return
  }
  Object.assign(target, op.values)
}
function applyChartOperation(document, operation) {
  const d = normalizeChartDocument(document)
  if (!operation || typeof operation !== 'object' || Array.isArray(operation) ||
    Object.getPrototypeOf(operation) !== Object.prototype || !own(operation, 'type') ||
    !own(SHAPES, operation.type)) fail('command')
  const op = operation, keys = SHAPES[op.type]
  if (Object.keys(op).some(k => k !== 'type' && !keys.includes(k)) ||
    keys.filter(k => !['plotIndex', 'seriesId', 'axisId'].includes(k) ||
      !['chart.options.set', 'chart.paint.set'].includes(op.type)).some(k => !own(op, k))) fail('command fields')
  if (op.type === 'chart.data.convert-local') {
    convertLocal(dataFor(d, op), op.basis)
  } else if (op.type === 'chart.title.convert-local') {
    convertLocal(d.title, op.basis)
  } else if (op.type === 'chart.axis.title.convert-local') {
    convertLocal(axisFor(d, op.axisId).title, op.basis)
  } else if (op.type === 'chart.axis.title.set') {
    const axis = axisFor(d, op.axisId)
    axis.title = rename(axis.title, op.value)
  } else if (op.type === 'chart.marker.set') {
    const plot = seriesPlot(d, op.seriesId)
    if (!['lineChart', 'line3DChart', 'scatterChart', 'radarChart'].includes(plot.family))
      fail('unsupported family marker')
    if (!op.values || typeof op.values !== 'object' || Array.isArray(op.values) ||
        !Object.keys(op.values).length) fail('marker values')
    for (const [name, value] of Object.entries(op.values)) {
      if (!['symbol', 'size'].includes(name)) fail('marker option')
      if (name === 'symbol' && value === 'picture') fail('picture marker requires an unsupported image component')
      validateChartOption(name, value)
    }
    Object.assign(seriesFor(d, op.seriesId).marker ??= {}, op.values)
  } else if (op.type === 'chart.point.paint.set') {
    const series = seriesFor(d, op.seriesId)
    const channel = series.data.val ?? series.data.yVal
    if (!Number.isSafeInteger(op.index) || !channel?.cache?.points.some(p => p.index === op.index))
      fail('existing point identity')
    validateChartVisual(op.value, 'paint')
    const styles = series.pointStyles ??= []
    let point = styles.find(p => p.index === op.index)
    if (!point) { point = { index: op.index, options: {} }; styles.push(point) }
    point.paint = op.value
  } else if (op.type === 'chart.view3D.set') {
    if (!d.plots.every(p => ['bar3DChart', 'line3DChart', 'area3DChart', 'pie3DChart', 'surface3DChart'].includes(p.family)))
      fail('unsupported family 3D view')
    if (!op.values || typeof op.values !== 'object' || Array.isArray(op.values) ||
        !Object.keys(op.values).length) fail('view3D values')
    validateView3D({ ...d.view3D, ...op.values })
    Object.assign(d.view3D ??= {}, op.values)
  } else if (op.type === 'chart.data.set-point') {
    const channel = dataFor(d, op)
    literal(channel)
    const point = channel.cache?.points.find(p => p.index === op.index)
    if (!Number.isSafeInteger(op.index) || !point) fail('existing point identity')
    if (channel.kind === 'numLit') {
      if (typeof op.value !== 'number' || !Number.isFinite(op.value)) fail('finite numeric point')
      point.value = op.value
      point.lexicalValue = String(op.value)
    } else if (channel.kind === 'strLit') point.value = text(op.value)
    else fail('literal cache channel')
  } else if (op.type === 'chart.series.rename') {
    const series = seriesFor(d, op.seriesId)
    series.data.tx = rename(series.data.tx, op.value)
  } else if (op.type === 'chart.title.set') {
    d.title = rename(d.title, op.value)
  } else if (op.type === 'chart.style.set') {
    if (!Number.isInteger(op.value) || op.value < 1 || op.value > 48) fail('style')
    d.style = op.value
  } else if (op.type === 'chart.paint.set') {
    validateChartVisual(op.value, 'paint')
    const selector = { series: 'seriesId', axis: 'axisId', chart: null, plot: null }
    if (!own(selector, op.target)) fail('paint target')
    for (const k of ['seriesId', 'axisId'])
      if (own(op, k) !== (selector[op.target] === k)) fail('paint selector')
    if (op.target === 'series') seriesFor(d, op.seriesId).paint = op.value
    else if (op.target === 'axis') {
      const axis = d.axes.find(a => a.id === op.axisId)
      if (!axis) fail('axis identity')
      axis.paint = op.value
    } else d[op.target === 'chart' ? 'paint' : 'plotPaint'] = op.value
  } else setOptions(d, op)
  return normalizeChartDocument(d)
}
module.exports = { applyChartOperation, PLOT_OPTIONS, seriesOptionAllowed }
