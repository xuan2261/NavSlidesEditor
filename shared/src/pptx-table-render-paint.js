const { resolveProperty, resolveRgbPaint } = require('./pptx-style-resolution')
const { PRESET_DASH_PATTERNS } = require('./pptx-geometry-document')
const { escapePlainText } = require('./content-safety')

function unsupported(componentId, path, detail) {
  const error = new TypeError(`PPTX table render unsupported: ${detail}`)
  error.code = 'PPTX_TABLE_RENDER_UNSUPPORTED'
  error.componentId = componentId
  error.path = path
  throw error
}
function paint(color, options, componentId, path, text = false) {
  if (color?.kind === 'none') return { value: 'none', alpha: 1 }
  if (!color) unsupported(componentId, path, 'unresolved color')
  const result = resolveProperty({
    property: 'color',
    scope: 'run',
    ...(options.theme ? { theme: options.theme } : {}),
    layers: {
      target: {},
      entries: [
        {
          id: 'table-render-paint',
          kind: 'run',
          source: { part: 'table', path },
          properties: { color: text ? color : { kind: color.kind, value: color.value } },
        },
      ],
    },
  })
  if (result.unsupportedReason) unsupported(componentId, path, result.unsupportedReason)
  const resolved = text
    ? result.resolved
    : resolveRgbPaint({ ...color, kind: 'srgb', value: result.resolved.rgb })
  return { value: `#${resolved.rgb}`, alpha: resolved.alpha }
}
function fillRect(fill, width, height, options, id) {
  if (!fill) return ''
  const color = paint(fill.color, options, id, 'fill.color')
  if (color.value === 'none') return ''
  return `<rect width="${width}" height="${height}" fill="${color.value}" fill-opacity="${color.alpha}" stroke="none"/>`
}
function cellBorders(borders, width, height, options, id, coordinates) {
  const sides = coordinates ?? {
    left: [0, 0, 0, height],
    right: [width, 0, width, height],
    top: [0, 0, width, 0],
    bottom: [0, height, width, height],
    topLeftToBottomRight: [0, 0, width, height],
    bottomLeftToTopRight: [0, height, width, 0],
  }
  return Object.entries(borders ?? {})
    .map(([side, border]) => {
      const path = `borders.${side}`
      if (border.headEnd?.type && border.headEnd.type !== 'none')
        unsupported(id, `${path}.headEnd`, 'line end rendering')
      if (border.tailEnd?.type && border.tailEnd.type !== 'none')
        unsupported(id, `${path}.tailEnd`, 'line end rendering')
      if (border.width === 0 || border.color?.kind === 'none') return ''
      if (
        (border.compound && border.compound !== 'sng') ||
        (border.alignment && border.alignment !== 'ctr')
      )
        unsupported(id, path, 'compound/inside cell border requires native outline context')
      const color = paint(border.color, options, id, `${path}.color`)
      if (color.value === 'none') return ''
      if (border.width === undefined) unsupported(id, `${path}.width`, 'unresolved border width')
      const strokeWidth = border.width / 9525
      const dash = border.dash
        ? PRESET_DASH_PATTERNS[border.dash.value].map((n) => n * strokeWidth)
        : []
      const [x1, y1, x2, y2] = sides[side]
      const join = border.join
      return (
        `<line data-pptx-table-border="${escapePlainText(side)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color.value}" stroke-opacity="${color.alpha}" stroke-width="${strokeWidth}"` +
        ` stroke-linecap="${{ flat: 'butt', rnd: 'round', sq: 'square' }[border.cap ?? 'sq']}"` +
        (dash.length ? ` stroke-dasharray="${dash.join(' ')}"` : '') +
        (join
          ? ` stroke-linejoin="${join.kind === 'miter' && join.limit < 100000 ? 'bevel' : join.kind}"`
          : '') +
        (join?.kind === 'miter' && join.limit >= 100000
          ? ` stroke-miterlimit="${join.limit / 100000}"`
          : '') +
        '/>'
      )
    })
    .join('')
}
module.exports = { unsupported, paint, fillRect, cellBorders }
