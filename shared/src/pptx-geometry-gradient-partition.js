// Clip the generated vector contours before reflection, then rasterize the four
// cells as one compound path. Shared edges cancel in winding space; no separately
// antialiased cell masks or source-over coverage multiplication remain.
const TAU = 2 * Math.PI
function gradientContours(data) {
  const tokens = data.match(/[a-zA-Z]|[-+]?(?:\d*\.?\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const contours = []
  let index = 0,
    command,
    point = [0, 0],
    origin = point,
    contour
  const number = () => Number(tokens[index++])
  const line = (end) => {
    contour.push({ start: point, end })
    point = end
  }
  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) command = tokens[index++]
    if (command === 'M') {
      point = [number(), number()]
      origin = point
      contour = []
      contours.push(contour)
      command = 'L'
    } else if (command === 'L') line([number(), number()])
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
      if (rotation !== 0) throw new Error('Generated gradient arc must be axis aligned')
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
      const theta = Math.atan2((point[1] - cy) / ry, (point[0] - cx) / rx)
      let delta = Math.atan2((end[1] - cy) / ry, (end[0] - cx) / rx) - theta
      if (sweep && delta < 0) delta += TAU
      if (!sweep && delta > 0) delta -= TAU
      contour.push({ start: point, end, cx, cy, rx, ry, theta, delta })
      point = end
    } else throw new Error(`Unsupported generated gradient command: ${command}`)
  }
  return contours
}
function clipContour(contour, axis, boundary, sign) {
  const pieces = []
  let unchanged = true
  for (const segment of contour) {
    if (segment.delta === undefined) {
      const a = sign * (segment.start[axis] - boundary)
      const b = sign * (segment.end[axis] - boundary)
      if (a >= 0 && b >= 0) pieces.push(segment)
      else if (a >= 0 || b >= 0) {
        unchanged = false
        const t = a / (a - b)
        const crossing = segment.start.map((value, i) => value + t * (segment.end[i] - value))
        crossing[axis] = boundary
        pieces.push(
          a >= 0 ? { start: segment.start, end: crossing } : { start: crossing, end: segment.end }
        )
      }
      else unchanged = false
      continue
    }
    const at = (t) => {
      if (t === 0) return segment.start
      if (t === 1) return segment.end
      const angle = segment.theta + t * segment.delta
      return [segment.cx + segment.rx * Math.cos(angle), segment.cy + segment.ry * Math.sin(angle)]
    }
    const cuts = [0, 1]
    {
      const value = (boundary - (axis ? segment.cy : segment.cx)) / (axis ? segment.ry : segment.rx)
      if (Math.abs(value) <= 1) {
        const angle = axis ? Math.asin(value) : Math.acos(value)
        for (const root of axis ? [angle, Math.PI - angle] : [angle, -angle]) {
          const travel = (((Math.sign(segment.delta) * (root - segment.theta)) % TAU) + TAU) % TAU
          const t = travel / Math.abs(segment.delta)
          if (t > 0 && t < 1) cuts.push(t)
        }
      }
    }
    cuts.sort((a, b) => a - b)
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i]
      if (a === b || sign * (at((a + b) / 2)[axis] - boundary) < 0) {
        unchanged = false
        continue
      }
      if (a === 0 && b === 1) {
        pieces.push(segment)
        continue
      }
      unchanged = false
      const start = [...at(a)],
        end = [...at(b)]
      if (a > 0) start[axis] = boundary
      if (b < 1) end[axis] = boundary
      pieces.push({
        ...segment,
        start,
        end,
        theta: segment.theta + a * segment.delta,
        delta: (b - a) * segment.delta,
      })
    }
  }
  if (unchanged) return contour
  return pieces.flatMap((segment, i) => {
    const end = pieces[(i + 1) % pieces.length].start
    return [
      segment,
      ...(segment.end[0] === end[0] && segment.end[1] === end[1]
        ? []
        : [{ start: segment.end, end }]),
    ]
  })
}
function reflectedPath(data, diameter) {
  const contours = gradientContours(data)
    .map((contour) => {
      for (const [axis, boundary, sign] of [
        [0, 0, 1],
        [0, diameter, -1],
        [1, 0, 1],
        [1, diameter, -1],
      ])
        contour = clipContour(contour, axis, boundary, sign)
      return contour
    })
    .filter((contour) => contour.length > 0)
  // Clipping is complete: shared endpoint arrays stay unchanged during emission.
  // Keep decimal metadata local to this path, not to a gradient or import.
  const decimalMetadata = new WeakMap()
  const decimalPlaces = (point) => {
    let places = decimalMetadata.get(point)
    if (!places) {
      places = point.map((value) => {
        const [mantissa, exponent = '0'] = String(value).split('e')
        return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent))
      })
      decimalMetadata.set(point, places)
    }
    return places
  }
  for (const contour of contours) {
    for (const segment of contour) {
      if (segment.delta !== undefined) continue
      const startPlaces = decimalPlaces(segment.start),
        endPlaces = decimalPlaces(segment.end)
      segment.relative = segment.end.map((value, axis) => {
        const places = Math.max(startPlaces[axis], endPlaces[axis])
        const delta = value - segment.start[axis]
        return places <= 12 ? Number(delta.toFixed(places)) : delta
      })
    }
  }
  return [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ]
    .map(([sx, sy]) => {
      const point = ([x, y]) =>
        `${sx === 1 ? x : 2 * diameter - x} ${sy === 1 ? y : 2 * diameter - y}`
      const reverse = sx * sy < 0
      return contours
        .map((original) => {
          const contour = reverse ? [...original].reverse() : original
          return (
            `M${point(reverse ? contour[0].end : contour[0].start)}` +
            contour
              .map((segment) => {
                const end = point(reverse ? segment.start : segment.end)
                if (segment.delta === undefined) {
                  const relative = segment.relative
                    .map((value, axis) => value * (reverse ? -1 : 1) * (axis ? sy : sx))
                    .join(' ')
                  return relative.length < end.length ? `l${relative}` : `L${end}`
                }
                // Reversing odd reflections keeps the original winding orientation.
                return `A${segment.rx} ${segment.ry} 0 ${Math.abs(segment.delta) > Math.PI ? 1 : 0} ${segment.delta > 0 ? 1 : 0} ${end}`
              })
              .join('') +
            'Z'
          )
        })
        .join('')
    })
    .join('')
}
function reflectGradientGeometry(markup, diameter, shared) {
  return markup.replace(
    /<(path|ellipse|circle|rect|polygon)\b([^>]*?)\/>/g,
    (_tag, name, attributes) => {
      const values = Object.fromEntries(
        [...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => match.slice(1))
      )
      const number = (key) => Number(values[key] ?? 0)
      let data = values.d
      if (name === 'ellipse' || name === 'circle') {
        const x = number('cx'),
          y = number('cy'),
          rx = number(name === 'circle' ? 'r' : 'rx'),
          ry = number(name === 'circle' ? 'r' : 'ry')
        data =
          rx > 0 && ry > 0
            ? `M${x + rx} ${y}A${rx} ${ry} 0 1 1 ${x - rx} ${y}A${rx} ${ry} 0 1 1 ${x + rx} ${y}Z`
            : ''
      } else if (name === 'rect') {
        const x = number('x'),
          y = number('y'),
          w = number('width'),
          h = number('height')
        data = w > 0 && h > 0 ? `M${x} ${y}H${x + w}V${y + h}H${x}Z` : ''
      } else if (name === 'polygon') data = `M${values.points}Z`
      const retained = Object.entries(values)
        .filter(
          ([key]) =>
            !['d', 'cx', 'cy', 'rx', 'ry', 'r', 'x', 'y', 'width', 'height', 'points'].includes(key)
        )
        .map(([key, value]) => ` ${key}="${value}"`)
        .join('')
      let key = shared?.paths.get(data)
      if (key) return `<use href="#${key}" transform="matrix(1 0 0 1 0 0)"${retained}/>`
      const reflected = reflectedPath(data, diameter)
      if (!reflected) return ''
      if (shared) {
        key = `${shared.id}-contour-${shared.paths.size}`
        shared.paths.set(data, key)
        shared.definitions.push(`<path id="${key}" d="${reflected}"/>`)
        return `<use href="#${key}" transform="matrix(1 0 0 1 0 0)"${retained}/>`
      }
      return `<path d="${reflected}"${retained}/>`
    }
  )
}
module.exports = { reflectGradientGeometry, reflectedPath }
