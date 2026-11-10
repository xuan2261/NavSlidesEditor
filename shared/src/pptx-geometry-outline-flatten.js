const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })
const dot = (a, b) => a.x * b.x + a.y * b.y
const norm = (p) => Math.hypot(p.x, p.y)
const mix = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
function segmentTangents(segment) {
  const points = segment.points
  const unit = (v) => (norm(v) ? { x: v.x / norm(v), y: v.y / norm(v) } : null)
  if (segment.kind === 'arcTo')
    return [segment.angle, segment.angle + segment.sweep].map((angle) =>
      unit({
        x: -segment.radii[0] * Math.sin(angle) * Math.sign(segment.sweep),
        y: segment.radii[1] * Math.cos(angle) * Math.sign(segment.sweep),
      })
    )
  const first = points
    .slice(1)
    .map((p) => subtract(p, points[0]))
    .find((p) => norm(p))
  const last = points
    .slice(0, -1)
    .reverse()
    .map((p) => subtract(points.at(-1), p))
    .find((p) => norm(p))
  return [first && unit(first), last && unit(last)]
}
// The derivative hull bounds the tangent cone; the Bezier hull bounds chord error.
// A length budget also bounds accumulated dash phase, not just positional error.
function flatten(
  segment,
  append,
  radius,
  tolerance,
  sensitivity,
  lengthBudget = Infinity,
  depth = 0,
  first = true,
  last = true
) {
  const points = segment.points,
    a = points[0],
    b = points.at(-1),
    chord = subtract(b, a)
  if (segment.kind === 'lnTo' || segment.kind === 'close') return append(b)
  let vectors, deviation
  if (segment.kind === 'arcTo') {
    const [rx, ry] = segment.radii,
      angle = segment.angle,
      sweep = segment.sweep
    if (![rx, ry, angle, sweep].every(Number.isFinite) || rx <= 0 || ry <= 0)
      throw new RangeError('Unsupported native outline: arc')
    const tangent = (t) => ({
      x: -rx * Math.sin(t) * Math.sign(sweep),
      y: ry * Math.cos(t) * Math.sign(sweep),
    })
    vectors = [tangent(angle), tangent(angle + sweep)]
    deviation = Math.abs(sweep) <= Math.PI / 2 ? (Math.max(rx, ry) * sweep * sweep) / 8 : Infinity
  } else if (['quadBezTo', 'cubicBezTo'].includes(segment.kind)) {
    vectors = points
      .slice(1)
      .map((p, i) => subtract(p, points[i]))
      .filter((p) => norm(p) > 0)
    if (!vectors.length) return append(b)
    const lengthSquared = dot(chord, chord)
    deviation = Math.max(
      ...points.map((p) => {
        const t = lengthSquared
          ? Math.max(0, Math.min(1, dot(subtract(p, a), chord) / lengthSquared))
          : 0
        return norm(subtract(p, { x: a.x + chord.x * t, y: a.y + chord.y * t }))
      })
    )
  } else throw new RangeError('Unsupported native outline: segment kind')
  const cone = Math.max(
    ...vectors.map((v) => {
      const forward = dot(chord, v)
      return forward > 0 ? Math.abs(chord.x * v.y - chord.y * v.x) / forward : Infinity
    })
  )
  // If every derivative lies within this forward cone, L <= chord / cos(theta).
  const excess = (norm(chord) * cone * cone) / (Math.sqrt(1 + cone * cone) + 1)
  if (
    cone <= 0.1 &&
    deviation + radius * (first || last ? sensitivity : 2) * cone <= tolerance / 2 &&
    excess <= lengthBudget
  )
    return append(b)
  if (depth >= 30)
    throw new RangeError('Unsupported native outline: curve cusp or subdivision budget')
  // Accepted leaves never consume child segments. Construct the identical
  // subdivisions only after the existing error and depth checks require them.
  let halves
  if (segment.kind === 'arcTo') {
    const [rx, ry] = segment.radii,
      angle = segment.angle,
      sweep = segment.sweep
    const middle = {
      x: segment.center.x + rx * Math.cos(angle + sweep / 2),
      y: segment.center.y + ry * Math.sin(angle + sweep / 2),
    }
    halves = [
      { ...segment, points: [a, middle], sweep: sweep / 2 },
      { ...segment, points: [middle, b], angle: angle + sweep / 2, sweep: sweep / 2 },
    ]
  } else {
    let row = points
    const left = [a],
      right = [b]
    while (row.length > 1) {
      row = row.slice(1).map((p, i) => mix(row[i], p))
      left.push(row[0])
      right.unshift(row.at(-1))
    }
    halves = [
      { ...segment, points: left },
      { ...segment, points: right },
    ]
  }
  flatten(
    halves[0],
    append,
    radius,
    tolerance,
    sensitivity,
    lengthBudget / 2,
    depth + 1,
    first,
    false
  )
  flatten(
    halves[1],
    append,
    radius,
    tolerance,
    sensitivity,
    lengthBudget / 2,
    depth + 1,
    false,
    last
  )
}
function closeSubpath(current, tolerance) {
  current.closed = true
  const points = current.points
  const pop = () => {
    const end = current.joins.get(points.length - 1)
    current.joins.set(0, {
      ...current.joins.get(0),
      incoming: end?.incoming,
      incomingCurve: end?.incomingCurve,
    })
    points.pop()
  }
  if (points.length > 1 && points[0].x === points.at(-1).x && points[0].y === points.at(-1).y) pop()
  const first = current.firstSegment,
    last = current.lastSegment
  if (first?.kind !== 'arcTo' || last?.kind !== 'arcTo' || points.length <= 2) return
  const roundoff =
    32 *
    Number.EPSILON *
    Math.max(
      1,
      Math.abs(points[0].x),
      Math.abs(points[0].y),
      ...first.radii,
      ...last.radii,
      Math.abs(first.center.x),
      Math.abs(first.center.y),
      Math.abs(last.center.x),
      Math.abs(last.center.y)
    )
  const tangent = (arc, angle) => {
    const p = {
      x: -arc.radii[0] * Math.sin(angle) * Math.sign(arc.sweep),
      y: arc.radii[1] * Math.cos(angle) * Math.sign(arc.sweep),
    }
    return { x: p.x / norm(p), y: p.y / norm(p) }
  }
  // Retain authored short edges. Coalesce only a complete analytic ellipse
  // with matching endpoint tangents and roundoff below the existing budget.
  if (
    roundoff <= tolerance / 32 &&
    first.radii.every((radius, index) => radius === last.radii[index]) &&
    norm(subtract(first.center, last.center)) <= roundoff &&
    norm(subtract(points[0], points.at(-1))) <= roundoff &&
    norm(subtract(tangent(first, first.angle), tangent(last, last.angle + last.sweep))) <=
      32 * Number.EPSILON
  )
    pop()
}
module.exports = { flatten, closeSubpath, segmentTangents }
