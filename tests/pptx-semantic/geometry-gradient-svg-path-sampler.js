// Exact ray crossings for the emitted SVG M/L/H/V/A/Z geometry. Canvas Path2D
// flattens ellipse arcs and can put close one-sided stop witnesses on both sides.
export function compileGradientPath(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g)
  const segments = []
  let i = 0,
    command,
    point = [0, 0],
    origin = point
  const number = () => Number(tokens[i++])
  const line = (end) => {
    segments.push({ start: point, end })
    point = end
  }
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++]
    if (command === 'M') {
      point = [number(), number()]
      origin = point
      command = 'L'
    } else if (command === 'L') line([number(), number()])
    else if (command === 'l') line([point[0] + number(), point[1] + number()])
    else if (command === 'H') line([number(), point[1]])
    else if (command === 'V') line([point[0], number()])
    else if (command === 'Z') line(origin)
    else if (command === 'A') {
      let rx = Math.abs(number()),
        ry = Math.abs(number())
      const rotation = number(),
        large = number(),
        sweep = number(),
        end = [number(), number()]
      if (rotation !== 0) throw new Error('Unsupported sampler arc rotation')
      if (rx === 0 || ry === 0) {
        line(end)
        continue
      }
      if (point[0] === end[0] && point[1] === end[1]) continue
      let x = (point[0] - end[0]) / (2 * rx),
        y = (point[1] - end[1]) / (2 * ry)
      const length = Math.hypot(x, y)
      if (length > 1) {
        rx *= length
        ry *= length
        x /= length
        y /= length
      }
      const factor = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, 1 / (x * x + y * y) - 1))
      const cx = (point[0] + end[0]) / 2 + factor * rx * y
      const cy = (point[1] + end[1]) / 2 - factor * ry * x
      const start = Math.atan2((point[1] - cy) / ry, (point[0] - cx) / rx)
      const finish = Math.atan2((end[1] - cy) / ry, (end[0] - cx) / rx)
      let delta = finish - start
      if (sweep && delta < 0) delta += 2 * Math.PI
      if (!sweep && delta > 0) delta -= 2 * Math.PI
      segments.push({ cx, cy, rx, ry, start, delta })
      point = end
    } else throw new Error(`Unsupported sampler path command: ${command}`)
  }
  return (x, y, rule) => {
    let winding = 0
    for (const segment of segments) {
      if (segment.end) {
        const [a, b] = segment.start,
          [c, d] = segment.end
        if ((b <= y && y < d) || (d <= y && y < b))
          if (a + ((c - a) * (y - b)) / (d - b) > x) winding += d > b ? 1 : -1
      } else {
        const { cx, cy, rx, ry, start, delta } = segment,
          sine = (y - cy) / ry
        if (Math.abs(sine) >= 1) continue // A tangent touches but does not cross.
        const angle = Math.asin(sine)
        for (const theta of [angle, Math.PI - angle]) {
          const direction = Math.sign(Math.cos(theta) * delta)
          const travel =
            (((Math.sign(delta) * (theta - start)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
          const span = Math.abs(delta)
          const atStart = travel < 1e-12 || 2 * Math.PI - travel < 1e-12
          const atEnd = Math.abs(travel - span) < 1e-12
          const within = atStart ? direction > 0 : atEnd ? direction < 0 : travel < span
          if (within && cx + rx * Math.cos(theta) > x) winding += direction
        }
      }
    }
    return rule === 'evenodd' ? Math.abs(winding) % 2 === 1 : winding !== 0
  }
}
