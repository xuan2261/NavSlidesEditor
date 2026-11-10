const dot = (a, b) => a.x * b.x + a.y * b.y
const cross = (a, b) => a.x * b.y - a.y * b.x
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
const normal = (t) => ({ x: -t.y, y: t.x })
const offset = (p, n, d) => ({ x: p.x + n.x * d, y: p.y + n.y * d })
const fail = (reason) => {
  throw new RangeError(`Unsupported native outline: ${reason}`)
}
// Circular chords have sagitta <= tolerance/8. Include cardinal angles exactly
// so axis-aligned endpoint bounds are not dependent on subdivision parity.
function arc(center, from, sweep, tolerance) {
  const radius = Math.hypot(from.x - center.x, from.y - center.y)
  if (!radius || !sweep) return [from]
  const start = Math.atan2(from.y - center.y, from.x - center.x)
  const step = Math.min(Math.PI / 2, Math.sqrt(tolerance / radius))
  const count = Math.ceil(Math.abs(sweep) / step)
  if (!Number.isFinite(count) || count > 131072) fail('round subdivision budget')
  const fractions = Array.from({ length: count + 1 }, (_, i) => i / count)
  for (let k = -8; k <= 8; k++) {
    const t = ((k * Math.PI) / 2 - start) / sweep
    if (t > 0 && t < 1) fractions.push(t)
  }
  return fractions
    .sort((a, b) => a - b)
    .map((t) => ({
      x: center.x + radius * Math.cos(start + sweep * t),
      y: center.y + radius * Math.sin(start + sweep * t),
    }))
}
// A dash piece has the same chord directions for every compound band.
function sweepEdges({ points, closed }) {
  const edges = points.slice(0, closed ? points.length : -1).map((p, i) => {
    const d = subtract(points[(i + 1) % points.length], p),
      length = Math.hypot(d.x, d.y)
    if (!length) fail('zero edge')
    return { x: d.x / length, y: d.y / length }
  })
  // The two boundaries of every compound band use the same exact frame.
  // Populate lazily to preserve the original reversal-check ordering.
  edges.frames = []
  return edges
}
function sweepBand(
  { points, closed, corners, joins, tangent, dashed },
  edges,
  interval,
  stroke,
  width,
  tolerance
) {
  const [low, high] = interval.map((v) => (v + (stroke.alignment === 'in' ? 0.5 : 0)) * width)
  const radius = (high - low) / 2
  if (points.length < 2) {
    if (!tangent || stroke.cap === 'flat') return { polygons: [] }
    const n = { x: -tangent.y, y: tangent.x },
      center = offset(points[0], n, (low + high) / 2)
    if (stroke.cap === 'rnd')
      return { polygons: [arc(center, offset(center, n, -radius), 2 * Math.PI, tolerance)] }
    return {
      polygons: [
        [
          offset(offset(center, n, -radius), tangent, -radius),
          offset(offset(center, n, -radius), tangent, radius),
          offset(offset(center, n, radius), tangent, radius),
          offset(offset(center, n, radius), tangent, -radius),
        ],
      ],
    }
  }
  const boundary = (distance) =>
    points.map((p, i) => {
      let frame = edges.frames[i]
      if (!frame) {
        const prev = joins.get(i)?.incoming || edges[(i + edges.length - 1) % edges.length],
          next = joins.get(i)?.outgoing || edges[i % edges.length]
        frame = { prev, next }
        edges.frames[i] = frame
      }
      const { prev, next } = frame
      if (!closed && (i === 0 || i === points.length - 1)) {
        const t = i === 0 ? next : prev
        return [offset(p, normal(t), distance)]
      }
      if (frame.denominator === undefined) {
        frame.denominator = 1 + dot(prev, next)
        frame.turn = cross(prev, next)
      }
      const { denominator, turn } = frame
      if (denominator <= 0) fail('miter limit or reversal')
      const miterNormal = frame.miterNormal ??= {
        x: -(prev.y + next.y) / denominator,
        y: (prev.x + next.x) / denominator,
      }
      const miter = offset(p, miterNormal, distance)
      // Only authored corners use the join style. Subdivision vertices approximate
      // a smooth offset, and must not introduce bevel cuts or round scallops.
      if (!corners.has(i) || distance * turn >= 0 || turn === 0) return [miter]
      const from = offset(p, normal(prev), distance),
        to = offset(p, normal(next), distance)
      if (stroke.join.kind === 'miter' &&
          (frame.ratio ??= Math.sqrt(2 / denominator)) <= stroke.join.limit / 100000) return [miter]
      if (stroke.join.kind === 'round') {
        const curve = arc(p, from, Math.atan2(turn, dot(prev, next)), tolerance)
        curve[0] = from
        curve[curve.length - 1] = to
        return curve
      }
      return [from, to]
    })
  const boundaries = [boundary(low), boundary(high)]
  // Smooth offset folds remain unsupported. Authored corner intersections may
  // trim curve leaves or dash endpoints; regularize their signed strip alone.
  const folded = new Set()
  for (const side of boundaries)
    for (let i = 0; i < edges.length; i++) {
      const from = side[i].at(-1), to = side[(i + 1) % points.length][0]
      if ((to.x - from.x) * edges[i].x + (to.y - from.y) * edges[i].y < -tolerance / 32) {
        if (
          (dashed && (i === 0 || i === edges.length - 1)) ||
          joins.get(i)?.outgoingCurve ||
          joins.get((i + 1) % points.length)?.incomingCurve
        )
          folded.add(i)
        else fail('locally folded offset')
      }
    }
  const [a, b] = boundaries.map((side) => side.flat())
  let polygons = closed ? [a, [...b].reverse()] : [[...a, ...[...b].reverse()]]
  const signedPolygons = []
  if (folded.size) {
    // A single signed strip can erase a remote positive branch of the SAME
    // dash. Split at edge/join cells before resolving any negative winding.
    polygons = []
    for (let i = 0; i < edges.length; i++) {
      const j = (i + 1) % points.length
      const cell = [
        boundaries[0][i].at(-1),
        boundaries[0][j][0],
        boundaries[1][j][0],
        boundaries[1][i].at(-1),
      ]
      if (folded.has(i)) signedPolygons.push(cell)
      else {
        // Adjacent ordinary cells share an exact reversed edge. Keep join
        // expansions and folded cells separate; only cancel those shared edges.
        const upper = [cell[0], cell[1]], lower = [cell[3], cell[2]]
        while (i + 1 < edges.length && !folded.has(i + 1) &&
          boundaries[0][i + 1].length === 1 && boundaries[1][i + 1].length === 1) {
          i += 1
          const end = (i + 1) % points.length
          upper.push(boundaries[0][end][0])
          lower.push(boundaries[1][end][0])
        }
        polygons.push([...upper, ...lower.reverse()])
      }
    }
    for (let i = 0; i < points.length; i++)
      if (boundaries[0][i].length > 1 || boundaries[1][i].length > 1)
        polygons.push([...boundaries[0][i], ...[...boundaries[1][i]].reverse()])
  }
  if (closed) return { polygons, signedPolygons }
  const cap = (at, direction, from, to, sign) => {
    if (stroke.cap === 'flat') return []
    if (stroke.cap === 'sq')
      return [
        [from, offset(from, direction, sign * radius), offset(to, direction, sign * radius), to],
      ]
    const center = offset(at, { x: -direction.y, y: direction.x }, (low + high) / 2)
    const curve = arc(center, from, Math.PI, tolerance)
    curve[0] = from
    curve[curve.length - 1] = to
    return [curve]
  }
  // Caps are positive coverage primitives. Keeping them outside signed-strip
  // regularization prevents a folded inner boundary from erasing its own cap.
  const caps = [
    ...cap(
      points.at(-1),
      joins.get(points.length - 1)?.incoming || edges.at(-1),
      a.at(-1),
      b.at(-1),
      1
    ),
    ...cap(points[0], joins.get(0)?.outgoing || edges[0], b[0], a[0], -1),
  ]
  return { polygons, signedPolygons, caps }
}
module.exports = { sweepEdges, sweepBand }
