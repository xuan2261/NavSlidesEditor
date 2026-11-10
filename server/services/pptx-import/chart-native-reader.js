const { validateView3D } = require('../../../shared/src/pptx-chart-native-contract')
function nativeChartReader({ one, children, attributes, scalar, integer, option, visual, fail }) {
  function projection(node) {
    attributes(node)
    children(node, ['rotX', 'rotY', 'depthPercent', 'hPercent', 'rAngAx', 'perspective'])
    const result = {}
    for (const n of node.children) {
      const raw = scalar(n)
      if (n.local === 'rAngAx') {
        if (!['0', '1', 'false', 'true'].includes(raw)) fail('invalid right angle axes', n)
        result[n.local] = ['1', 'true'].includes(raw)
      } else {
        if (!/^-?\d+$/.test(raw)) fail('invalid projection integer', n)
        result[n.local] = Number(raw)
      }
    }
    try { validateView3D(result) } catch (error) { fail(error.message, node) }
    return result
  }
  function lines(node) {
    attributes(node); children(node, ['spPr'])
    return one(node, 'spPr') ? visual().paint(one(node, 'spPr')) : {}
  }
  function decorations(node, plot) {
    for (const key of ['hiLowLines', 'dropLines']) if (one(node, key)) plot[key] = lines(one(node, key))
    const bars = one(node, 'upDownBars')
    if (bars) {
      attributes(bars); children(bars, ['gapWidth', 'upBars', 'downBars'])
      plot.upDownBars = {}
      if (one(bars, 'gapWidth')) plot.upDownBars.gapWidth = option(one(bars, 'gapWidth'))
      for (const key of ['upBars', 'downBars']) if (one(bars, key)) plot.upDownBars[key] = lines(one(bars, key))
    }
    const bands = one(node, 'bandFmts')
    if (bands) {
      attributes(bands)
      if (bands.children.some(n => n.uri !== bands.uri || n.local !== 'bandFmt')) fail('invalid surface band formats', bands)
      plot.bandFormats = bands.children.map(n => {
        attributes(n); children(n, ['idx', 'spPr'])
        return { index: integer(scalar(one(n, 'idx', true)), n), paint: lines({ ...n, children: n.children.filter(c => c.local === 'spPr') }) }
      })
    }
  }
  return { projection, decorations }
}
module.exports = { nativeChartReader }
