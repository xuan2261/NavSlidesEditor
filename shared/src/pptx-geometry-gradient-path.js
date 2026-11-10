// Derived vector paint. Source rectangles and geometry stay independently editable.
const { ellipseGradientSvgDefinition } = require('./pptx-geometry-gradient-ellipse')
function circlePatternSvgDefinition({
  id,
  x,
  y,
  diameter,
  transform,
  definitions,
  ink,
  reflected,
}) {
  const period = diameter * 2
  const copies = [
    [1, 1, 0, 0],
    [-1, 1, period, 0],
    [1, -1, 0, period],
    [-1, -1, period, period],
  ]
    .map(
      ([sx, sy, tx, ty]) =>
        `<use href="#${id}-cell-ink" transform="matrix(${sx} 0 0 ${sy} ${tx} ${ty})"/>`
    )
    .join('')
  const partition = reflected
    ? { definitions: '', ink }
    : {
        definitions: `<clipPath id="${id}-cell"><rect width="${diameter}" height="${diameter}"/></clipPath><g id="${id}-cell-ink" clip-path="url(#${id}-cell)">${ink}</g>`,
        ink: copies,
      }
  return `<defs>${definitions}${partition.definitions}<pattern id="${id}" patternUnits="userSpaceOnUse" x="${x}" y="${y}" width="${period}" height="${period}" viewBox="0 0 ${period} ${period}"${transform}>${partition.ink}</pattern></defs>`
}
function pathGradientSvgDefinition(gradient, { width, height, matrix, id, stops, first, paint }) {
  const tile = gradient.path === 'shape' ? {} : (gradient.tileRect ?? {})
  const x = (width * (tile.l ?? 0)) / 100000,
    y = (height * (tile.t ?? 0)) / 100000,
    w = width * (1 - ((tile.l ?? 0) + (tile.r ?? 0)) / 100000),
    h = height * (1 - ((tile.t ?? 0) + (tile.b ?? 0)) / 100000)
  const focus = gradient.fillToRect ?? { l: 50000, t: 50000, r: 50000, b: 50000 }
  const left = (w * (focus.l ?? 0)) / 100000,
    top = (h * (focus.t ?? 0)) / 100000,
    right = w * (1 - (focus.r ?? 0) / 100000),
    bottom = h * (1 - (focus.b ?? 0) / 100000)
  const color = '#' + first.rgb.map((value) => value.toString(16).padStart(2, '0')).join('')
  const opacity = first.alpha === 255 ? '' : ` fill-opacity="${first.alpha / 255}"`
  const transform = ` patternTransform="matrix(${matrix.join(' ')})"`
  if (gradient.path === 'circle') {
    const radius = Math.hypot(w, h) / 2,
      diameter = radius * 2,
      // Derive center displacement before adding radius so symmetric source
      // and tile declarations remain exactly concentric at every extent.
      fx =
        radius +
        (width * ((focus.l ?? 0) - (focus.r ?? 0) - (tile.l ?? 0) + (tile.r ?? 0))) / 200000,
      fy =
        radius +
        (height * ((focus.t ?? 0) - (focus.b ?? 0) - (tile.t ?? 0) + (tile.b ?? 0))) / 200000
    const tx = 100000 - (tile.l ?? 0) - (tile.r ?? 0),
      ty = 100000 - (tile.t ?? 0) - (tile.b ?? 0),
      // Native nonpositive tiles retain the circle but leave focus scales zero.
      // Divide integer source fractions once so equal ratios stay equal.
      sx = tx > 0 && ty > 0 ? (100000 - (focus.l ?? 0) - (focus.r ?? 0)) / tx : 0,
      sy = tx > 0 && ty > 0 ? (100000 - (focus.t ?? 0) - (focus.b ?? 0)) / ty : 0,
      fr = radius * Math.abs(sx)
    // Nonnested circles need level sets: a browser radial gradient can clamp focus.
    if (sx !== sy || Math.hypot(fx - radius, fy - radius) + fr > radius) {
      const field = ellipseGradientSvgDefinition({
        radius,
        focus: { cx: fx, cy: fy, rx: radius * sx, ry: radius * sy },
        paint,
        id,
        reflected: true,
      })
      return circlePatternSvgDefinition({
        id,
        x: x + w / 2 - radius,
        y: y + h / 2 - radius,
        diameter,
        transform,
        ...field,
      })
    }
    return circlePatternSvgDefinition({
      id,
      x: x + w / 2 - radius,
      y: y + h / 2 - radius,
      diameter,
      transform,
      definitions: `<radialGradient id="${id}-circle" gradientUnits="userSpaceOnUse" cx="${radius}" cy="${radius}" r="${radius}" fx="${fx}" fy="${fy}" fr="${fr}" color-interpolation="sRGB">${stops}</radialGradient>`,
      ink: `<circle cx="${radius}" cy="${radius}" r="${radius}" fill="${fr >= radius ? color : `url(#${id}-circle)`}"${fr >= radius ? opacity : ''}/>`,
    })
  }
  const outside = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ]
  const inside = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ]
  const axes = [
    [0, top, 0, 0],
    [right, 0, w, 0],
    [0, bottom, 0, h],
    [left, 0, 0, 0],
  ]
  let definitions = '',
    polygons = ''
  for (let index = 0; index < 4; index++) {
    const [x1, y1, x2, y2] = axes[index],
      next = (index + 1) % 4
    if (x1 === x2 && y1 === y2) continue
    definitions += `<linearGradient id="${id}-${index}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" color-interpolation="sRGB">${stops}</linearGradient>`
    const points = [outside[index], outside[next], inside[next], inside[index]]
      .map((point) => point.join(','))
      .join(' ')
    polygons += `<polygon points="${points}" fill="url(#${id}-${index})" shape-rendering="crispEdges"/>`
  }
  const center = `<rect x="${left}" y="${top}" width="${Math.max(0, right - left)}" height="${Math.max(0, bottom - top)}" fill="${color}"${opacity}/>`
  return `<defs>${definitions}<pattern id="${id}" patternUnits="userSpaceOnUse" x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${transform}>${polygons}${center}</pattern></defs>`
}
module.exports = { pathGradientSvgDefinition }
