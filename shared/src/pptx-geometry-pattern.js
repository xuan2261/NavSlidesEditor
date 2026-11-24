// DrawingML preset tokens. Source fields remain optional and lossless.
const masks = require('./pptx-geometry-pattern-masks')
const { resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { IDENTITY, invert, multiply } = require('./pptx-affine')
const GEOMETRY_PATTERN_PRESETS = Object.freeze([
  'pct5',
  'pct10',
  'pct20',
  'pct25',
  'pct30',
  'pct40',
  'pct50',
  'pct60',
  'pct70',
  'pct75',
  'pct80',
  'pct90',
  'horz',
  'vert',
  'ltHorz',
  'ltVert',
  'dkHorz',
  'dkVert',
  'narHorz',
  'narVert',
  'dashHorz',
  'dashVert',
  'cross',
  'dnDiag',
  'upDiag',
  'ltDnDiag',
  'ltUpDiag',
  'dkDnDiag',
  'dkUpDiag',
  'wdDnDiag',
  'wdUpDiag',
  'dashDnDiag',
  'dashUpDiag',
  'diagCross',
  'smCheck',
  'lgCheck',
  'smGrid',
  'lgGrid',
  'dotGrid',
  'smConfetti',
  'lgConfetti',
  'horzBrick',
  'diagBrick',
  'solidDmnd',
  'openDmnd',
  'dotDmnd',
  'plaid',
  'sphere',
  'weave',
  'divot',
  'shingle',
  'wave',
  'trellis',
  'zigZag',
])
function patternPaint(pattern, modifier = 'norm') {
  if (!['norm', 'lighten', 'lightenLess', 'darken', 'darkenLess'].includes(modifier))
    throw new TypeError('Invalid PPTX geometry pattern path shade')
  if (
    !pattern ||
    typeof pattern !== 'object' ||
    Array.isArray(pattern) ||
    Object.keys(pattern).some((key) => !['preset', 'foreground', 'background'].includes(key)) ||
    (Object.hasOwn(pattern, 'preset') && !GEOMETRY_PATTERN_PRESETS.includes(pattern.preset))
  )
    throw new TypeError('Invalid PPTX geometry pattern')
  const color = (value) => {
    const paint = resolveGeometryColorPaint(value)
    // Native opaque pct50 controls: resume-oct19-pattern-path-shade-reference.
    // Change source colors, leaving the mask, phase and source declarations intact.
    const mix = Math.trunc(255 * (1 - (modifier.endsWith('Less') ? 0.8 : 0.6)))
    const rgb =
      modifier === 'norm'
        ? paint.rgb
        : paint.rgb
            .match(/../g)
            .map((value) =>
              Math.round(
                (parseInt(value, 16) * (255 - mix) +
                  (modifier.startsWith('lighten') ? 255 * mix : 0)) /
                  255
              )
                .toString(16)
                .padStart(2, '0')
            )
            .join('')
            .toUpperCase()
    return { ...paint, rgb, alpha: Math.round(paint.alpha * 255) / 255 }
  }
  const preset = pattern.preset ?? 'pct5'
  const mask = masks[preset]
  const rows = mask.match(/../g).map((value) => parseInt(value, 16))
  const bit = (x, y) => (rows[(y + 8) % 8] >> (7 - ((x + 8) % 8))) & 1
  const diagonal = ['dnDiag', 'upDiag', 'diagCross'].includes(preset)
  // Native EMF+ HatchBrush coverage, distinct from its one-bit EMF fallback.
  const coverage = Array.from({ length: 64 }, (_, index) => {
    const x = index % 8,
      y = Math.floor(index / 8)
    if (!diagonal) return bit(x, y)
    if (bit(x, y)) return Math.SQRT2 - 0.5
    return bit(x - 1, y) || bit(x + 1, y) || bit(x, y - 1) || bit(x, y + 1) ? 0.25 : 0
  })
  return {
    mask,
    coverage,
    foreground: color(
      Object.hasOwn(pattern, 'foreground') ? pattern.foreground : { kind: 'srgb', value: '000000' }
    ),
    background: color(
      Object.hasOwn(pattern, 'background') ? pattern.background : { kind: 'srgb', value: 'FFFFFF' }
    ),
  }
}
function patternPaintId(geometry, options = {}) {
  const { modifier = 'norm' } = options
  patternPaint(geometry.style.fill.pattern, modifier)
  // Storage canonicalizes record keys, but color-transform array order is authored.
  // Only sort records so save/reopen cannot change derived paint references.
  const key = JSON.stringify([
    geometry.width,
    geometry.height,
    geometry.style.fill.pattern,
    options.width,
    options.height,
    options.nativeStroke,
    options.occurrenceMatrix,
  ], (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value)
  let hash = 0x6c62272e07bb014262b821756295c58dn
  for (const character of key)
    hash = BigInt.asUintN(
      128,
      (hash ^ BigInt(character.charCodeAt(0))) * 0x1000000000000000000013bn
    )
  return (
    'pptx-pattern-' +
    hash.toString(16).padStart(32, '0') +
    (modifier === 'norm' ? '' : '-' + modifier)
  )
}
function patternSvgDefinition(geometry, options) {
  const { width, height, nativeStroke, occurrenceMatrix = IDENTITY, modifier = 'norm' } = options
  const paint = patternPaint(geometry.style.fill.pattern, modifier)
  const nativeToPattern = multiply(invert(occurrenceMatrix), [9525, 0, 0, 9525, 0, 0])
  const transform = nativeStroke
    ? multiply(
        [
          geometry.width === 0 ? 1 / 9525 : width / geometry.width,
          0,
          0,
          geometry.height === 0 ? 1 / 9525 : height / geometry.height,
          0,
          0,
        ],
        nativeToPattern
      )
    : nativeToPattern
  const [background, foreground] = [paint.background, paint.foreground].map((color) => {
    const alpha = Math.round(color.alpha * 255)
    return {
      alpha,
      channels: color.rgb
        .match(/../g)
        .map((value) => Math.round((parseInt(value, 16) * alpha) / 255)),
    }
  })
  const cells = new Map()
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const weight = paint.coverage[y * 8 + x]
      const alpha = Math.floor(background.alpha + (foreground.alpha - background.alpha) * weight)
      const rgb =
        alpha === 0
          ? weight === 0
            ? paint.background.rgb
            : paint.foreground.rgb
          : background.channels
              .map((value, index) => {
                const premultiplied = Math.floor(
                  value + (foreground.channels[index] - value) * weight
                )
                return Math.round((premultiplied * 255) / alpha)
                  .toString(16)
                  .padStart(2, '0')
              })
              .join('')
              .toUpperCase()
      const key = `${rgb}:${alpha}`
      if (!cells.has(key)) cells.set(key, { rgb, alpha, paths: [] })
      cells.get(key).paths.push(`M${x} ${y}h1v1h-1Z`)
    }
  }
  const ink = [...cells.values()]
    .map(
      (color) =>
        `<path d="${color.paths.join(' ')}" fill="#${color.rgb}" fill-opacity="${color.alpha / 255}"/>`
    )
    .join('')
  return `<defs><pattern id="${patternPaintId(geometry, options)}" patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" width="8" height="8" patternTransform="matrix(${transform.join(' ')})">${ink}</pattern></defs>`
}
module.exports = {
  GEOMETRY_PATTERN_PRESETS,
  patternPaint,
  patternPaintId,
  patternSvgDefinition,
}
