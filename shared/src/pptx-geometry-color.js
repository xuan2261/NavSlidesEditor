const { cloneTextData } = require('./pptx-text-document')
const { GEOMETRY_COLOR_TRANSFORM_RANGES } = require('./pptx-geometry-color-ranges')

// DrawingML ST_PresetColorVal, not the browser CSS color-name union.
// https://schemas.liquid-technologies.com/OfficeOpenXML/2006/st_presetcolorval.html
const PRESET_COLORS = Object.freeze({
  aliceBlue: 'F0F8FF',
  antiqueWhite: 'FAEBD7',
  aqua: '00FFFF',
  aquamarine: '7FFFD4',
  azure: 'F0FFFF',
  beige: 'F5F5DC',
  bisque: 'FFE4C4',
  black: '000000',
  blanchedAlmond: 'FFEBCD',
  blue: '0000FF',
  blueViolet: '8A2BE2',
  brown: 'A52A2A',
  burlyWood: 'DEB887',
  cadetBlue: '5F9EA0',
  chartreuse: '7FFF00',
  chocolate: 'D2691E',
  coral: 'FF7F50',
  cornflowerBlue: '6495ED',
  cornsilk: 'FFF8DC',
  crimson: 'DC143C',
  cyan: '00FFFF',
  dkBlue: '00008B',
  dkCyan: '008B8B',
  dkGoldenrod: 'B8860B',
  dkGray: 'A9A9A9',
  dkGreen: '006400',
  dkKhaki: 'BDB76B',
  dkMagenta: '8B008B',
  dkOliveGreen: '556B2F',
  dkOrange: 'FF8C00',
  dkOrchid: '9932CC',
  dkRed: '8B0000',
  dkSalmon: 'E9967A',
  dkSeaGreen: '8FBC8F',
  dkSlateBlue: '483D8B',
  dkSlateGray: '2F4F4F',
  dkTurquoise: '00CED1',
  dkViolet: '9400D3',
  deepPink: 'FF1493',
  deepSkyBlue: '00BFFF',
  dimGray: '696969',
  dodgerBlue: '1E90FF',
  firebrick: 'B22222',
  floralWhite: 'FFFAF0',
  forestGreen: '228B22',
  fuchsia: 'FF00FF',
  gainsboro: 'DCDCDC',
  ghostWhite: 'F8F8FF',
  gold: 'FFD700',
  goldenrod: 'DAA520',
  gray: '808080',
  green: '008000',
  greenYellow: 'ADFF2F',
  honeydew: 'F0FFF0',
  hotPink: 'FF69B4',
  indianRed: 'CD5C5C',
  indigo: '4B0082',
  ivory: 'FFFFF0',
  khaki: 'F0E68C',
  lavender: 'E6E6FA',
  lavenderBlush: 'FFF0F5',
  lawnGreen: '7CFC00',
  lemonChiffon: 'FFFACD',
  ltBlue: 'ADD8E6',
  ltCoral: 'F08080',
  ltCyan: 'E0FFFF',
  ltGoldenrodYellow: 'FAFAD2',
  ltGray: 'D3D3D3',
  ltGreen: '90EE90',
  ltPink: 'FFB6C1',
  ltSalmon: 'FFA07A',
  ltSeaGreen: '20B2AA',
  ltSkyBlue: '87CEFA',
  ltSlateGray: '778899',
  ltSteelBlue: 'B0C4DE',
  ltYellow: 'FFFFE0',
  lime: '00FF00',
  limeGreen: '32CD32',
  linen: 'FAF0E6',
  magenta: 'FF00FF',
  maroon: '800000',
  medAquamarine: '66CDAA',
  medBlue: '0000CD',
  medOrchid: 'BA55D3',
  medPurple: '9370DB',
  medSeaGreen: '3CB371',
  medSlateBlue: '7B68EE',
  medSpringGreen: '00FA9A',
  medTurquoise: '48D1CC',
  medVioletRed: 'C71585',
  midnightBlue: '191970',
  mintCream: 'F5FFFA',
  mistyRose: 'FFE4E1',
  moccasin: 'FFE4B5',
  navajoWhite: 'FFDEAD',
  navy: '000080',
  oldLace: 'FDF5E6',
  olive: '808000',
  oliveDrab: '6B8E23',
  orange: 'FFA500',
  orangeRed: 'FF4500',
  orchid: 'DA70D6',
  paleGoldenrod: 'EEE8AA',
  paleGreen: '98FB98',
  paleTurquoise: 'AFEEEE',
  paleVioletRed: 'DB7093',
  papayaWhip: 'FFEFD5',
  peachPuff: 'FFDAB9',
  peru: 'CD853F',
  pink: 'FFC0CB',
  plum: 'DDA0DD',
  powderBlue: 'B0E0E6',
  purple: '800080',
  red: 'FF0000',
  rosyBrown: 'BC8F8F',
  royalBlue: '4169E1',
  saddleBrown: '8B4513',
  salmon: 'FA8072',
  sandyBrown: 'F4A460',
  seaGreen: '2E8B57',
  seaShell: 'FFF5EE',
  sienna: 'A0522D',
  silver: 'C0C0C0',
  skyBlue: '87CEEB',
  slateBlue: '6A5ACD',
  slateGray: '708090',
  snow: 'FFFAFA',
  springGreen: '00FF7F',
  steelBlue: '4682B4',
  tan: 'D2B48C',
  teal: '008080',
  thistle: 'D8BFD8',
  tomato: 'FF6347',
  turquoise: '40E0D0',
  violet: 'EE82EE',
  wheat: 'F5DEB3',
  white: 'FFFFFF',
  whiteSmoke: 'F5F5F5',
  yellow: 'FFFF00',
  yellowGreen: '9ACD32',
})
const GEOMETRY_COLOR_KINDS = Object.freeze(['srgb', 'scrgb', 'hsl', 'preset'])
const native = (value) => Number.isSafeInteger(value) && value >= -2147483648 && value <= 2147483647
const GEOMETRY_COLOR_TRANSFORMS = Object.freeze([
  ...Object.keys(GEOMETRY_COLOR_TRANSFORM_RANGES),
  'comp',
  'inv',
  'gray',
  'gamma',
  'invGamma',
])
function isGeometryColorTransform(value, { projection = false } = {}) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.hasOwn(value, 'kind') ||
    !GEOMETRY_COLOR_TRANSFORMS.includes(value.kind)
  )
    return false
  const range = GEOMETRY_COLOR_TRANSFORM_RANGES[value.kind]
  // Existing canonical gradient edits admit positive alphaOff through 1000%.
  // Raw source declarations retain the DrawingML fixed-percentage domain.
  const max = projection && value.kind === 'alphaOff' ? 1000000 : range?.[1]
  return range
    ? Object.keys(value).every((key) => ['kind', 'value'].includes(key)) &&
        Object.hasOwn(value, 'value') &&
        native(value.value) &&
        value.value >= range[0] &&
        value.value <= max
    : Object.keys(value).length === 1 && Object.hasOwn(value, 'kind')
}
function isGeometryColorValue(kind, value) {
  if (kind === 'srgb') return typeof value === 'string' && /^[\da-f]{6}$/i.test(value)
  if (kind === 'preset') return typeof value === 'string' && Object.hasOwn(PRESET_COLORS, value)
  const keys = kind === 'scrgb' ? ['r', 'g', 'b'] : kind === 'hsl' ? ['hue', 'sat', 'lum'] : null
  return (
    !!keys &&
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key) && native(value[key])) &&
    (kind !== 'hsl' || (value.hue >= 0 && value.hue <= 21600000))
  )
}
const clamp = (value) => Math.max(0, Math.min(1, value))
const linear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
const encoded = (channel) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
function hslRgb(hue, saturation, lightness) {
  hue = ((hue % 6) + 6) % 6
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const x = chroma * (1 - Math.abs((hue % 2) - 1))
  return [
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ][Math.floor(hue)].map((channel) => channel + lightness - chroma / 2)
}
function resolveGeometryColorPaint(input) {
  const color = cloneTextData(input)
  if (
    !color ||
    Object.keys(color).some((key) => !['kind', 'value', 'transforms'].includes(key)) ||
    !isGeometryColorValue(color.kind, color.value)
  )
    throw new TypeError('Invalid PPTX geometry color')
  if (
    Object.hasOwn(color, 'transforms') &&
    (!Array.isArray(color.transforms) ||
      color.transforms.length > 32 ||
      !color.transforms.every((transform) =>
        isGeometryColorTransform(transform, { projection: true })
      ))
  )
    throw new TypeError('Invalid PPTX geometry color transforms')
  const transforms = color.transforms ?? []
  let rgb =
      color.kind === 'scrgb'
        ? ['r', 'g', 'b'].map((key) => encoded(color.value[key] / 100000))
        : color.kind === 'hsl'
          ? hslRgb(
              (color.value.hue / 3600000) % 6,
              color.value.sat / 100000,
              color.value.lum / 100000
            )
          : (color.kind === 'preset' ? PRESET_COLORS[color.value] : color.value)
              .match(/../g)
              .map((channel) => parseInt(channel, 16) / 255),
    alpha = 1
  for (const transform of transforms) {
    const amount = transform.value / 100000
    if (transform.kind === 'tint' || transform.kind === 'shade') {
      rgb = rgb.map((channel) =>
        encoded(
          clamp(
            transform.kind === 'tint'
              ? linear(channel) * amount + 1 - amount
              : linear(channel) * amount
          )
        )
      )
    } else if (/^(?:hue|sat|lum)(?:Mod|Off)?$/.test(transform.kind) || transform.kind === 'comp') {
      const max = Math.max(...rgb),
        min = Math.min(...rgb),
        delta = max - min
      const lightness = (max + min) / 2
      const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
      const hue =
        delta === 0
          ? 0
          : max === rgb[0]
            ? ((rgb[1] - rgb[2]) / delta + 6) % 6
            : max === rgb[1]
              ? (rgb[2] - rgb[0]) / delta + 2
              : (rgb[0] - rgb[1]) / delta + 4
      let nextHue = hue,
        nextSaturation = saturation,
        nextLightness = lightness
      if (transform.kind === 'comp') nextHue += 3
      else {
        const kind = transform.kind.slice(0, 3)
        const input = { hue, sat: saturation, lum: lightness }[kind]
        const unit =
          kind === 'hue' && !transform.kind.endsWith('Mod') ? transform.value / 3600000 : amount
        const next = transform.kind.endsWith('Mod')
          ? input * unit
          : transform.kind.endsWith('Off')
            ? input + unit
            : unit
        if (kind === 'hue') nextHue = next
        else if (kind === 'sat') nextSaturation = next
        else nextLightness = clamp(next)
      }
      rgb = hslRgb(nextHue, nextSaturation, nextLightness).map(clamp)
    } else if (/^(?:red|green|blue)(?:Mod|Off)?$/.test(transform.kind)) {
      const index = ['red', 'green', 'blue'].findIndex((kind) => transform.kind.startsWith(kind))
      const input = linear(rgb[index])
      rgb[index] = encoded(
        clamp(
          transform.kind.endsWith('Mod')
            ? input * amount
            : transform.kind.endsWith('Off')
              ? input + amount
              : amount
        )
      )
    } else if (transform.kind === 'inv')
      rgb = rgb.map((channel) => encoded(clamp(1 - linear(channel))))
    else if (transform.kind === 'gray') {
      const gray = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722
      rgb = [gray, gray, gray].map(clamp)
    } else if (transform.kind === 'gamma') rgb = rgb.map((channel) => encoded(clamp(channel)))
    else if (transform.kind === 'invGamma') rgb = rgb.map((channel) => clamp(linear(channel)))
    else if (transform.kind === 'alpha') alpha = amount
    else if (transform.kind === 'alphaMod') alpha = clamp(alpha * amount)
    else if (transform.kind === 'alphaOff') alpha = clamp(alpha + amount)
  }
  return {
    rgb: rgb
      .map((channel) =>
        Math.round(clamp(channel) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
      .toUpperCase(),
    alpha,
  }
}
const GEOMETRY_PRESET_COLOR_NAMES = Object.freeze(Object.keys(PRESET_COLORS))
module.exports = {
  GEOMETRY_COLOR_KINDS,
  GEOMETRY_COLOR_TRANSFORM_RANGES,
  GEOMETRY_COLOR_TRANSFORMS,
  isGeometryColorTransform,
  GEOMETRY_PRESET_COLOR_NAMES,
  isGeometryColorValue,
  resolveGeometryColorPaint,
}
