const { escape, unsupported, paint, text, format, dataLabel } = require('./pptx-chart-svg-primitives')
function cartesian(d, frame, runtime, model) {
  if (d.options.dispBlanksAs === 'zero') unsupported('dispBlanksAs', 'chart-zero-blank-unimplemented')
  if (d.plots.some(p => !['barChart', 'lineChart', 'scatterChart'].includes(p.family)))
    unsupported('plots', 'chart-native-family-unimplemented')
  if (d.plots.some(p => p.options.barDir === 'bar'))
    unsupported('barDir', 'chart-horizontal-axis-layout-unimplemented')
  const axisIds = [...new Set(d.plots.flatMap(p => p.axisIds))]
  if (axisIds.length !== 2) unsupported('axes', 'chart-axis-pair-required')
  const axes = axisIds.map(id => d.axes.find(a => a.id === id))
  const xAxis = axes.find(a => ['b', 't'].includes(a.options.axPos))
  const yAxis = axes.find(a => ['l', 'r'].includes(a.options.axPos))
  if (!xAxis || !yAxis || xAxis.kind === 'dateAx' || yAxis.kind !== 'valAx')
    unsupported('axes', 'chart-axis-kind-unimplemented')
  const sorted = d.plots.flatMap(plot => plot.series.map(series => ({ plot, series })))
    .sort((a, b) => a.series.order - b.series.order)
  const categories = sorted[0].series.data.cat?.cache
  const count = categories?.count ?? 0
  for (const { plot, series } of sorted) {
    const plotKeys = ['barDir', 'grouping', 'gapWidth', 'overlap', 'varyColors', 'scatterStyle']
    if (Object.keys(plot.options).some(k => !plotKeys.includes(k)) ||
      Object.entries(series.options).some(([k, v]) => !['smooth', 'invertIfNegative'].includes(k) || v))
      unsupported(`series.${series.id}`, 'chart-series-option-unimplemented')
    if (plot.options.grouping && !['standard', 'clustered'].includes(plot.options.grouping))
      unsupported('grouping', 'chart-stacking-unimplemented')
    if (plot.options.overlap && plot.options.overlap !== 0) unsupported('overlap', 'chart-overlap-unimplemented')
    if (plot.family !== 'scatterChart' && JSON.stringify(series.data.cat?.cache?.points.map(p => [p.index, p.value])) !==
      JSON.stringify(categories?.points.map(p => [p.index, p.value])))
      unsupported('categories', 'chart-independent-categories-unimplemented')
  }
  function numeric(axis) {
    const s = axis.scaling ?? {}, unit = axis.options.majorUnit
    if (s.logBase) unsupported(`axes.${axis.id}.logBase`, 'chart-log-axis-unimplemented')
    if (!Number.isFinite(s.min) || !Number.isFinite(s.max) || !(s.max > s.min) || !unit)
      unsupported(`axes.${axis.id}.scaling`, 'chart-auto-axis-bounds-unresolved')
    if (s.min < 0) unsupported(`axes.${axis.id}.scaling.min`, 'chart-zero-crossing-layout-unimplemented')
    const n = Math.floor((s.max - s.min) / unit)
    if (n > 1000) unsupported(`axes.${axis.id}`, 'chart-axis-tick-budget')
    return Array.from({ length: n + 1 }, (_, i) => ({ index: i, value: s.min + i * unit }))
  }
  const xticks = xAxis.kind === 'catAx' ? categories?.points : numeric(xAxis), yticks = numeric(yAxis)
  if (!xticks) unsupported('categories', 'chart-category-cache-unavailable')
  function labels(axis, ticks) {
    if (axis.options.delete || axis.options.tickLblPos === 'none') return []
    if (axis.kind === 'valAx' && axis.numberFormat?.sourceLinked)
      unsupported(`axes.${axis.id}.numberFormat`, 'chart-source-number-format-unresolved')
    return ticks.map(t => ({ ...t, label: text(d,
      axis.kind === 'catAx' ? String(t.value) : format(t.value, axis.numberFormat?.formatCode),
      axis.textStyle, `axes.${axis.id}.ticks.${t.index}`, runtime) }))
  }
  const xl = labels(xAxis, xticks), yl = labels(yAxis, yticks)
  const bottom = Math.max(0, ...xl.map(t => t.label.height))
  const left = Math.max(0, ...yl.map(t => t.label.width))
  const box = { x: frame.x + left, y: frame.y, width: frame.width - left, height: frame.height - bottom }
  if (!(box.width > 0 && box.height > 0)) unsupported('frame', 'chart-label-layout-overflow')
  function coordinate(axis, value, index) {
    let fraction = axis.kind === 'catAx' ? (index + 0.5) / count :
      (value - axis.scaling.min) / (axis.scaling.max - axis.scaling.min)
    if (axis.scaling?.orientation === 'maxMin') fraction = 1 - fraction
    return axis === xAxis ? box.x + fraction * box.width : box.y + (1 - fraction) * box.height
  }
  let svg = d.plotPaint ? `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" ${paint(d.plotPaint, 'plotPaint')}/>` : ''
  for (const axis of axes) {
    const known = ['delete', 'axPos', 'majorUnit', 'tickLblPos', 'minorTickMark', 'majorTickMark',
      'crosses', 'crossBetween', 'auto', 'lblAlgn', 'noMultiLvlLbl']
    if (Object.keys(axis.options).some(k => !known.includes(k)) ||
      (axis.options.crossBetween && axis.options.crossBetween !== 'between') ||
      (axis.options.lblAlgn && axis.options.lblAlgn !== 'ctr') ||
      (axis.options.tickLblPos && !['low', 'nextTo', 'none'].includes(axis.options.tickLblPos)))
      unsupported(`axes.${axis.id}`, 'chart-axis-option-unimplemented')
    if (axis.title || axis.minorGridlines || axis.options.minorUnit ||
      (axis.options.crosses && axis.options.crosses !== 'autoZero') || axis.options.crossesAt !== undefined ||
      (axis.options.minorTickMark && axis.options.minorTickMark !== 'none') ||
      (axis.options.majorTickMark && axis.options.majorTickMark !== 'none'))
      unsupported(`axes.${axis.id}`, 'chart-axis-decoration-unimplemented')
    if (axis.options.delete) continue
    if (axis.options.axPos !== (axis === xAxis ? 'b' : 'l'))
      unsupported(`axes.${axis.id}.axPos`, 'chart-axis-position-unimplemented')
    const ticks = axis === xAxis ? xticks : yticks
    if (axis.majorGridlines) for (const t of ticks) {
      const position = coordinate(axis, t.value, t.index)
      const path = axis === xAxis ? `M ${position} ${box.y} v ${box.height}` : `M ${box.x} ${position} h ${box.width}`
      svg += `<path d="${path}" ${paint(axis.majorGridlines, `axes.${axis.id}.majorGridlines`, false)}/>`
    }
    const path = axis === xAxis ? `M ${box.x} ${box.y + box.height} h ${box.width}` : `M ${box.x} ${box.y} v ${box.height}`
    svg += `<path data-chart-axis="${axis.id}" d="${path}" ${paint(axis.paint, `axes.${axis.id}.paint`, false)}/>`
  }
  for (const t of xl) svg += t.label.at(coordinate(xAxis, t.value, t.index), box.y + box.height, 'middle')
  for (const t of yl) svg += t.label.at(box.x, coordinate(yAxis, t.value, t.index) - t.label.height / 2, 'end')
  const bars = sorted.filter(s => s.plot.family === 'barChart')
  // A nested viewport clips this occurrence without document-global IDs shared
  // by repeated instances of the same source chart.
  svg += `<svg x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" viewBox="${box.x} ${box.y} ${box.width} ${box.height}" overflow="hidden">`
  for (const entry of sorted) {
    const { plot, series } = entry, xy = plot.family === 'scatterChart'
    if (xy && !['marker', 'line', 'lineMarker'].includes(plot.options.scatterStyle))
      unsupported('scatterStyle', 'chart-scatter-subtype-unimplemented')
    const channel = series.data[xy ? 'yVal' : 'val']
    if (!channel?.cache || (xy && !series.data.xVal?.cache)) unsupported(`series.${series.id}`, 'chart-data-cache-unavailable')
    if (xAxis.kind !== (xy ? 'valAx' : 'catAx') || (!xy && (!count || channel.cache.count > count)))
      unsupported(`series.${series.id}.axes`, 'chart-data-axis-domain-unimplemented')
    const record = { seriesId: series.id, points: [] }, paths = []
    let lastIndex
    for (const point of [...channel.cache.points].sort((a, b) => a.index - b.index)) {
      const xv = xy ? series.data.xVal.cache.points.find(p => p.index === point.index)?.value : point.index
      if (xv === undefined) continue
      const x = coordinate(xAxis, xv, point.index), y = coordinate(yAxis, point.value, point.index)
      let labelX = x, labelY = y
      const override = series.pointStyles?.find(s => s.index === point.index)
      if (Object.values(override?.options ?? {}).some(v => v !== false && v !== 0)) unsupported('pointStyles', 'chart-point-option-unimplemented')
      const style = { ...series.paint, ...override?.paint }
      const identity = `data-chart-series="${escape(series.id)}" data-chart-point="${point.index}"`
      if (plot.family === 'barChart') {
        const width = box.width / count / (bars.length + (plot.options.gapWidth ?? 150) / 100)
        const bx = x - width * bars.length / 2 + bars.indexOf(entry) * width
        const zero = coordinate(yAxis, Math.max(yAxis.scaling.min, Math.min(yAxis.scaling.max, 0)), point.index)
        labelX = bx + width / 2; labelY = (y + zero) / 2
        svg += `<rect ${identity} x="${bx}" y="${Math.min(y, zero)}" width="${width}" height="${Math.abs(y - zero)}" ${paint(style, `series.${series.id}.paint`)}/>`
      } else {
        if (lastIndex !== undefined && point.index !== lastIndex + 1 && d.options.dispBlanksAs !== 'span') paths.push(null)
        paths.push([x, y]); lastIndex = point.index
        const symbol = series.marker?.symbol
        if (xy && ['marker', 'lineMarker'].includes(plot.options.scatterStyle) && !symbol)
          unsupported('marker', 'chart-marker-default-unresolved')
        if (symbol && symbol !== 'none') {
          if (symbol !== 'circle' || !series.marker.size) unsupported('marker', 'chart-marker-unimplemented')
          svg += `<circle ${identity} cx="${x}" cy="${y}" r="${series.marker.size * 2 / 3}" ${paint(series.markerPaint, 'markerPaint')}/>`
        }
      }
      const label = dataLabel(d, plot, series, point, null, runtime)
      if (label) svg += label.at(labelX, labelY - label.height / 2, 'middle')
      record.points.push({ index: point.index, value: point.value, x, y })
    }
    if (paths.length && (!xy || plot.options.scatterStyle !== 'marker')) {
      let move = true
      const path = paths.map(p => { if (!p) { move = true; return '' } const cmd = move ? 'M' : 'L'; move = false; return `${cmd} ${p}` }).join(' ')
      svg += `<path data-chart-series="${escape(series.id)}" d="${path}" ${paint(series.paint, `series.${series.id}.paint`, false)}/>`
    }
    model.series.push(record)
  }
  return svg + '</svg>'
}
module.exports = { cartesian }
