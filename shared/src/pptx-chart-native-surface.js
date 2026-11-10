const { paint, unsupported } = require('./pptx-chart-svg-primitives')
// Clip a scalar-valued triangle at an isovalue, interpolating geometry and value.
function clip(vertices, boundary, above) {
  const output = []
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i+1)%vertices.length]
    const ai = above ? a.value >= boundary : a.value <= boundary
    const bi = above ? b.value >= boundary : b.value <= boundary
    if (ai) output.push(a)
    if (ai !== bi) { const t = (boundary-a.value)/(b.value-a.value); output.push({ value: boundary, point: a.point.map((v,j)=>v+(b.point[j]-v)*t) }) }
  }
  return output
}
function surfaceFaces(d, plot, sorted, maps, layout, projection) {
  const { box, count } = layout, contour = plot.family === 'surfaceChart', faces = []
  if (sorted.length < 2 || count < 2) unsupported('surface.grid', 'chart-surface-grid-required')
  const domain = layout.domains.get(layout.yAxis)
  const bands = [...(plot.bandFormats ?? sorted.map((s,index)=>({ index, paint:s.paint })))].sort((a,b)=>a.index-b.index)
  if (!bands.length) unsupported('surface.bands', 'chart-source-paint-unresolved')
  const unit = layout.yAxis.options.majorUnit ?? (domain.max-domain.min)/bands.length
  const seriesAxis = d.axes.find(a => a.kind === 'serAx' && plot.axisIds.includes(a.id))
  const z = s => (seriesAxis?.scaling?.orientation === 'maxMin' ? 1-s/(sorted.length-1) : s/(sorted.length-1))*projection.depth
  for (let s = 0; s < sorted.length-1; s++) for (let i = 0; i < count-1; i++) {
    const samples = [maps[s].get(i), maps[s].get(i+1), maps[s+1].get(i+1), maps[s+1].get(i)]
    if (samples.some(v=>v === undefined)) continue
    const corners = [[s,i],[s,i+1],[s+1,i+1],[s+1,i]].map(([si,index],n)=>({ value:samples[n], point:[layout.x(index,index),contour ? box.y+box.height : layout.y(samples[n],index),z(si)] }))
    for (const triangle of [[0,1,2],[0,2,3]]) for (let band = 0; band < bands.length; band++) {
      const low = domain.min+bands[band].index*unit, high = band === bands.length-1 ? domain.max : domain.min+(bands[band].index+1)*unit
      const vertices = clip(clip(triangle.map(n=>corners[n]), low, true), high, false)
      if (vertices.length < 3) continue
      const points = vertices.map(v=>projection.point(...v.point))
      const area = points.reduce((sum,p,j)=>{ const next=points[(j+1)%points.length]; return sum+p[0]*next[1]-next[0]*p[1] },0)
      if (Math.abs(area) < 1e-8) continue
      faces.push({ depth:vertices.reduce((sum,v)=>sum+projection.camera(...v.point)[2],0)/vertices.length,
        svg:`<polygon data-chart-surface-cell="${s}:${i}" data-chart-band="${bands[band].index}" points="${points.map(p=>p.join(',')).join(' ')}" ${paint(bands[band].paint, `surface.band.${bands[band].index}`, !plot.options.wireframe)}/>` })
    }
  }
  return faces
}
module.exports = { surfaceFaces }
