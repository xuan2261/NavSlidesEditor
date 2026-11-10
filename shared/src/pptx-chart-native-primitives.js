const { escape, paint, unsupported } = require('./pptx-chart-svg-primitives')
function markerSvg(series, index, x, y) {
  const symbol = series.marker?.symbol
  if (!symbol || symbol === 'none') return ''
  const size = series.marker.size
  if (!size || symbol === 'picture' || symbol === 'auto') unsupported(`series.${series.id}.marker`, 'chart-marker-default-unresolved')
  const r = size * 2 / 3, identity = `data-chart-series="${escape(series.id)}" data-chart-point="${index}"`
  const attrs = paint(series.markerPaint, `series.${series.id}.markerPaint`, !['x', 'plus', 'dash'].includes(symbol))
  if (symbol === 'circle' || symbol === 'dot') return `<circle ${identity} cx="${x}" cy="${y}" r="${symbol === 'dot' ? r/2 : r}" ${attrs}/>`
  if (symbol === 'square') return `<rect ${identity} x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" ${attrs}/>`
  if (symbol === 'diamond' || symbol === 'triangle' || symbol === 'star') {
    const n = symbol === 'triangle' ? 3 : symbol === 'star' ? 10 : 4
    const points = Array.from({ length:n }, (_,i)=>{ const radius = symbol === 'star' && i%2 ? r/2 : r; const angle = -Math.PI/2+2*Math.PI*i/n; return [x+radius*Math.cos(angle),y+radius*Math.sin(angle)].join(',') })
    return `<polygon ${identity} points="${points.join(' ')}" ${attrs}/>`
  }
  const path = symbol === 'x' ? `M ${x-r} ${y-r} L ${x+r} ${y+r} M ${x-r} ${y+r} L ${x+r} ${y-r}` : symbol === 'dash' ? `M ${x-r} ${y} H ${x+r}` : `M ${x-r} ${y} H ${x+r} M ${x} ${y-r} V ${y+r}`
  return `<path ${identity} d="${path}" ${attrs}/>`
}
function curve(a, b, previous = a, next = b, smooth = false) {
  if (!smooth) return [a,b]
  return Array.from({ length:17 }, (_,i)=>{
    const t=i/16, t2=t*t, t3=t2*t
    return a.map((v,j)=>0.5*((2*v)+(-previous[j]+b[j])*t+(2*previous[j]-5*v+4*b[j]-next[j])*t2+(-previous[j]+3*v-3*b[j]+next[j])*t3))
  })
}
module.exports = { markerSvg, curve }
