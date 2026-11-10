const { unsupported } = require('./pptx-chart-svg-primitives')
const { stock, bubbles } = require('./pptx-chart-native-financial')
const { mesh } = require('./pptx-chart-native-mesh')
const { pie3D } = require('./pptx-chart-native-pie')
const NATIVE_FAMILIES = new Set(['stockChart', 'bubbleChart', 'surfaceChart', 'surface3DChart', 'bar3DChart', 'line3DChart', 'area3DChart', 'pie3DChart'])
function nativeFamily(d, frame, runtime, model) {
  if (d.plots.length !== 1) unsupported('plots', 'chart-native-mixed-projection-unimplemented')
  const plot = d.plots[0]
  const keys = {
    stockChart: [], bubbleChart: ['bubbleScale', 'sizeRepresents', 'showNegBubbles', 'varyColors'],
    surfaceChart: ['wireframe'], surface3DChart: ['wireframe'],
    bar3DChart: ['barDir', 'grouping', 'gapWidth', 'gapDepth', 'shape', 'overlap', 'varyColors'],
    line3DChart: ['grouping', 'gapDepth', 'varyColors', 'marker', 'smooth'],
    area3DChart: ['grouping', 'gapDepth', 'varyColors'], pie3DChart: ['firstSliceAng', 'varyColors'],
  }[plot.family]
  for (const k of Object.keys(plot.options)) if (!keys.includes(k)) unsupported(`plot.${k}`, 'chart-option-unimplemented')
  if (plot.family !== 'stockChart' && (plot.hiLowLines || plot.upDownBars)) unsupported('plot.stockDecorations', 'chart-stock-decoration-family-invalid')
  if (!plot.family.startsWith('surface') && plot.bandFormats) unsupported('plot.bandFormats', 'chart-band-format-family-invalid')
  if (d.view3D && ['stockChart','bubbleChart'].includes(plot.family)) unsupported('view3D', 'chart-projection-family-invalid')
  for (const series of plot.series) {
    if (plot.options.varyColors && series.data.val?.cache?.points.some(p => !series.pointStyles?.find(s => s.index === p.index)?.paint?.fill)) unsupported(`series.${series.id}`, 'chart-source-point-paint-unresolved')
    if (plot.options.marker && !series.marker) unsupported(`series.${series.id}.marker`, 'chart-marker-default-unresolved')
    for (const [key, value] of Object.entries(series.options)) {
      if (key === 'smooth' && !value || key === 'invertIfNegative' && !value) continue
      if (key === 'smooth' && plot.family === 'line3DChart' || key === 'shape' && plot.family === 'bar3DChart' || key === 'explosion' && plot.family === 'pie3DChart') continue
      unsupported(`series.${series.id}.${key}`, 'chart-series-option-unimplemented')
    }
    for (const point of series.pointStyles ?? []) for (const [key, value] of Object.entries(point.options)) {
      if (key === 'explosion' && plot.family === 'pie3DChart' || value === false || value === 0) continue
      unsupported(`series.${series.id}.point.${point.index}.${key}`, 'chart-point-option-unimplemented')
    }
  }
  if (plot.family === 'stockChart') return stock(d, plot, frame, runtime, model)
  if (plot.family === 'bubbleChart') return bubbles(d, plot, frame, runtime, model)
  if (plot.family === 'pie3DChart') return pie3D(d, plot, frame, runtime, model)
  return mesh(d, plot, frame, runtime, model)
}
module.exports = { NATIVE_FAMILIES, nativeFamily }
