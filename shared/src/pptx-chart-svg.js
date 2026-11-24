const { normalizeChartDocument } = require('./pptx-chart-document')
const {
  escape,
  unsupported,
  paint,
  text,
  channelText,
  dataLabel,
} = require('./pptx-chart-svg-primitives')
const { cartesian } = require('./pptx-chart-svg-cartesian')
const { NATIVE_FAMILIES, nativeFamily } = require('./pptx-chart-native')
function sourceVisuals(d) {
  return Boolean(
    d.paint ||
    d.view3D ||
    d.plotPaint ||
    d.textStyle ||
    d.title?.textStyle ||
    d.legendTextStyle ||
    d.axes.some((a) => a.paint || a.textStyle) ||
    d.plots.some(
      (p) =>
        p.dataLabels?.textStyle ||
        p.hiLowLines || p.dropLines || p.upDownBars || p.bandFormats ||
        p.series.some((s) => s.paint || s.pointStyles || s.markerPaint || s.dataLabels?.textStyle)
    )
  )
}
function allowed(value, keys, path) {
  for (const k of Object.keys(value ?? {}))
    if (!keys.includes(k)) unsupported(`${path}.${k}`, 'chart-option-unimplemented')
}
function pie(d, plot, box, runtime, model) {
  allowed(plot.options, ['firstSliceAng', 'holeSize', 'varyColors'], 'plot')
  if (plot.series.length !== 1) unsupported('plot.series', 'chart-multiple-rings-unimplemented')
  const series = plot.series[0]
  allowed(series.options, [], `series.${series.id}`)
  if (!series.data.val.cache) unsupported(`series.${series.id}`, 'chart-data-cache-unavailable')
  const points = [...series.data.val.cache.points].sort((a, b) => a.index - b.index)
  const total = points.reduce((sum, p) => sum + Math.abs(p.value), 0)
  if (!total) return ''
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2,
    radius = Math.min(box.width, box.height) / 2
  const inner = plot.family === 'doughnutChart' ? (radius * (plot.options.holeSize ?? 50)) / 100 : 0
  const position = (angle, r) => [
    cx + Math.sin((angle * Math.PI) / 180) * r,
    cy - Math.cos((angle * Math.PI) / 180) * r,
  ]
  let angle = plot.options.firstSliceAng ?? 0,
    svg = ''
  const record = { seriesId: series.id, points: [] }
  for (const p of points) {
    if (!p.value) continue
    const pointStyle = series.pointStyles?.find((s) => s.index === p.index)
    for (const [key, value] of Object.entries(pointStyle?.options ?? {}))
      if (value !== false && value !== 0)
        unsupported(`pointStyles.${p.index}.${key}`, 'chart-point-option-unimplemented')
    const end = angle + (Math.abs(p.value) / total) * 360
    const style = { ...series.paint, ...pointStyle?.paint }
    if (plot.options.varyColors && !pointStyle?.paint?.fill)
      unsupported(`pointStyles.${p.index}`, 'chart-source-point-paint-unresolved')
    const attrs = paint(style, `series.${series.id}.point.${p.index}`)
    // Two arcs also represent the full-circle case without a degenerate SVG arc.
    const mid = (angle + end) / 2
    const outerPath = `M ${position(angle, radius)} A ${radius} ${radius} 0 0 1 ${position(mid, radius)} A ${radius} ${radius} 0 0 1 ${position(end, radius)}`
    const path = inner
      ? `${outerPath} L ${position(end, inner)} A ${inner} ${inner} 0 0 0 ${position(mid, inner)} A ${inner} ${inner} 0 0 0 ${position(angle, inner)} Z`
      : `${outerPath} L ${cx} ${cy} Z`
    svg += `<path data-chart-series="${escape(series.id)}" data-chart-point="${p.index}" d="${path}" ${attrs}/>`
    const label = dataLabel(d, plot, series, p, total, runtime)
    if (label) {
      const [x, y] = position(mid, end - angle === 360 && !inner ? 0 : (radius + inner) / 2)
      svg += label.at(x, y - label.height / 2, 'middle')
    }
    record.points.push({ index: p.index, value: p.value, startAngle: angle, endAngle: end })
    angle = end
  }
  model.series.push(record)
  return svg
}
function projectChartSvg(document, { width, height, fontRuntime, theme } = {}) {
  const d = normalizeChartDocument(document)
  const runtime = fontRuntime && { ...fontRuntime, theme }
  try {
    if (!(width > 0 && height > 0) || !Number.isFinite(width + height))
      unsupported('frame', 'chart-frame-size-unavailable')
    if (d.style !== undefined) unsupported('style', 'chart-native-style-unresolved')
    allowed(
      d.options,
      ['autoTitleDeleted', 'plotVisOnly', 'dispBlanksAs', 'date1904', 'roundedCorners'],
      'chart'
    )
    if (d.options.roundedCorners && d.paint?.fill?.kind !== 'none')
      unsupported('roundedCorners', 'chart-rounded-background-unimplemented')
    if (d.options.plotVisOnly === false)
      unsupported('plotVisOnly', 'chart-hidden-cell-semantics-unimplemented')
    const model = { series: [] },
      box = { x: 0, y: 0, width, height }
    let svg = d.paint
      ? `<rect width="${width}" height="${height}" ${paint(d.paint, 'paint')}/>`
      : ''
    if (d.title && !d.options.autoTitleDeleted) {
      if (d.title.kind !== 'text' && !d.title.cache)
        unsupported('title', 'chart-title-cache-unavailable')
      const title = text(d, String(channelText(d.title)), d.title.textStyle, 'title', runtime)
      if (title.width > width || title.height >= height)
        unsupported('title', 'chart-title-layout-overflow')
      svg += title.at(width / 2, 0, 'middle')
      box.y += title.height
      box.height -= title.height
    }
    if (d.legend) unsupported('legend', 'chart-legend-layout-unimplemented')
    const radial = d.plots.every((p) => ['pieChart', 'doughnutChart'].includes(p.family))
    if (radial && d.plots.length !== 1) unsupported('plots', 'chart-radial-combo-unimplemented')
    if (!d.plots.some(p => NATIVE_FAMILIES.has(p.family)) && (d.view3D || d.plots.some(p => p.hiLowLines || p.dropLines || p.upDownBars || p.bandFormats))) unsupported('plot.decorations', 'chart-native-decoration-unimplemented')
    if (d.plots.some(p => NATIVE_FAMILIES.has(p.family))) svg += nativeFamily(d, box, runtime, model)
    else if (radial) svg += pie(d, d.plots[0], box, runtime, model)
    else svg += cartesian(d, box, runtime, model)
    return {
      supported: true,
      reasons: [],
      source: d.source,
      model,
      svg: `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Source chart" viewBox="0 0 ${width} ${height}" width="100%" height="100%">${svg}</svg>`,
    }
  } catch (error) {
    if (!error.chartIssue) throw error
    const issue = {
      ...error.chartIssue,
      partUri: d.source.partUri,
      componentId: d.source.ownerDefinitionId,
    }
    return { supported: false, source: d.source, reasons: [error.message], issues: [issue] }
  }
}
module.exports = { projectChartSvg, sourceVisuals }
