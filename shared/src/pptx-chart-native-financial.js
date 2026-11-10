const { unsupported, paint, escape, dataLabel } = require('./pptx-chart-svg-primitives')
const { nativeLayout, values } = require('./pptx-chart-native-layout')
const { markerSvg } = require('./pptx-chart-native-primitives')
function stock(d, plot, frame, runtime, model) {
  const series = [...plot.series].sort((a, b) => a.order - b.order)
  if (![3, 4].includes(series.length)) unsupported('stock.series', 'chart-stock-role-count-invalid')
  const layout = nativeLayout(d, plot, frame, runtime)
  const { x, y, box, count } = layout
  const maps = series.map(s => values(s.data.val))
  const ohlc = series.length === 4, hi = ohlc ? 1 : 0, lo = hi + 1, close = lo + 1
  let svg = layout.svg + `<g data-chart-family="stockChart" data-chart-stock="${ohlc ? 'ohlc' : 'hlc'}">`
  const records = series.map(s => ({ seriesId: s.id, points: [] }))
  const width = box.width / count / (1 + (plot.upDownBars?.gapWidth ?? 150) / 100)
  for (let index = 0; index < count; index++) {
    if (maps.some(m => !m.has(index))) continue
    const px = x(index, index), high = y(maps[hi].get(index), index), low = y(maps[lo].get(index), index)
    const rangePaint = plot.hiLowLines ?? series[hi].paint
    svg += `<path data-chart-stock-range="${index}" d="M ${px} ${high} L ${px} ${low}" ${paint(rangePaint, 'stock.hiLowLines', false)}/>`
    const end = y(maps[close].get(index), index)
    if (ohlc && plot.upDownBars) {
      const start = y(maps[0].get(index), index)
      const up = maps[close].get(index) >= maps[0].get(index)
      const style = plot.upDownBars[up ? 'upBars' : 'downBars']
      svg += `<rect data-chart-stock-body="${index}" x="${px - width / 2}" y="${Math.min(start, end)}" width="${width}" height="${Math.abs(start - end)}" ${paint(style, `stock.${up ? 'upBars' : 'downBars'}`)}/>`
    } else {
      if (ohlc) svg += `<path data-chart-stock-open="${index}" d="M ${px - width / 2} ${y(maps[0].get(index), index)} H ${px}" ${paint(series[0].paint, 'stock.open', false)}/>`
      svg += `<path data-chart-stock-close="${index}" d="M ${px} ${end} h ${width / 2}" ${paint(series[close].paint, 'stock.close', false)}/>`
    }
    for (let s = 0; s < series.length; s++) {
      const value = maps[s].get(index), py = y(value, index)
      records[s].points.push({ index, value, x: px, y: py })
      svg += markerSvg(series[s],index,px,py)
      if (plot.dropLines) svg += `<path data-chart-drop-line="${index}" d="M ${px} ${py} L ${px} ${y(layout.zero,index)}" ${paint(plot.dropLines,'plot.dropLines',false)}/>`
      const label = dataLabel(d, plot, series[s], { index, value }, null, runtime)
      if (label) svg += label.at(px, py - label.height / 2, 'middle')
    }
  }
  model.series.push(...records)
  return svg + '</g>'
}
function bubbles(d, plot, frame, runtime, model) {
  const layout = nativeLayout(d, plot, frame, runtime), { box } = layout
  const domain = Math.max(0, ...plot.series.flatMap(s => [...values(s.data.bubbleSize).values()].filter(v => v >= 0 || plot.options.showNegBubbles).map(Math.abs)))
  const maxRadius = Math.min(box.width, box.height) / 10 * (plot.options.bubbleScale ?? 100) / 100
  let svg = layout.svg + '<g data-chart-family="bubbleChart">'
  for (const series of plot.series) {
    if (!series.data.xVal.cache || !series.data.bubbleSize.cache) unsupported(`series.${series.id}`, 'chart-data-cache-unavailable')
    const xs = values(series.data.xVal), sizes = values(series.data.bubbleSize), record = { seriesId: series.id, points: [] }
    for (const [index, value] of values(series.data.yVal)) {
      const magnitude = sizes.get(index)
      if (!xs.has(index) || magnitude === undefined || !magnitude || (magnitude < 0 && !plot.options.showNegBubbles)) continue
      const fraction = Math.abs(magnitude) / domain
      const radius = maxRadius * (plot.options.sizeRepresents === 'w' ? fraction : Math.sqrt(fraction))
      const x = layout.x(xs.get(index), index), y = layout.y(value, index)
      const point = series.pointStyles?.find(p => p.index === index)
      const style = { ...series.paint, ...point?.paint }
      svg += `<circle data-chart-series="${escape(series.id)}" data-chart-point="${index}" data-chart-bubble-size="${magnitude}" cx="${x}" cy="${y}" r="${radius}" ${paint(style, `series.${series.id}`)}/>`
      record.points.push({ index, value, magnitude, x, y, radius })
      const label = dataLabel(d, plot, series, { index, value }, null, runtime)
      if (label) svg += label.at(x, y - label.height / 2, 'middle')
    }
    model.series.push(record)
  }
  return svg + '</g>'
}
module.exports = { stock, bubbles }
