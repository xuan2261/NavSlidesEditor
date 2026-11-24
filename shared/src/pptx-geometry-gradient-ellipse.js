// Derived vector level sets. Canonical stops and focal declarations stay untouched.
const { focusFanClips, focusHull } = require('./pptx-geometry-gradient-fan')
const { ellipseSweep } = require('./pptx-geometry-gradient-sweep')
const { reflectGradientGeometry } = require('./pptx-geometry-gradient-partition')
function ellipseGradientBands(paint) {
  const source = [{ ...paint[0], pos: 0 }, ...paint, { ...paint.at(-1), pos: 1 }]
  const bands = []
  for (let index = 0; index < source.length - 1; index++) {
    const start = source[index],
      end = source[index + 1]
    if (end.pos <= start.pos) continue
    const p0 = start.rgb.map((channel) => (channel * start.alpha) / 255),
      p1 = end.rgb.map((channel) => (channel * end.alpha) / 255),
      delta = p0.map((channel, component) => p1[component] - channel),
      alphaDelta = end.alpha - start.alpha
    // Midpoint samples bound each smooth premultiplied channel to half a code.
    const count = Math.max(1, Math.ceil(Math.max(Math.abs(alphaDelta), ...delta.map(Math.abs))))
    for (let sample = 1; sample <= count; sample++) {
      const ratio = (sample - 0.5) / count
      bands.push({
        t: start.pos + ((end.pos - start.pos) * sample) / count,
        alpha: start.alpha + alphaDelta * ratio,
        premultiplied: p0.map((channel, component) => channel + delta[component] * ratio),
      })
    }
  }
  return bands
}
function ellipseGradientSvgDefinition({ radius, focus, paint, id, reflected = false }) {
  const first = paint[0],
    saturated = focus.rx === focus.ry && focus.rx >= radius,
    firstPremultiplied = first.rgb.map((channel) => (channel * first.alpha) / 255)
  if (saturated && focus.rx > radius) {
    // C = P + s(O-P) for the focal boundary. When s > 1, the native fan
    // includes external P as well as the focal disk, not just level-set disks.
    const r = focus.rx,
      ratio = radius / (r - radius),
      px = radius + (radius - focus.cx) * ratio,
      py = radius + (radius - focus.cy) * ratio,
      distance = Math.hypot(px - focus.cx, py - focus.cy),
      fill = `fill="rgb(${first.rgb.join(',')})"`
    let outline = `<ellipse cx="${focus.cx}" cy="${focus.cy}" rx="${r}" ry="${r}" ${fill}/>`
    if (distance > r) {
      const angle = Math.atan2(py - focus.cy, px - focus.cx),
        tangent = Math.acos(r / distance),
        point = (a) => [focus.cx + r * Math.cos(a), focus.cy + r * Math.sin(a)].join(' ')
      outline = `<path d="M${point(angle + tangent)} A${r} ${r} 0 1 1 ${point(angle - tangent)} L${px} ${py} Z" ${fill}/>`
    }
    return {
      definitions: '',
      ink: `<g opacity="${first.alpha / 255}">${reflected ? reflectGradientGeometry(outline, radius * 2) : outline}</g>`,
      reflected,
    }
  }
  const sourceBands = ellipseGradientBands(paint)
  const sweep =
    (focus.cx !== radius || focus.cy !== radius) &&
    focus.rx > 0 &&
    focus.ry > 0 &&
    focus.rx !== radius &&
    focus.ry !== radius
      ? ellipseSweep({ radius, focus, bands: sourceBands, id })
      : null
  const bands = [
    // Native uniform focus scales >= 1 retain the first stop throughout the
    // painted field. Keep the geometric samples: its support is not one disk.
    ...[...sourceBands]
      .reverse()
      .map((band) =>
        saturated ? { ...band, alpha: first.alpha, premultiplied: firstPremultiplied } : band
      ),
    {
      t: 0,
      alpha: first.alpha,
      premultiplied: firstPremultiplied,
    },
  ]
  const ellipse = (band, channels) => {
    const rx = focus.rx + (radius - focus.rx) * band.t,
      ry = focus.ry + (radius - focus.ry) * band.t
    if (rx <= 0 || ry <= 0) return ''
    const cx = focus.cx + (radius - focus.cx) * band.t,
      cy = focus.cy + (radius - focus.cy) * band.t
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgb(${channels.join(',')})"/>`
  }
  const sourceFan = sweep?.definitions ?? focusFanClips({ radius, focus, id })
  const fan = reflected ? reflectGradientGeometry(sourceFan, radius * 2) : sourceFan
  const ink = (channels) => {
    if (sweep)
      return sweep.ink(channels) + focusHull({ radius, focus, channels: channels(bands.at(-1)) })
    const entry = bands.map((band) => ellipse(band, channels(band))).join('')
    if (!fan) return entry
    const ascending = [...bands].reverse()
    // Exit traversal paints increasing level sets. Its interval starts at the
    // preceding boundary, whereas entry traversal uses the interval's end.
    const exit = ascending
      .slice(1)
      .map((band, index) => ellipse({ ...band, t: ascending[index].t }, channels(band)))
      .join('')
    const center = ellipse(bands.at(-1), channels(bands.at(-1)))
    return `${entry}<g clip-path="url(#${id}-fan)"><g clip-path="url(#${id}-fan-outside)">${exit}</g></g>${center}`
  }
  const constantAlpha = saturated || paint.every((stop) => stop.alpha === first.alpha)
  const reflectedContours = constantAlpha ? undefined : { id, paths: new Map(), definitions: [] }
  const mappedInk = (channels) => {
    const source = ink(channels)
    return reflected ? reflectGradientGeometry(source, radius * 2, reflectedContours) : source
  }
  if (constantAlpha) {
    const colorInk = mappedInk((band) =>
      band.premultiplied.map((channel) => (first.alpha === 0 ? 0 : (channel * 255) / first.alpha))
    )
    return {
      definitions: fan,
      ink: `<g opacity="${first.alpha / 255}">${colorInk}</g>`,
      reflected,
    }
  }
  const diameter = radius * 2,
    x = reflected || sweep ? 0 : Math.min(0, focus.cx - Math.max(0, focus.rx)),
    y = reflected || sweep ? 0 : Math.min(0, focus.cy - Math.max(0, focus.ry)),
    width = reflected
      ? 2 * diameter
      : sweep
        ? diameter
        : Math.max(diameter, focus.cx + Math.max(0, focus.rx)) - x,
    height = reflected
      ? 2 * diameter
      : sweep
        ? diameter
        : Math.max(diameter, focus.cy + Math.max(0, focus.ry)) - y,
    viewport = `x="${x}" y="${y}" width="${width}" height="${height}"`
  const field = (suffix, background, color) =>
    `<svg id="${id}-${suffix}" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}" color-interpolation="sRGB"><rect ${viewport} fill="${background}"/>${mappedInk(color)}</svg>`
  const fields =
    field('p', 'black', (band) => band.premultiplied) +
    field('q', 'white', (band) => Array(3).fill(255 - band.alpha))
  // Reconstruct (premultiplied RGB, A) as (P, 1) - (0, 1-A).
  // A separate RGB field multiplied by an alpha mask is wrong at hard edges.
  const filter = `<filter id="${id}-rgba" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" ${viewport} color-interpolation-filters="sRGB"><feImage href="#${id}-p" ${viewport} result="p"/><feImage href="#${id}-q" ${viewport} result="q"/><feColorMatrix in="q" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="qa"/><feComposite in="p" in2="qa" operator="arithmetic" k1="0" k2="1" k3="-1" k4="0"/></filter>`
  return {
    definitions: fan + reflectedContours.definitions.join('') + fields + filter,
    ink: `<rect ${viewport} fill="black" filter="url(#${id}-rgba)"/>`,
    reflected,
  }
}
module.exports = { ellipseGradientBands, ellipseGradientSvgDefinition }
