// Overlap follows boundary-angle order, starting at the rightmost outer vertex.
// Geometry is source-derived; no device-space sampling constants.
function focusFanClips({ radius, focus, id }) {
  const diameter = radius * 2
  const polygon = []
  if (
    focus.cx === radius &&
    focus.cy === radius &&
    focus.rx >= 0 &&
    focus.ry >= 0 &&
    (focus.rx - radius) * (focus.ry - radius) < 0
  ) {
    // Along crossing concentric axes, the later angle selects the exit root
    // in alternating quadrants. Swap those quadrants for a taller focus.
    polygon.push(
      ...[
        [radius, radius],
        [diameter, radius],
        [diameter, 0],
        [radius, 0],
        [radius, radius],
        [0, radius],
        [0, diameter],
        [radius, diameter],
      ].map(([x, y]) => [focus.rx > radius ? x : diameter - x, y])
    )
  } else if (
    focus.rx === 0 &&
    focus.ry === 0 &&
    Math.hypot(focus.cx - radius, focus.cy - radius) > radius
  ) {
    const vx = diameter - focus.cx,
      vy = radius - focus.cy
    const side = ([x, y]) => vx * (y - focus.cy) - vy * (x - focus.cx)
    const square = [
      [0, 0],
      [diameter, 0],
      [diameter, diameter],
      [0, diameter],
    ]
    for (let index = 0; index < square.length; index++) {
      const start = square[index],
        end = square[(index + 1) % square.length],
        a = side(start),
        b = side(end)
      if (a >= 0) polygon.push(start)
      if (a >= 0 !== b >= 0) {
        const ratio = a / (a - b)
        polygon.push(start.map((value, axis) => value + (end[axis] - value) * ratio))
      }
    }
  } else return ''
  const points = polygon.map((point) => point.join(',')).join(' ')
  const outside = `M0 0H${diameter}V${diameter}H0Z M${radius} 0 A${radius} ${radius} 0 1 0 ${radius} ${diameter} A${radius} ${radius} 0 1 0 ${radius} 0Z`
  return `<clipPath id="${id}-fan"><polygon points="${points}"/></clipPath><clipPath id="${id}-fan-outside"><path clip-rule="evenodd" d="${outside}"/></clipPath>`
}
function focusHull({ radius, focus, channels }) {
  const px = radius + (focus.cx - radius) / (1 - focus.rx / radius),
    py = radius + (focus.cy - radius) / (1 - focus.ry / radius),
    x = (px - focus.cx) / focus.rx,
    y = (py - focus.cy) / focus.ry,
    distance = Math.hypot(x, y),
    fill = `fill="rgb(${channels.join(',')})"`
  const ellipse = `<ellipse cx="${focus.cx}" cy="${focus.cy}" rx="${focus.rx}" ry="${focus.ry}" ${fill}/>`
  if (distance <= 1) return ellipse
  const angle = Math.atan2(y, x),
    tangent = Math.acos(1 / distance)
  const point = (a) =>
    [focus.cx + focus.rx * Math.cos(a), focus.cy + focus.ry * Math.sin(a)].join(' ')
  // Affine image of the unit-disk tangent hull, not the outer circle's hull.
  return `<path d="M${point(angle + tangent)} A${focus.rx} ${focus.ry} 0 1 1 ${point(angle - tangent)} L${px} ${py} Z" ${fill}/>${ellipse}`
}
module.exports = { focusFanClips, focusHull }
