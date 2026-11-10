// Vector images of source parameter ranges, split at the analytic fold.
// Only the caustic is flattened; color-stop boundaries remain exact ellipse arcs.
function polynomialRoots(coefficients) {
  while (coefficients.length > 1 && coefficients.at(-1) === 0) coefficients.pop()
  if (coefficients.length === 1) return []
  const scale = Math.max(...coefficients.map(Math.abs))
  const c = coefficients.map((value) => value / scale)
  const value = (x) => c.reduceRight((sum, coefficient) => sum * x + coefficient, 0)
  const stationary = polynomialRoots(c.slice(1).map((coefficient, i) => coefficient * (i + 1)))
  const divisions = [-1, ...stationary, 1],
    roots = []
  for (const x of divisions) if (Math.abs(value(x)) < 1e-13) roots.push(x)
  for (let i = 1; i < divisions.length; i++) {
    let a = divisions[i - 1],
      b = divisions[i],
      fa = value(a)
    if (fa * value(b) >= 0) continue
    for (let step = 0; step < 52; step++) {
      const middle = (a + b) / 2,
        fm = value(middle)
      if (fa * fm <= 0) b = middle
      else {
        a = middle
        fa = fm
      }
    }
    roots.push((a + b) / 2)
  }
  return [...new Set(roots)].sort((a, b) => a - b)
}

function ellipseSweep({ radius: r, focus: f, bands, id }) {
  const dx = r - f.cx,
    dy = r - f.cy,
    ax = r - f.rx,
    ay = r - f.ry
  const level = (t) => [f.rx + ax * t, f.ry + ay * t, f.cx + dx * t, f.cy + dy * t]
  const point = (t, angle) => {
    const [a, b, x, y] = level(t)
    return [x + a * Math.cos(angle), y + b * Math.sin(angle)]
  }
  const jacobian = (t, angle) => {
    const [a, b] = level(t),
      c = Math.cos(angle),
      s = Math.sin(angle)
    return b * dx * c + a * dy * s + ax * b * c * c + ay * a * s * s
  }
  // Prefixes all start at zero; suffixes all end at one. Critical angles
  // depend only on the level, not the interval being painted. Keep the exact
  // roots local to this sweep and never alter their order or precision.
  const criticalLevels = new Map()
  const critical = (t) => {
    if (criticalLevels.has(t)) return criticalLevels.get(t)
    const [a, b] = level(t),
      c = ax * b,
      d = ay * a
    const angles = [0, Math.PI].flatMap((origin) => {
      const sign = origin === 0 ? 1 : -1,
        u = sign * b * dx,
        v = sign * a * dy
      // tan((theta-origin)/2) on [-1,1] avoids an unbounded quartic root chart.
      return polynomialRoots([u + c, 2 * v, -2 * c + 4 * d, 2 * v, -u + c]).map(
        (z) => (origin + 2 * Math.atan(z) + 2 * Math.PI) % (2 * Math.PI)
      )
    })
    criticalLevels.set(t, angles)
    return angles
  }
  const image = (t0, t1) => {
    const paths = ['', '']
    const angles = [0, Math.PI, 2 * Math.PI, ...critical(t0), ...critical(t1)]
      .sort((a, b) => a - b)
      .filter((angle, i, all) => i === 0 || angle - all[i - 1] > 1e-12)
    const fold = (angle) => {
      const j0 = jacobian(0, angle),
        j1 = ay * dx * Math.cos(angle) + ax * dy * Math.sin(angle) + ax * ay
      return -j0 / j1
    }
    const caustic = (angle) => {
      const t = fold(angle)
      // At a stationary ruling J0=J1=0, X is independent of t.
      return point(Number.isNaN(t) ? t0 : Math.max(t0, Math.min(t1, t)), angle)
    }
    const unrounded = new WeakSet()
    const flatten = (a, b, pa, pb, depth = 0) => {
      const middle = (a + b) / 2,
        pm = caustic(middle),
        vx = pb[0] - pa[0],
        vy = pb[1] - pa[1],
        lengthSquared = vx * vx + vy * vy
      // Relative source-space tolerance, independent of display size or pixels.
      const error = Math.max(
        ...[0.25, 0.5, 0.75].map((fraction) => {
          const p = fraction === 0.5 ? pm : caustic(a + (b - a) * fraction)
          const ux = p[0] - pa[0],
            uy = p[1] - pa[1],
            along =
              lengthSquared === 0
                ? 0
                : Math.max(0, Math.min(1, (ux * vx + uy * vy) / lengthSquared))
          return Math.hypot(ux - along * vx, uy - along * vy)
        })
      )
      // Reserve part of the existing R*1e-6 error bound for decimal encoding.
      if (error <= r * 0.9e-6) return [pa, pb]
      if (depth === 10) {
        // Do not add encoding error where the inherited subdivision cap binds.
        unrounded.add(pa)
        unrounded.add(pb)
        return [pa, pb]
      }
      return [
        ...flatten(a, middle, pa, pm, depth + 1).slice(0, -1),
        ...flatten(middle, b, pm, pb, depth + 1),
      ]
    }
    for (let i = 1; i < angles.length; i++) {
      const a = angles[i - 1],
        b = angles[i],
        middle = (a + b) / 2,
        tf = fold(middle)
      const curve = tf > t0 && tf < t1 ? flatten(a, b, caustic(a), caustic(b)) : null
      const boundary = (t, reverse) => {
        if (t === null) {
          const points = reverse ? [...curve].reverse() : curve
          const digits = Math.max(0, -Math.floor(Math.log10(r * 1e-7)))
          return [
            points[0].join(' '),
            points
              .slice(1)
              // Only interior caustic vertices are flattened/quantized. Exact
              // ellipse endpoints, stop arcs, hulls and tile periods stay exact.
              // Euclidean rounding error is <= sqrt(2)/2 * R*1e-7, so the
              // combined bound stays below the previous R*1e-6 tolerance.
              .map(
                (p, index) =>
                  `L${(index === points.length - 2 || unrounded.has(p) ? p : p.map((v) => Number(v.toFixed(digits)))).join(' ')}`
              )
              .join(''),
          ]
        }
        const [rx, ry] = level(t),
          start = reverse ? b : a,
          end = reverse ? a : b
        return [
          point(t, start).join(' '),
          `A${rx} ${ry} 0 0 ${reverse ? 0 : 1} ${point(t, end).join(' ')}`,
        ]
      }
      for (const [lo, hi] of curve
        ? [
            [t0, null],
            [null, t1],
          ]
        : [[t0, t1]]) {
        // All subpaths use the same winding so overlapping fold sheets unite.
        const reverse = jacobian(((lo ?? tf) + (hi ?? tf)) / 2, middle) < 0
        const lower = boundary(lo, reverse),
          upper = boundary(hi, !reverse)
        paths[middle < Math.PI ? 0 : 1] += `M${lower[0]}${lower[1]}L${upper[0]}${upper[1]}Z`
      }
    }
    return paths
  }
  const halves = [[], []]
  let t0 = 0
  for (const band of bands) {
    const prefix = image(0, band.t),
      suffix = image(t0, 1)
    halves.forEach((half, index) =>
      half.push({ ...band, prefix: prefix[index], suffix: suffix[index] })
    )
    t0 = band.t
  }
  const px = f.cx - (dx * f.rx) / ax,
    cut = Math.max(0, Math.min(2 * r, px))
  const definitions = [0, 1]
    .map(
      (side) =>
        `<clipPath id="${id}-sweep-${side}"><rect x="${side ? cut : 0}" y="0" width="${side ? 2 * r - cut : cut}" height="${2 * r}"/></clipPath>`
    )
    .join('')
  const ink = (channels) =>
    halves
      .map((half, hemisphere) =>
        [0, 1]
          .map((side) => {
            if ((side ? 2 * r - cut : cut) === 0) return ''
            // cos(theta(t))' = -(dx*rx + ax*(x-cx))/a(t)^2.
            // Lower-half angle increases with t when that numerator is positive;
            // upper-half angle has the opposite order and always paints after lower.
            const increasing = (side ? ax : -ax) * (hemisphere ? -1 : 1) > 0
            const ordered = increasing ? half : [...half].reverse()
            return `<g clip-path="url(#${id}-sweep-${side})">${ordered
              // Cover later passes underneath their boundaries, rather than
              // compositing independent antialiased ribbons against transparency.
              .map(
                (band) =>
                  `<path d="${band[increasing ? 'suffix' : 'prefix']}" fill="rgb(${channels(band).join(',')})"/>`
              )
              .join('')}</g>`
          })
          .join('')
      )
      .join('')
  return { definitions, ink }
}

module.exports = { ellipseSweep }
