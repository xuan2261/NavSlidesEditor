const { escape, unsupported, paint, text, format, channelText } = require('./pptx-chart-svg-primitives')
const values = channel => new Map((channel?.cache?.points ?? []).map(p => [p.index, p.value]))
function nativeLayout(d, plot, frame, runtime, transform = (x, y) => [x, y], depth = frame.width / 4) {
  const axes = plot.axisIds.map(id => d.axes.find(a => a.id === id))
  const horizontal = plot.options.barDir === 'bar'
  const category = axes.find(a => ['catAx', 'dateAx'].includes(a.kind))
  const numeric = axes.filter(a => a.kind === 'valAx')
  const xAxis = axes.find(a => ['b', 't'].includes(a.options.axPos)) ?? category ?? numeric[0]
  const yAxis = axes.find(a => ['l', 'r'].includes(a.options.axPos)) ?? numeric.find(a => a !== xAxis)
  if (!xAxis || !yAxis) unsupported('axes', 'chart-axis-pair-required')
  const cats = plot.series[0].data.cat?.cache
  if (category && !cats) unsupported('categories', 'chart-category-cache-unavailable')
  const count = cats?.count ?? Math.max(...plot.series.map(s => s.data.yVal?.cache?.count ?? s.data.val?.cache?.count ?? 0))
  for (const s of plot.series) {
    if (!(s.data.val ?? s.data.yVal)?.cache) unsupported(`series.${s.id}`, 'chart-data-cache-unavailable')
    if (category && JSON.stringify(s.data.cat?.cache) !== JSON.stringify(cats)) {
      if (JSON.stringify(s.data.cat?.cache?.points.map(p => [p.index, p.value])) !== JSON.stringify(cats?.points.map(p => [p.index, p.value]))) unsupported('categories', 'chart-independent-categories-unimplemented')
    }
  }
  const domains = new Map(), ticks = new Map()
  for (const axis of axes) {
    if (!['valAx','dateAx'].includes(axis.kind)) { ticks.set(axis, axis.kind === 'serAx' ? plot.series.map((s, index) => ({ index, value: channelText(s.data.tx) })) : cats?.points ?? []); continue }
    const isX = axis === xAxis && !category
    const vals = axis.kind === 'dateAx' ? [...values(plot.series[0].data.cat).values()] : plot.series.flatMap(s => [...values(s.data[isX ? 'xVal' : (s.data.val ? 'val' : 'yVal')]).values()])
    if (axis === (horizontal ? xAxis : yAxis) && ['stacked','percentStacked'].includes(plot.options.grouping)) {
      const sums = new Map()
      for (const series of plot.series) for (const [index,value] of values(series.data.val)) { const key=`${index}:${value<0}`; sums.set(key,(sums.get(key)??0)+value) }
      vals.splice(0,vals.length,...(plot.options.grouping === 'percentStacked' ? [...sums.values()].map(v=>Math.sign(v)) : sums.values()))
    }
    const log = axis.scaling?.logBase
    if (log && vals.some(v => v <= 0)) unsupported(`axes.${axis.id}`, 'chart-log-domain-invalid')
    const min = axis.scaling?.min ?? (log || axis.kind === 'dateAx' ? Math.min(...vals) : Math.min(0, ...vals))
    let max = axis.scaling?.max ?? Math.max(...vals)
    if (max === min) max = min + (Math.abs(min) || 1)
    if (!Number.isFinite(min + max) || max <= min || (log && min <= 0)) unsupported(`axes.${axis.id}`, 'chart-axis-domain-invalid')
    domains.set(axis, { min, max, log })
    const unit = axis.options.majorUnit ?? (max - min) / 5
    const n = Math.floor((max - min) / unit)
    if (n > 1000) unsupported(`axes.${axis.id}`, 'chart-axis-tick-budget')
    ticks.set(axis, Array.from({ length: n + 1 }, (_, index) => ({ index, value: min + index * unit })))
  }
  const labels = new Map()
  for (const axis of axes) {
    const channel = axis.kind === 'dateAx' ? plot.series[0].data.cat : plot.series[0].data.val ?? plot.series[0].data.yVal
    const code = axis.numberFormat?.sourceLinked ? channel?.cache?.formatCode : axis.numberFormat?.formatCode
    if (!axis.options.delete && axis.options.tickLblPos !== 'none' && axis.numberFormat?.sourceLinked && !code) unsupported(`axes.${axis.id}.numberFormat`, 'chart-source-number-format-unresolved')
    labels.set(axis, axis.options.delete || axis.options.tickLblPos === 'none' ? [] : ticks.get(axis).map(t => ({ ...t, label: text(d, ['valAx','dateAx'].includes(axis.kind) ? format(t.value, code) : String(t.value), axis.textStyle, `axes.${axis.id}.ticks.${t.index}`, runtime) })))
  }
  const labelWidth = Math.max(0, ...labels.get(yAxis).map(t => t.label.width))
  const labelHeight = Math.max(0, ...labels.get(xAxis).map(t => t.label.height))
  const right = yAxis.options.axPos === 'r', top = xAxis.options.axPos === 't'
  const left = right ? 0 : labelWidth, bottom = top ? 0 : labelHeight
  const box = { x: frame.x + left, y: frame.y + (top ? labelHeight : 0), width: frame.width - labelWidth, height: frame.height - labelHeight }
  if (box.width <= 0 || box.height <= 0) unsupported('frame', 'chart-label-layout-overflow')
  const dateValues = values(plot.series[0].data.cat)
  function fraction(axis, value, index, tick) {
    const domain = domains.get(axis)
    if (axis.kind === 'dateAx' && !tick) value = dateValues.get(index) ?? value
    let f = domain ? domain.log ? Math.log(value / domain.min) / Math.log(domain.max / domain.min) : (value - domain.min) / (domain.max - domain.min) : (index + 0.5) / (axis.kind === 'serAx' ? plot.series.length : count)
    if (axis.scaling?.orientation === 'maxMin') f = 1 - f
    return f
  }
  const x = (value, index, tick = false) => box.x + fraction(xAxis, value, index, tick) * box.width
  const y = (value, index, tick = false) => box.y + (1 - fraction(yAxis, value, index, tick)) * box.height
  const valueAxis = horizontal ? xAxis : yAxis
  const zero = Math.max(domains.get(valueAxis)?.min ?? 0, Math.min(domains.get(valueAxis)?.max ?? 0, 0))
  let svg = d.plotPaint ? `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" ${paint(d.plotPaint, 'plotPaint')}/>` : ''
  for (const axis of axes) {
    if (axis.options.delete) continue
    for (const key of Object.keys(axis.options)) if (!['axPos', 'delete', 'majorUnit', 'minorUnit', 'crosses', 'crossesAt', 'crossBetween', 'tickLblPos', 'majorTickMark', 'minorTickMark', 'auto', 'lblAlgn', 'noMultiLvlLbl', 'lblOffset', 'tickLblSkip', 'tickMarkSkip'].includes(key)) unsupported(`axes.${axis.id}.${key}`, 'chart-axis-option-unimplemented')
    if (axis.minorGridlines || axis.options.minorUnit || (axis.options.crosses && axis.options.crosses !== 'autoZero') || axis.options.crossesAt !== undefined || ['majorTickMark', 'minorTickMark'].some(k => axis.options[k] && axis.options[k] !== 'none')) unsupported(`axes.${axis.id}`, 'chart-axis-decoration-unimplemented')
    const isX = axis === xAxis, isSeries = axis.kind === 'serAx'
    const axisX = right ? box.x + box.width : box.x, axisY = top ? box.y : box.y + box.height
    const start = transform(isX ? box.x : axisX, isX ? axisY : box.y + box.height, 0)
    const end = isSeries ? transform(axisX, box.y + box.height, depth) : isX ? transform(box.x + box.width, axisY, 0) : transform(axisX, box.y, 0)
    svg += `<path data-chart-axis="${escape(axis.id)}" d="M ${start} L ${end}" ${paint(axis.paint, `axes.${axis.id}`, false)}/>`
    for (const tick of ticks.get(axis)) {
      const px = isSeries ? axisX : isX ? x(tick.value, tick.index, true) : axisX, py = isSeries ? box.y + box.height : isX ? axisY : y(tick.value, tick.index, true)
      if (axis.majorGridlines) svg += `<path d="M ${transform(px, py, 0)} L ${transform(isX ? px : box.x + box.width, isX ? box.y : py, 0)}" ${paint(axis.majorGridlines, 'gridlines', false)}/>`
      const label = labels.get(axis).find(l => l.index === tick.index)?.label
      if (label && tick.index % (axis.options.tickLblSkip ?? 1) === 0) { const p = transform(px, py, isSeries ? depth * fraction(axis,tick.value,tick.index,true) : 0); svg += label.at(p[0], p[1] - (isX && top ? label.height : isX ? 0 : label.height / 2), isX ? 'middle' : right ? 'start' : 'end') }
    }
    if (axis.title) { const title = text(d, String(channelText(axis.title)), axis.title.textStyle, `axes.${axis.id}.title`, runtime); const p = transform(isX ? box.x + box.width / 2 : frame.x, isX ? box.y + box.height + bottom : box.y, 0); svg += title.at(p[0], p[1], 'middle') }
  }
  return { x, y, box, count, zero, horizontal, svg, domains, xAxis, yAxis }
}
module.exports = { nativeLayout, values }
