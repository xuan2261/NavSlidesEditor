const { convertCssLengthToPx } = require('./css-length-conversion.js')

const SAFE_STYLE_PROPS = new Set([
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'text-align',
  'text-decoration',
  'vertical-align',
  'letter-spacing',
  'text-shadow',
  'background',
  'background-color',
])

function sanitizeRichTextStyle(value) {
  return String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [prop, ...rest] = part.split(':')
      const propName = String(prop || '').trim().toLowerCase()
      const cssValue = rest.join(':').trim()
      if (!propName || !cssValue || !SAFE_STYLE_PROPS.has(propName)) return null
      if (/expression|javascript|import|behavior|binding/i.test(cssValue)) return null
      if (/url\s*\(/i.test(cssValue)) return null
      return `${propName}: ${convertCssLengthToPx(cssValue, propName)}`
    })
    .filter(Boolean)
    .join('; ')
}

function sanitizeStyleAttributes(html) {
  return String(html || '').replace(/\sstyle=(["'])(.*?)\1/gi, (_match, quote, style) => {
    const safeStyle = sanitizeRichTextStyle(style)
    return safeStyle ? ` style=${quote}${safeStyle}${quote}` : ''
  })
}

module.exports = {
  sanitizeRichTextStyle,
  sanitizeStyleAttributes,
}
