const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
function fail(detail) {
  throw new TypeError('Invalid PPTX geometry gradient: ' + detail)
}
function fields(value, allowed, required = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    fail('record fields')
}
function gradientRectangle(rectangle) {
  fields(rectangle, ['l', 't', 'r', 'b'])
  for (const value of Object.values(rectangle))
    if (!Number.isSafeInteger(value) || value < -2147483648 || value > 2147483647)
      fail('relative rectangle')
  return rectangle
}
function gradientColors(gradient) {
  const linear = gradient?.kind === 'linear'
  fields(
    gradient,
    [
      'kind',
      'rotWithShape',
      'stops',
      'tileRect',
      'flip',
      ...(linear ? ['angle', 'scaled'] : ['path', 'fillToRect']),
    ],
    ['kind', 'rotWithShape', 'stops', ...(linear ? ['angle', 'scaled'] : ['path'])]
  )
  if (gradient.rotWithShape !== true) fail('shape rotation')
  if (linear) {
    if (
      !Number.isInteger(gradient.angle) ||
      gradient.angle < 0 ||
      gradient.angle >= 21600000 ||
      typeof gradient.scaled !== 'boolean'
    )
      fail('linear parameters')
  } else {
    if (gradient.kind !== 'path' || !['circle', 'rect', 'shape'].includes(gradient.path))
      fail('path parameters')
    if (Object.hasOwn(gradient, 'fillToRect')) gradientRectangle(gradient.fillToRect)
  }
  if (Object.hasOwn(gradient, 'tileRect')) gradientRectangle(gradient.tileRect)
  if (Object.hasOwn(gradient, 'flip') && gradient.flip !== 'none') fail('flip')
  if (!Array.isArray(gradient.stops) || gradient.stops.length < 2 || gradient.stops.length > 256)
    fail('stop budget')
  let previous = -1
  return gradient.stops.map((stop) => {
    fields(stop, ['pos', 'color'], ['pos', 'color'])
    if (!Number.isInteger(stop.pos) || stop.pos < previous || stop.pos < 0 || stop.pos > 100000)
      fail('stop position')
    previous = stop.pos
    const paint = resolveGeometryColorPaint(stop.color)
    return {
      pos: stop.pos / 100000,
      rgb: [0, 2, 4].map((offset) => parseInt(paint.rgb.slice(offset, offset + 2), 16)),
      alpha: Math.round(paint.alpha * 255),
    }
  })
}
module.exports = { gradientColors, gradientRectangle }
