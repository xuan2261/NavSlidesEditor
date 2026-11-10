const { escape, unsupported, dataLabel } = require('./pptx-chart-svg-primitives')
const { chartProjection } = require('./pptx-chart-projection')
const { polygon } = require('./pptx-chart-native-mesh')
function pie3D(d, plot, box, runtime, model) {
  if (plot.series.length !== 1) unsupported('pie3D.series', 'chart-multiple-rings-unimplemented')
  const series = plot.series[0], points = series.data.val.cache?.points
  if (!points) unsupported('pie3D.values', 'chart-data-cache-unavailable')
  const projection = chartProjection({ rotX: 30, rotY: 0, ...d.view3D }, box)
  model.projection = { ...projection.config, depth: projection.depth }
  const total = points.reduce((sum, p) => sum + Math.abs(p.value), 0)
  const center = [box.x + box.width / 2, box.y + box.height / 2, projection.depth / 2]
  const rx = box.width / 2, rz = projection.depth / 2, thickness = box.height / 10
  const faces = [], record = { seriesId: series.id, points: [] }
  let angle = plot.options.firstSliceAng ?? 0
  for (const p of [...points].sort((a,b) => a.index-b.index)) {
    if (!p.value || !total) continue
    const end = angle + Math.abs(p.value)/total*360, mid = (angle+end)/2*Math.PI/180
    const override = series.pointStyles?.find(s => s.index === p.index)
    const explosion = override?.options.explosion ?? series.options.explosion ?? 0
    const c = [center[0]+Math.sin(mid)*rx*explosion/100, center[1], center[2]-Math.cos(mid)*rz*explosion/100]
    const style = { ...series.paint, ...override?.paint }
    if (plot.options.varyColors && !override?.paint?.fill) unsupported(`pie3D.point.${p.index}`, 'chart-source-point-paint-unresolved')
    const ring = [], segments = Math.max(2, Math.ceil((end-angle)/5))
    for (let i = 0; i <= segments; i++) { const a = (angle+(end-angle)*i/segments)*Math.PI/180; ring.push([c[0]+Math.sin(a)*rx,c[1],c[2]-Math.cos(a)*rz]) }
    const bottom = v => [v[0],v[1]+thickness,v[2]]
    const attrs = `data-chart-series="${escape(series.id)}" data-chart-point="${p.index}"`
    faces.push(polygon([c,...ring], `${attrs} data-chart-face="top"`, style, 'pie3D.paint', projection))
    faces.push(polygon([bottom(c),...ring.map(bottom)], `${attrs} data-chart-face="bottom"`, style, 'pie3D.paint', projection))
    for (let i = 0; i < ring.length-1; i++) faces.push(polygon([ring[i],ring[i+1],bottom(ring[i+1]),bottom(ring[i])], `${attrs} data-chart-face="outer"`, style, 'pie3D.paint', projection))
    for (const edge of [ring[0],ring[ring.length-1]]) faces.push(polygon([c,edge,bottom(edge),bottom(c)], `${attrs} data-chart-face="radial"`, style, 'pie3D.paint', projection))
    record.points.push({ index: p.index, value: p.value, startAngle: angle, endAngle: end, vertices: ring.map(v => projection.point(...v)) })
    const label = dataLabel(d, plot, series, p, total, runtime)
    if (label) { const v = [c[0]+Math.sin(mid)*rx/2,c[1],c[2]-Math.cos(mid)*rz/2], pos = projection.point(...v); faces.push({ depth: projection.camera(...v)[2], svg: label.at(pos[0],pos[1]-label.height/2,'middle') }) }
    angle = end
  }
  model.series.push(record)
  return `<g data-chart-family="pie3DChart">${faces.sort((a,b)=>a.depth-b.depth).map(f=>f.svg).join('')}</g>`
}
module.exports = { pie3D }
