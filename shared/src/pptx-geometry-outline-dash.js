// Same DrawingML width-relative units as PRESET_DASH_PATTERNS in geometry-document.
// Kept independent of that module: it imports the outline for validation.
const patterns = {
  solid: [],
  dot: [1, 3],
  dash: [4, 3],
  dashDot: [4, 3, 1, 3],
  lgDash: [8, 3],
  lgDashDot: [8, 3, 1, 3],
  lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDot: [1, 1],
  sysDash: [3, 1],
  sysDashDot: [3, 1, 1, 1],
  sysDashDotDot: [3, 1, 1, 1, 1, 1],
}
function dashPattern(dash) {
  if (dash?.kind === 'preset')
    return Object.hasOwn(patterns, dash.value) ? patterns[dash.value] : null
  if (
    dash?.kind !== 'custom' ||
    !Array.isArray(dash.stops) ||
    !dash.stops.length ||
    dash.stops.length > 256
  )
    return null
  const values = dash.stops.flatMap((stop) => [stop?.dash, stop?.space])
  if (!values.every((n) => Number.isFinite(n) && n >= 0) || !values.some((n) => n > 0)) return null
  return values.map((n) => n / 100000)
}
const fail = () => {
  throw new RangeError('Unsupported native outline: dash precision or point budget')
}
function dashSubpath(subpath, pattern, width) {
  if (!pattern.length || subpath.points.length < 2) return [subpath]
  const points = subpath.closed ? [...subpath.points, subpath.points[0]] : subpath.points
  const lengths = [0]
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    )
  const total = lengths.at(-1),
    intervals = []
  let position = 0,
    step = 0
  while (position < total) {
    if (step > 262144) fail()
    const distance = pattern[step % pattern.length] * width
    const next = Math.min(total, position + distance)
    if (!Number.isFinite(distance) || (distance > 0 && !(next > position))) fail()
    if (step % 2 === 0) {
      if (intervals.length && intervals.at(-1)[1] === position) intervals.at(-1)[1] = next
      else intervals.push([position, next])
    }
    position = next
    step++
  }
  const locate = (distance) => {
    let lo = 0,
      hi = points.length - 1
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1
      if (lengths[mid] <= distance) lo = mid
      else hi = mid
    }
    const span = lengths[lo + 1] - lengths[lo]
    const tangent = {
      x: (points[lo + 1].x - points[lo].x) / span,
      y: (points[lo + 1].y - points[lo].y) / span,
    }
    return {
      index: lo,
      tangent,
      point: {
        x: points[lo].x + tangent.x * (distance - lengths[lo]),
        y: points[lo].y + tangent.y * (distance - lengths[lo]),
      },
    }
  }
  let count = 0
  const pieces = intervals.map(([start, end]) => {
    const a = locate(start),
      b = locate(end),
      part = [a.point],
      corners = new Set(),
      joins = new Map()
    const outgoing = start === lengths[a.index] ? subpath.joins.get(a.index)?.outgoing : a.tangent
    joins.set(0, { outgoing: outgoing || a.tangent })
    for (let i = a.index + 1; i < points.length && lengths[i] < end; i++) {
      if (subpath.corners.has(i)) corners.add(part.length)
      if (subpath.joins.has(i)) joins.set(part.length, subpath.joins.get(i))
      part.push(points[i])
    }
    if (end > start) {
      part.push(b.point)
      const incoming = end === lengths[b.index] ? subpath.joins.get(b.index)?.incoming : b.tangent
      joins.set(part.length - 1, { incoming: incoming || b.tangent })
    }
    count += part.length
    if (count > 131072) fail()
    return {
      points: part,
      corners,
      joins,
      closed: false,
      tangent: outgoing || a.tangent,
      dashed: true,
    }
  })
  // A dash crossing an authored closed seam has a join, not two independent caps.
  if (
    subpath.closed &&
    intervals[0]?.[0] === 0 &&
    intervals[0][1] > 0 &&
    intervals.at(-1)[1] === total &&
    intervals.at(-1)[0] < total
  ) {
    if (pieces.length === 1) return [subpath]
    const first = pieces.shift(),
      last = pieces.pop(),
      seam = last.points.length - 1
    const corners = new Set([...last.corners, seam, ...[...first.corners].map((i) => i + seam)])
    const joins = new Map([...last.joins, ...[...first.joins].map(([i, j]) => [i + seam, j])])
    joins.set(seam, subpath.joins.get(0))
    pieces.push({
      points: [...last.points, ...first.points.slice(1)],
      corners,
      joins,
      closed: false,
      dashed: true,
    })
  }
  return pieces
}
module.exports = { dashPattern, dashSubpath }
