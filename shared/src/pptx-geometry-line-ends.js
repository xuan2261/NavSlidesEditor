// Numeric profile measured from saved PowerPoint 16.0/build 10417, 3pt
// horizontal references. Other weights, curves and affine ink still require
// independent native qualification. Optional source sizes are never rewritten.
const closedSize = { sm: 2, med: 3, lg: 5 }
const openWidth = { sm: 2.5, med: 3.5, lg: 5 }
const openLength = { sm: 2, med: 3, lg: 4.5 }
const n = (value) => {
  if (!Number.isFinite(value)) throw new TypeError('Invalid line end coordinate')
  const rounded = Math.round(value)
  return String(Math.abs(value - rounded) < 1e-9 ? rounded : value)
}
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
function pointAt(segment, t) {
  if (segment.kind === 'arcTo') {
    const angle = segment.angle + segment.sweep * t
    return {
      x: segment.center.x + segment.radii[0] * Math.cos(angle),
      y: segment.center.y + segment.radii[1] * Math.sin(angle),
    }
  }
  let points = segment.points
  while (points.length > 1)
    points = points.slice(1).map((point, index) => mix(points[index], point, t))
  return points[0]
}
function speed(segment, t) {
  if (segment.kind === 'arcTo') {
    const angle = segment.angle + segment.sweep * t
    return (
      Math.abs(segment.sweep) *
      Math.hypot(segment.radii[0] * Math.sin(angle), segment.radii[1] * Math.cos(angle))
    )
  }
  const degree = segment.points.length - 1
  const derivative = segment.points.slice(1).map((point, index) => ({
    x: degree * (point.x - segment.points[index].x),
    y: degree * (point.y - segment.points[index].y),
  }))
  const vector = pointAt({ points: derivative }, t)
  return Math.hypot(vector.x, vector.y)
}
const quadratureNodes = [
  0, -0.5384693101056831, 0.5384693101056831, -0.906179845938664, 0.906179845938664,
]
const quadratureWeights = [
  0.5688888888888889, 0.4786286704993665, 0.4786286704993665, 0.2369268850561891,
  0.2369268850561891,
]
function integral(segment, a, b) {
  const half = (b - a) / 2,
    center = (a + b) / 2
  return (
    half *
    quadratureNodes.reduce(
      (sum, node, index) => sum + quadratureWeights[index] * speed(segment, center + half * node),
      0
    )
  )
}
function length(segment, a = 0, b = 1, depth = 0) {
  if (segment.kind === 'lnTo')
    return (
      (b - a) *
      Math.hypot(
        segment.points[1].x - segment.points[0].x,
        segment.points[1].y - segment.points[0].y
      )
    )
  const center = (a + b) / 2
  const whole = integral(segment, a, b)
  const halves = integral(segment, a, center) + integral(segment, center, b)
  if (depth >= 14 || Math.abs(halves - whole) <= 1e-7 * Math.max(1, halves)) return halves
  return length(segment, a, center, depth + 1) + length(segment, center, b, depth + 1)
}
function parameterAtLength(segment, distance, total) {
  if (distance <= 0) return 0
  if (distance >= total) return 1
  if (segment.kind === 'lnTo') return distance / total
  let low = 0,
    high = 1
  for (let index = 0; index < 40; index++) {
    const middle = (low + high) / 2
    if (length(segment, 0, middle) < distance) low = middle
    else high = middle
  }
  return (low + high) / 2
}
function split(segment, t) {
  if (segment.kind === 'arcTo') {
    const middle = pointAt(segment, t)
    return [
      { ...segment, points: [segment.points[0], middle], sweep: segment.sweep * t },
      {
        ...segment,
        points: [middle, segment.points[1]],
        angle: segment.angle + segment.sweep * t,
        sweep: segment.sweep * (1 - t),
      },
    ]
  }
  const left = [segment.points[0]],
    right = [segment.points.at(-1)]
  let points = segment.points
  while (points.length > 1) {
    points = points.slice(1).map((point, index) => mix(points[index], point, t))
    left.push(points[0])
    right.unshift(points.at(-1))
  }
  return [
    { ...segment, points: left },
    { ...segment, points: right },
  ]
}
function commandString(segment) {
  if (segment.kind === 'arcTo')
    return [
      'A',
      ...segment.radii.map(n),
      '0',
      Math.abs(segment.sweep) > Math.PI ? '1' : '0',
      segment.sweep > 0 ? '1' : '0',
      n(segment.points[1].x),
      n(segment.points[1].y),
    ].join(' ')
  return [
    { lnTo: 'L', quadBezTo: 'Q', cubicBezTo: 'C' }[segment.kind],
    ...segment.points.slice(1).flatMap((point) => [n(point.x), n(point.y)]),
  ].join(' ')
}
function glyph(end, strokeWidth) {
  const type = end?.type ?? 'none'
  if (type === 'none') return null
  const w = end.w ?? 'med',
    len = end.len ?? 'med'
  const width = (type === 'arrow' ? openWidth[w] : closedSize[w]) * strokeWidth
  const size = (type === 'arrow' ? openLength[len] : closedSize[len]) * strokeWidth
  const half = width / 2
  if (type === 'oval') return { type, size, consumed: 0, ellipse: [size / 2, half] }
  if (type === 'diamond')
    return {
      type,
      size,
      consumed: 0,
      d: `M ${n(size / 2)} 0 L 0 ${n(-half)} L ${n(-size / 2)} 0 L 0 ${n(half)} Z`,
    }
  if (type === 'arrow') {
    // The miter's outer tip is exactly the authored endpoint. Rounded wing
    // ends match the observed native open ink, independent of shaft cap/dash.
    const inset = ((strokeWidth / 2) * Math.hypot(size, half)) / half
    return {
      type,
      size,
      consumed: inset,
      open: true,
      d: `M ${n(-inset - size)} ${n(-half)} L ${n(-inset)} 0 L ${n(-inset - size)} ${n(half)}`,
    }
  }
  if (type === 'stealth')
    return {
      type,
      size,
      consumed: (size * 2) / 3,
      d: `M 0 0 L ${n(-size)} ${n(-half)} L ${n((-size * 2) / 3)} 0 L ${n(-size)} ${n(half)} Z`,
    }
  return {
    type,
    size,
    consumed: Math.max(0, size - strokeWidth / 2),
    d: `M 0 0 L ${n(-size)} ${n(-half)} L ${n(-size)} ${n(half)} Z`,
  }
}
function deriveNativeLineEnds(path, stroke, strokeWidth) {
  const head = glyph(stroke.headEnd, strokeWidth),
    tail = glyph(stroke.tailEnd, strokeWidth)
  if (path.stroke === false || strokeWidth === 0 || (!head && !tail)) return null
  const subpaths = []
  for (const segment of path.segments) {
    if (segment.kind === 'moveTo')
      subpaths.push({ start: segment.points[0], segments: [], closed: false })
    else if (segment.kind === 'close') {
      subpaths.at(-1).segments.push(segment)
      subpaths.at(-1).closed = true
    } else subpaths.at(-1).segments.push(segment)
  }
  const ends = [],
    parts = []
  for (const subpath of subpaths) {
    const entries = subpath.segments.map((segment) => ({
      segment,
      length: segment.kind === 'close' ? 0 : length(segment),
    }))
    const total = entries.reduce((sum, entry) => sum + entry.length, 0)
    if (subpath.closed || total === 0) {
      parts.push(`M ${n(subpath.start.x)} ${n(subpath.start.y)}`)
      parts.push(
        ...entries.map(({ segment }) => (segment.kind === 'close' ? 'Z' : commandString(segment)))
      )
      continue
    }
    const atDistance = (distance) => {
      let consumed = 0
      for (const entry of entries) {
        if (entry.length > 0 && consumed + entry.length >= distance)
          return pointAt(
            entry.segment,
            parameterAtLength(entry.segment, distance - consumed, entry.length)
          )
        consumed += entry.length
      }
      return entries.at(-1).segment.points.at(-1)
    }
    for (const [field, ink] of [
      ['headEnd', head],
      ['tailEnd', tail],
    ]) {
      if (!ink) continue
      const start = field === 'headEnd'
      const endpoint = start ? subpath.start : entries.at(-1).segment.points.at(-1)
      const inward = atDistance(start ? Math.min(ink.size, total) : Math.max(total - ink.size, 0))
      const dx = endpoint.x - inward.x,
        dy = endpoint.y - inward.y,
        norm = Math.hypot(dx, dy)
      // A returning curve may coincide at the finite chord; take a bounded,
      // shorter chord rather than inventing an angle or using a singular axis.
      let direction = { x: dx, y: dy },
        magnitude = norm
      if (magnitude === 0) {
        const near = atDistance(start ? total / 1024 : (total * 1023) / 1024)
        direction = { x: endpoint.x - near.x, y: endpoint.y - near.y }
        magnitude = Math.hypot(direction.x, direction.y)
      }
      if (magnitude > 0) {
        const x = direction.x / magnitude,
          y = direction.y / magnitude
        ends.push({ ...ink, end: field, transform: [x, y, -y, x, endpoint.x, endpoint.y].map(n) })
      }
    }
    const lower = Math.min(head?.consumed ?? 0, total)
    const upper = Math.max(lower, total - (tail?.consumed ?? 0))
    if (upper <= lower) continue
    let offset = 0,
      started = false
    for (const entry of entries) {
      const next = offset + entry.length
      if (entry.length > 0 && next > lower && offset < upper) {
        const from = parameterAtLength(entry.segment, Math.max(lower - offset, 0), entry.length)
        const to = parameterAtLength(
          entry.segment,
          Math.min(upper - offset, entry.length),
          entry.length
        )
        let clipped = entry.segment
        if (to < 1) clipped = split(clipped, to)[0]
        if (from > 0) clipped = split(clipped, from / to)[1]
        if (!started) {
          parts.push(`M ${n(clipped.points[0].x)} ${n(clipped.points[0].y)}`)
          started = true
        }
        parts.push(commandString(clipped))
      }
      offset = next
    }
  }
  return ends.length ? { strokeD: parts.join(' '), ends } : null
}
module.exports = { deriveNativeLineEnds }
