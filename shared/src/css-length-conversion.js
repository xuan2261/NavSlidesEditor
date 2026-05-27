const LENGTH_PROPS = new Set(['font-size', 'letter-spacing', 'line-height'])

const CSS_LENGTH_TO_PX_FACTORS = {
  pt: 96 / 72,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
}

function formatPx(value) {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? String(rounded) : String(rounded)}px`
}

function convertCssLengthToPx(value, property) {
  const propName = String(property || '').trim().toLowerCase()
  if (!LENGTH_PROPS.has(propName)) return value

  const raw = String(value || '').trim()
  const match = /^(-?\d+(?:\.\d+)?)(pt|in|cm|mm)$/i.exec(raw)
  if (!match) return value

  const num = Number(match[1])
  const unit = match[2].toLowerCase()
  const factor = CSS_LENGTH_TO_PX_FACTORS[unit]
  if (!Number.isFinite(num) || !factor) return value

  return formatPx(num * factor)
}

module.exports = {
  convertCssLengthToPx,
}
