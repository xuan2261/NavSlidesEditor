const { validateChartVisual } = require('./pptx-chart-visual-contract')
const VIEW = { rotX: [-90, 90], rotY: [0, 360], depthPercent: [20, 2000], hPercent: [5, 500], perspective: [0, 240] }
function validateView3D(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid chart view3D')
  for (const [k, v] of Object.entries(value)) {
    if (k === 'rAngAx' ? typeof v !== 'boolean' : !VIEW[k] || !Number.isInteger(v) || v < VIEW[k][0] || v > VIEW[k][1])
      throw new TypeError(`Invalid chart view3D.${k}`)
  }
}
function validatePlotGeometry(plot) {
  for (const key of ['hiLowLines', 'dropLines']) if (key in plot) validateChartVisual(plot[key], 'paint')
  if ('upDownBars' in plot) {
    const b = plot.upDownBars
    if (!b || typeof b !== 'object' || Array.isArray(b) || Object.keys(b).some(k => !['gapWidth', 'upBars', 'downBars'].includes(k))) throw new TypeError('Invalid chart upDownBars')
    if ('gapWidth' in b && (!Number.isInteger(b.gapWidth) || b.gapWidth < 0 || b.gapWidth > 500)) throw new TypeError('Invalid chart candle gap')
    for (const k of ['upBars', 'downBars']) if (k in b) validateChartVisual(b[k], 'paint')
  }
  if ('bandFormats' in plot) {
    if (!Array.isArray(plot.bandFormats) || plot.bandFormats.length > 100000) throw new TypeError('Invalid chart band formats')
    const indices = new Set()
    for (const band of plot.bandFormats) {
      if (!band || Object.keys(band).some(k => !['index', 'paint'].includes(k)) || !Number.isSafeInteger(band.index) || band.index < 0 || indices.has(band.index)) throw new TypeError('Invalid chart band format')
      indices.add(band.index)
      validateChartVisual(band.paint, 'paint')
    }
  }
}
module.exports = { validateView3D, validatePlotGeometry }
