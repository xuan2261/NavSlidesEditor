const { escape, unsupported, paint, dataLabel } = require('./pptx-chart-svg-primitives')
const { nativeLayout } = require('./pptx-chart-native-layout')
const { chartProjection, cuboid, CUBE_FACES } = require('./pptx-chart-projection')
const { surfaceFaces } = require('./pptx-chart-native-surface')
const { meshData } = require('./pptx-chart-native-series')
const { markerSvg, curve } = require('./pptx-chart-native-primitives')
function polygon(vertices, attrs, style, path, projection, wireframe = false) {
  const points = vertices.map(p => projection.point(...p).join(',')).join(' ')
  return { depth: vertices.reduce((sum, p) => sum + projection.camera(...p)[2], 0) / vertices.length,
    svg: `<polygon ${attrs} points="${points}" ${paint(style, path, !wireframe)}/>` }
}
function mesh(d, plot, frame, runtime, model) {
  const surface = plot.family.startsWith('surface'), contour = plot.family === 'surfaceChart'
  const projection = chartProjection(contour ? { rotX: 90, rotY: 0, rAngAx: true, ...d.view3D } : d.view3D, frame)
  model.projection = { ...projection.config, depth: projection.depth }
  const layout = nativeLayout(d, plot, frame, runtime, projection.point, projection.depth)
  const { box, count, horizontal, zero } = layout
  const { sorted, maps, cells } = meshData(plot, d.options.dispBlanksAs), faces = []
  const record = sorted.map(s => ({ seriesId: s.id, points: [] }))
  const lane = projection.depth / (sorted.length + (plot.options.gapDepth ?? 150) / 100)
  const grouping = plot.options.grouping ?? 'standard'
  for (let s = 0; s < sorted.length; s++) {
    const series = sorted[s]
    const indices = [...cells[s].keys()].sort((a,b)=>a-b)
    for (const index of indices) {
      const cell = cells[s].get(index), rawValue = cell.raw, value = cell.value
      const baseline = ['stacked','percentStacked'].includes(grouping) ? cell.baseline : zero
      const px = horizontal ? layout.x(value, index) : layout.x(index, index)
      const py = horizontal ? layout.y(index, index) : layout.y(value, index)
      const z = s * projection.depth / Math.max(1, sorted.length - (surface ? 1 : 0))
      const override = series.pointStyles?.find(p => p.index === index)
      const style = { ...series.paint, ...override?.paint }
      const attrs = `data-chart-series="${escape(series.id)}" data-chart-point="${index}"`
      let vertices
      if (plot.family === 'bar3DChart') {
        const clustered = grouping === 'clustered', barCount = clustered ? sorted.length : 1
        const band = (horizontal ? box.height : box.width) / count
        const overlap = (plot.options.overlap ?? 0) / 100
        const width = band / (1 + (barCount - 1) * (1 - overlap) + (plot.options.gapWidth ?? 150) / 100)
        const groupWidth = width * (1 + (barCount - 1) * (1 - overlap))
        const center = (horizontal ? py : px) - groupWidth / 2 + (clustered ? s * width * (1 - overlap) : 0)
        const base = horizontal ? layout.x(baseline, index) : layout.y(baseline, index)
        const bz = clustered || grouping === 'stacked' || grouping === 'percentStacked' ? 0 : z
        vertices = horizontal ? cuboid(Math.min(px, base), center, bz, Math.abs(px - base), width, lane) : cuboid(center, Math.min(py, base), bz, width, Math.abs(py - base), lane)
        const shape = series.options.shape ?? plot.options.shape ?? 'box'
        if (shape !== 'box') { const domain=layout.domains.get(horizontal ? layout.xAxis : layout.yAxis); const fraction=Math.min(1,Math.abs(value-baseline)/Math.max(Math.abs(domain.max-baseline),Math.abs(domain.min-baseline))); vertices = shapedBar(vertices, shape, horizontal, base, fraction) }
        const indices = vertices.length === 8 ? CUBE_FACES : vertices.faces
        const source = vertices.vertices ?? vertices
        for (let f = 0; f < indices.length; f++) faces.push(polygon(indices[f].map(i => source[i]), `${attrs} data-chart-face="${f}"`, style, `series.${series.id}`, projection))
        vertices = source.map(p => projection.point(...p))
      } else {
        const point = [px, contour ? box.y + box.height : py, z]
        vertices = [projection.point(...point)]
        const nextIndex = d.options.dispBlanksAs === 'span' ? indices[indices.indexOf(index)+1] : index+1
        const next = cells[s].get(nextIndex)
        if (!surface && next) {
          const nx = layout.x(nextIndex, nextIndex), ny = layout.y(next.value, nextIndex)
          const base = layout.y(baseline, index), nextBase = layout.y(next.baseline, nextIndex)
          const area = plot.family === 'area3DChart'
          const line = style.line
          if (!area && line?.widthEmu === undefined) unsupported(`series.${series.id}.line.widthEmu`, 'chart-source-line-width-unresolved')
          const ribbonPaint = area ? style : { fill: line?.fill, line: { fill: { kind:'none' } } }
          const thickness = area ? lane : (line?.widthEmu ?? 9525)/9525
          const previous = cells[s].get(index-1), following = cells[s].get(nextIndex+1)
          const path = curve([px,py,z], [nx,ny,z], previous ? [layout.x(index-1,index-1),layout.y(previous.value,index-1),z] : undefined, following ? [layout.x(nextIndex+1,nextIndex+1),layout.y(following.value,nextIndex+1),z] : undefined, series.options.smooth ?? plot.options.smooth)
          for (let i=0;i<path.length-1;i++) {
            const a=path[i], b=path[i+1], back=v=>[v[0],v[1],v[2]+thickness]
            faces.push(polygon([a,b,back(b),back(a)], `${attrs} data-chart-face="ribbon"`, ribbonPaint, `series.${series.id}`, projection))
          }
          if (area) {
            const front = [[px,py,z],[nx,ny,z],[nx,nextBase,z],[px,base,z]]
            faces.push(polygon(front, `${attrs} data-chart-face="front"`, style, `series.${series.id}`, projection))
            faces.push(polygon(front.map(v=>[v[0],v[1],v[2]+lane]), `${attrs} data-chart-face="back"`, style, `series.${series.id}`, projection))
            for (const edge of [[front[0],front[3]],[front[1],front[2]],[front[2],front[3]]]) faces.push(polygon([edge[0],edge[1],[edge[1][0],edge[1][1],z+lane],[edge[0][0],edge[0][1],z+lane]], `${attrs} data-chart-face="side"`, style, `series.${series.id}`, projection))
          }
        }
      }
      const projected = projection.point(px, py, z)
      if (plot.dropLines) faces.push({ depth:projection.camera(px,py,z)[2], svg:`<path data-chart-drop-line="${index}" d="M ${projected} L ${projection.point(px,layout.y(baseline,index),z)}" ${paint(plot.dropLines,'plot.dropLines',false)}/>` })
      if (!surface) { const marker = markerSvg(series,index,...projected); if (marker) faces.push({ depth:projection.camera(px,py,z)[2], svg:marker }) }
      record[s].points.push({ index, value: rawValue, x: projected[0], y: projected[1], vertices })
      const label = dataLabel(d, plot, series, { index, value: rawValue }, null, runtime)
      if (label) faces.push({ depth: projection.camera(px, py, z)[2], svg: label.at(projected[0], projected[1] - label.height / 2, 'middle') })
    }
  }
  if (surface) faces.push(...surfaceFaces(d, plot, sorted, maps, layout, projection))
  model.series.push(...record)
  return layout.svg + `<g data-chart-family="${plot.family}">` + faces.sort((a,b) => a.depth-b.depth).map(f => f.svg).join('') + '</g>'
}
function shapedBar(cube, shape, horizontal, basePlane, fraction) {
  const radial = ['cylinder', 'cone', 'coneToMax'].includes(shape)
  const radius = shape === 'cylinder' ? 1 : shape.endsWith('ToMax') ? 1-fraction : 0
  const pointed = radius === 0, axis = horizontal ? 0 : 1
  const ends = horizontal ? [[0,3,7,4],[1,2,6,5]] : [[0,1,5,4],[3,2,6,7]]
  const firstIsBase = Math.abs(cube[ends[0][0]][axis]-basePlane)<1e-8
  const base = ends[firstIsBase ? 0 : 1].map(i=>cube[i]), top = ends[firstIsBase ? 1 : 0].map(i=>cube[i])
  const center = points => points[0].map((_,j)=>points.reduce((sum,p)=>sum+p[j],0)/points.length)
  const b=center(base), t=center(top), n=radial ? 32 : 4, vertices=[], faces=[]
  for (let i=0;i<n;i++) {
    const a=2*Math.PI*i/n, side=horizontal ? 1 : 0
    vertices.push(radial ? b.map((v,j)=>v+(j===side ? Math.cos(a)*Math.abs(base[1][j]-base[0][j])/2 : j===2 ? Math.sin(a)*Math.abs(base[2][j]-base[0][j])/2 : 0)) : base[i])
  }
  if (pointed) vertices.push(t)
  else for (let i=0;i<n;i++) vertices.push(vertices[i].map((v,j)=>t[j]+(v-b[j])*radius))
  for (let i=0;i<n;i++) faces.push(pointed ? [i,(i+1)%n,n] : [i,(i+1)%n,(i+1)%n+n,i+n])
  faces.push(Array.from({length:n},(_,i)=>i))
  if (!pointed) faces.push(Array.from({length:n},(_,i)=>i+n))
  return { vertices,faces }
}
module.exports = { mesh, polygon }
