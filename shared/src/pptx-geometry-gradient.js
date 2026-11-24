const { gradientColors } = require('./pptx-geometry-gradient-parameters')
const { IDENTITY, multiply } = require('./pptx-affine')
const { pathGradientSvgDefinition } = require('./pptx-geometry-gradient-path')
// PowerPoint16/10417 factors: resume-fill-gradient-{vector-probe,colors-reference} receipts.
// Derived paint never changes editable source declarations.
const TWO_STOP_BLEND = [
  0, 59, 120, 182, 247, 314, 383, 454, 527, 602, 680, 759, 841, 926, 1013, 1102, 1194, 1288, 1385,
  1485, 1587, 1692, 1800, 1911, 2024, 2141, 2260, 2383, 2508, 2637, 2769, 2904, 3042, 3183, 3328,
  3477, 3628, 3783, 3942, 4104, 4270, 4439, 4612, 4789, 4969, 5153, 5341, 5533, 5728, 5928, 6131,
  6338, 6549, 6764, 6983, 7206, 7434, 7665, 7900, 8139, 8382, 8630, 8881, 9136, 9396, 9660, 9927,
  10199, 10475, 10755, 11039, 11327, 11619, 11916, 12216, 12520, 12828, 13140, 13456, 13776, 14099,
  14427, 14758, 15093, 15431, 15774, 16119, 16469, 16822, 17178, 17538, 17901, 18267, 18637, 19009,
  19385, 19764, 20146, 20530, 20918, 21308, 21701, 22096, 22494, 22894, 23297, 23702, 24109, 24518,
  24929, 25342, 25756, 26173, 26591, 27010, 27431, 27853, 28276, 28701, 29126, 29552, 29979, 30407,
  30836, 31264, 31694, 32123, 32553, 32983, 33413, 33842, 34272, 34700, 35129, 35557, 35984, 36410,
  36835, 37260, 37683, 38105, 38526, 38945, 39363, 39780, 40194, 40607, 41018, 41427, 41834, 42239,
  42642, 43042, 43440, 43835, 44228, 44618, 45006, 45390, 45772, 46151, 46527, 46899, 47269, 47635,
  47998, 48358, 48714, 49067, 49417, 49762, 50105, 50443, 50778, 51109, 51437, 51760, 52080, 52396,
  52708, 53016, 53320, 53620, 53917, 54209, 54497, 54781, 55061, 55337, 55609, 55876, 56140, 56400,
  56655, 56906, 57154, 57397, 57636, 57871, 58102, 58330, 58553, 58772, 58987, 59198, 59405, 59608,
  59808, 60003, 60195, 60383, 60567, 60747, 60924, 61097, 61266, 61432, 61594, 61753, 61908, 62059,
  62208, 62353, 62494, 62632, 62767, 62899, 63028, 63153, 63276, 63395, 63512, 63625, 63736, 63844,
  63949, 64051, 64151, 64248, 64342, 64434, 64523, 64610, 64695, 64777, 64856, 64934, 65009, 65082,
  65153, 65222, 65289, 65354, 65416, 65477, 65536,
]
function gradientPaintId(geometry, fillFrame, modifier = 'norm') {
  gradientColors(geometry.style.fill.gradient)
  const key = JSON.stringify([
    geometry.width,
    geometry.height,
    !!geometry.style.stroke?.color,
    geometry.style.fill.gradient,
    ...(fillFrame ? [fillFrame] : []),
  ])
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  return (
    'pptx-gradient-' +
    hash.toString(16).padStart(32, '0') +
    (modifier === 'norm' ? '' : '-' + modifier)
  )
}
function gradientPaintStops(gradient, modifier = 'norm') {
  const source = gradientColors(gradient)
  if (modifier !== 'norm') {
    // Native linear/circle controls and preregistered A35BC7 held-out:
    // resume-gradient-path-shade-{reference,heldout-reference}. Shade the
    // resolved source colors before nonlinear replay, not the painted field.
    const remaining = { lighten: 0.6, lightenLess: 0.8, darken: 0.6, darkenLess: 0.8 }[modifier]
    const mix = Math.trunc(255 * (1 - remaining))
    for (const stop of source)
      stop.rgb = stop.rgb.map((channel) =>
        Math.round((channel * (255 - mix) + (modifier.startsWith('lighten') ? 255 * mix : 0)) / 255)
      )
  }
  if (
    source.length === 2 &&
    source[0].pos === 0 &&
    source[1].pos === 1 &&
    source.every((stop) => stop.alpha === 255)
  ) {
    return TWO_STOP_BLEND.map((raw, index) => {
      const factor = raw / 65536
      return {
        pos: Math.fround(index / 255),
        alpha: 255,
        rgb: source[0].rgb.map((channel, component) =>
          Math.round(
            255 *
              ((channel / 255) ** 2.2 * (1 - factor) +
                (source[1].rgb[component] / 255) ** 2.2 * factor) **
                (1 / 2.2)
          )
        ),
      }
    })
  }
  const stops = []
  source.forEach((stop, index) => {
    stops.push(stop)
    const end = source[index + 1]
    if (!end || end.pos === stop.pos || end.alpha === stop.alpha) return
    for (const ratio of [Math.fround(1 / 3), Math.fround(2 / 3)])
      stops.push({
        pos: stop.pos + (end.pos - stop.pos) * ratio,
        alpha: Math.floor(stop.alpha + (end.alpha - stop.alpha) * ratio),
        rgb: stop.rgb.map((channel, component) => {
          const start = Math.fround(channel / 255)
          const finish = Math.fround(end.rgb[component] / 255)
          const mixed = Math.fround(
            Math.fround(start * Math.fround(1 - ratio)) + Math.fround(finish * ratio)
          )
          return Math.floor(Math.fround(mixed * 255))
        }),
      })
  })
  // Auxiliary native replay supports premultiplied samples, not exact raster equivalence.
  const paint = []
  stops.forEach((stop, index) => {
    paint.push(stop)
    const end = stops[index + 1]
    if (!end || end.pos === stop.pos || end.alpha === stop.alpha) return
    for (let sample = 1; sample < 32; sample++) {
      const ratio = sample / 32
      const alpha = stop.alpha + (end.alpha - stop.alpha) * ratio
      paint.push({
        pos: stop.pos + (end.pos - stop.pos) * ratio,
        alpha,
        rgb: stop.rgb.map((channel, component) =>
          Math.round(
            (channel * stop.alpha * (1 - ratio) + end.rgb[component] * end.alpha * ratio) / alpha
          )
        ),
      })
    }
  })
  return paint
}
function gradientSvgDefinition(
  geometry,
  { width, height, nativeStroke, fillFrame, modifier = 'norm' }
) {
  const gradient = geometry.style.fill.gradient
  const w = fillFrame?.width ?? (nativeStroke ? width : geometry.width),
    h = fillFrame?.height ?? (nativeStroke ? height : geometry.height)
  let matrix = fillFrame?.paintToLeaf ?? IDENTITY
  if (fillFrame && nativeStroke)
    matrix = multiply(
      [
        geometry.width === 0 ? 1 / 9525 : width / geometry.width,
        0,
        0,
        geometry.height === 0 ? 1 / 9525 : height / geometry.height,
        0,
        0,
      ],
      matrix
    )
  const paint = gradientPaintStops(gradient, modifier)
  const stops = paint
    .map(
      (stop) =>
        '<stop offset="' +
        stop.pos +
        '" stop-color="#' +
        stop.rgb.map((value) => value.toString(16).padStart(2, '0')).join('') +
        '"' +
        (stop.alpha === 255 ? '' : ' stop-opacity="' + stop.alpha / 255 + '"') +
        '/>'
    )
    .join('')
  const id = gradientPaintId(geometry, fillFrame, modifier)
  if (gradient.kind === 'path')
    return pathGradientSvgDefinition(gradient, {
      width: w,
      height: h,
      matrix,
      id,
      stops,
      first: paint[0],
      paint,
    })
  const radians = ((gradient.angle / 60000) * Math.PI) / 180
  let cos = Math.cos(radians),
    sin = Math.sin(radians)
  const tile = gradient.tileRect ?? {},
    tw = 1 - ((tile.l ?? 0) + (tile.r ?? 0)) / 100000,
    th = 1 - ((tile.t ?? 0) + (tile.b ?? 0)) / 100000
  let extent = gradient.scaled
    ? Math.abs(cos * tw) + Math.abs(sin * th)
    : Math.abs(w * tw * cos) + Math.abs(h * th * sin)
  if (fillFrame && gradient.scaled) {
    // Native group brush angles scale against the occupied frame inversely.
    const length = Math.hypot(cos / (w * tw), sin / (h * th))
    const x = cos / (w * tw) / length,
      y = sin / (h * th) / length
    extent = Math.abs(w * tw * x) + Math.abs(h * th * y)
    cos = x
    sin = y
  }
  const normalized = gradient.scaled && !fillFrame
  const cx = (normalized ? 1 : w) * ((tile.l ?? 0) / 100000 + tw / 2),
    cy = (normalized ? 1 : h) * ((tile.t ?? 0) / 100000 + th / 2)
  const coordinate = (value) => String(Math.abs(value) < 1e-12 ? 0 : value)
  if (normalized) matrix = multiply(matrix, [w, 0, 0, h, 0, 0])
  const transform =
    gradient.scaled || fillFrame ? ' gradientTransform="matrix(' + matrix.join(' ') + ')"' : ''
  return (
    '<defs><linearGradient id="' +
    id +
    '" gradientUnits="userSpaceOnUse" x1="' +
    coordinate(cx - (cos * extent) / 2) +
    '" y1="' +
    coordinate(cy - (sin * extent) / 2) +
    '" x2="' +
    coordinate(cx + (cos * extent) / 2) +
    '" y2="' +
    coordinate(cy + (sin * extent) / 2) +
    '" color-interpolation="sRGB"' +
    (Object.values(tile).some((value) => value !== 0) ? ' spreadMethod="reflect"' : '') +
    transform +
    '>' +
    stops +
    '</linearGradient></defs>'
  )
}
module.exports = { gradientColors, gradientPaintId, gradientPaintStops, gradientSvgDefinition }
