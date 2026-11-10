const {
  GEOMETRY_COLOR_KINDS,
  isGeometryColorValue,
  GEOMETRY_COLOR_TRANSFORM_RANGES,
  GEOMETRY_COLOR_TRANSFORMS,
} = require('../../../shared/src/pptx-geometry-color')

// Shared DrawingML color grammar; callers retain their source ownership and diagnostics.
function readColorSource(node, { check, number, raw, wrap, fail }) {
  const kind = {
    srgbClr: 'srgb',
    scrgbClr: 'scrgb',
    hslClr: 'hsl',
    prstClr: 'preset',
    schemeClr: 'scheme',
    sysClr: 'system',
  }[node?.local]
  check(
    node,
    kind === 'scrgb'
      ? ['r', 'g', 'b']
      : kind === 'hsl'
        ? ['hue', 'sat', 'lum']
        : kind === 'system'
          ? ['val', 'lastClr']
          : ['val'],
    GEOMETRY_COLOR_TRANSFORMS
  )
  const nativeValue =
    kind === 'scrgb'
      ? Object.fromEntries(['r', 'g', 'b'].map((key) => [key, number(node, key).value]))
      : kind === 'hsl'
        ? {
            hue: number(node, 'hue', 0, 21600000).value,
            sat: number(node, 'sat').value,
            lum: number(node, 'lum').value,
          }
        : raw(node, 'val')
  if (
    !kind ||
    (kind === 'system' && (!nativeValue || !/^[\da-f]{6}$/i.test(raw(node, 'lastClr') ?? ''))) ||
    (kind === 'scheme' &&
      !/^(?:dk[12]|lt[12]|bg[12]|tx[12]|accent[1-6]|hlink|folHlink|phClr)$/.test(
        nativeValue ?? ''
      )) ||
    (GEOMETRY_COLOR_KINDS.includes(kind) && !isGeometryColorValue(kind, nativeValue))
  )
    fail('unsupported color')
  const value = {
    kind,
    value: nativeValue,
    ...(kind === 'system' ? { lastColor: raw(node, 'lastClr') } : {}),
  }
  if (node.children.length)
    value.transforms = node.children.map((n) => {
      const range = GEOMETRY_COLOR_TRANSFORM_RANGES[n.local]
      check(n, range ? ['val'] : [])
      return wrap(n, {
        kind: n.local,
        ...(range ? { value: number(n, 'val', ...range).value } : {}),
      })
    })
  return wrap(node, value)
}
module.exports = { readColorSource }
