const { createRichTableCell } = require('revealjs-shared')
const { sanitizeHtml } = require('../sanitize')
const { ptToCanvasPx } = require('./utils-text')

function canvasTypography(style, scale) {
  return style.split(';').map((entry) => {
    const colon = entry.indexOf(':')
    if (colon < 0) return entry
    const property = entry.slice(0, colon).trim().toLowerCase()
    const value = entry.slice(colon + 1).trim()
    if (['font-size', 'line-height', 'letter-spacing'].includes(property) && /^-?(?:\d+(?:\.\d+)?|\.\d+)px$/i.test(value)) {
      // Server sanitization already converted parser pt to 96-DPI CSS px.
      // Recover point units (including sanitizer rounding), then scale once.
      const points = ptToCanvasPx(Number.parseFloat(value) * 72 / 96)
      const axisScale = property === 'letter-spacing' ? { y: scale?.x } : scale
      return `${property}:${ptToCanvasPx(points, axisScale)}px`
    }
    if (property === 'font-weight' && /^(bold|normal)$/i.test(value)) return `font-weight:${value.toLowerCase() === 'bold' ? 700 : 400}`
    return entry
  }).filter((entry) => entry.trim()).join(';')
}

function paragraphStyle(style, bold) {
  const entries = style.split(';').filter((entry) => entry.trim() && !/^\s*margin(?:-[\w]+)?\s*:/i.test(entry))
  if (!entries.some((entry) => /^\s*line-height\s*:/i.test(entry))) entries.push('line-height:normal')
  if (!entries.some((entry) => /^\s*font-weight\s*:/i.test(entry))) entries.push(`font-weight:${bold ? 700 : 400}`)
  for (const side of ['top', 'right', 'bottom', 'left']) entries.push(`margin-${side}:0px`)
  return entries.join(';')
}

function mapTableCellValue(value, scale, bold) {
  if (typeof value !== 'string' || !/<\/?[a-z][^>]*>/i.test(value)) return value
  const html = sanitizeHtml(value).replace(/\sstyle="([^"]*)"/gi, (_match, style) => {
    const normalized = canvasTypography(style, scale)
    return normalized ? ` style="${normalized}"` : ''
  }).replace(/<p\b([^>]*)>/gi, (_match, attrs) => {
    const style = /\sstyle="([^"]*)"/i.exec(attrs)
    const kept = attrs.replace(/\sstyle="[^"]*"/i, '')
    return `<p${kept} style="${paragraphStyle(style?.[1] || '', bold)}">`
  })
  return createRichTableCell(html)
}

module.exports = { mapTableCellValue }
