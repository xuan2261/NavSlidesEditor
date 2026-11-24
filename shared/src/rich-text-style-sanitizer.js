const { convertCssLengthToPx } = require('./css-length-conversion.js')

function safeStyleText(css) {
  return String(css).replace(/<\/style/gi, (closing) => `\\3c /${closing.slice(2)}`)
}

const SAFE_STYLE_PROPS = new Set([
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'line-height',
  'margin-top',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'padding-top',
  'padding-bottom',
  'white-space',
  'tab-size',
  'text-indent',
  '--pptx-tab-stops',
  '--pptx-tab',
  'text-align',
  'text-decoration',
  'vertical-align',
  'letter-spacing',
  'text-shadow',
  '-webkit-text-stroke',
  '-webkit-text-stroke-width',
  '-webkit-text-stroke-color',
  'background',
  'background-color',
])

// Same maximum as DrawingML ST_LineWidth: 20116800 EMU / 9525 CSS px.
const validTextStrokeWidth = (value) => /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(value) && parseFloat(value) <= 2112
function validTextStrokeColor(value) {
  if (value === 'transparent') return true
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+(?:\.\d+)?|\.\d+))?\s*\)$/.exec(value)
  return !!rgb && rgb.slice(1, 4).every((channel) => Number(channel) <= 255) &&
    value.startsWith('rgba(') === (rgb[4] !== undefined) &&
    (rgb[4] === undefined || Number(rgb[4]) <= 1)
}

function sanitizeRichTextStyle(value) {
  return String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [prop, ...rest] = part.split(':')
      const propName = String(prop || '')
        .trim()
        .toLowerCase()
      const cssValue = rest.join(':').trim()
      if (!propName || !cssValue || !SAFE_STYLE_PROPS.has(propName)) return null
      if (/expression|javascript|import|behavior|binding/i.test(cssValue)) return null
      if (/url\s*\(/i.test(cssValue)) return null
      if (propName === '-webkit-text-stroke-width' && !validTextStrokeWidth(cssValue)) return null
      if (propName === '-webkit-text-stroke-color' && !validTextStrokeColor(cssValue)) return null
      if (propName === '-webkit-text-stroke') {
        const stroke = /^(\S+)\s+(.+)$/.exec(cssValue)
        if (!stroke || !validTextStrokeWidth(stroke[1]) || !validTextStrokeColor(stroke[2])) return null
      }
      if (propName === 'white-space' && !/^(pre-wrap|pre|normal|break-spaces)$/.test(cssValue))
        return null
      if (propName === 'tab-size' && !/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(cssValue)) return null
      if (propName === 'tab-size' && !(parseFloat(cssValue) > 0 && parseFloat(cssValue) <= 100000))
        return null
      if (
        ['text-indent', 'margin-left', 'margin-right', 'padding-top', 'padding-bottom'].includes(
          propName
        )
      ) {
        if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|pt)$/.test(cssValue)) return null
        if (Math.abs(parseFloat(cssValue)) > 100000) return null
        if (propName.startsWith('padding-') && parseFloat(cssValue) < 0) return null
      }
      if (propName === '--pptx-tab' && cssValue !== '1') return null
      if (propName === '--pptx-tab-stops') {
        const stops = cssValue.split(',')
        if (
          stops.length > 256 ||
          !stops.every(
            (stop) =>
              /^(?:\d+(?:\.\d+)?|\.\d+):(l|r|ctr|dec)$/.test(stop) && parseFloat(stop) <= 100000
          )
        )
          return null
      }
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
  safeStyleText,
}
