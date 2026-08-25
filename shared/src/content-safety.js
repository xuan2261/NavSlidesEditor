const { convertCssLengthToPx } = require('./css-length-conversion.js')
const { sanitizeRichTextStyle, sanitizeStyleAttributes } = require('./rich-text-style-sanitizer.js')

const SAFE_HREF_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const SAFE_MEDIA_SCHEMES = new Set(['http:', 'https:'])
const SAFE_MEDIA_DATA = /^data:(image|audio|video)\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i
const ATTRIBUTE_BREAKOUT = /["'<>`\s]/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/

function isSafeHref(value) {
  const raw = String(value || '').trim()
  if (!raw || CONTROL_CHARS.test(raw) || ATTRIBUTE_BREAKOUT.test(raw)) return false
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) {
    return true
  }
  try {
    return SAFE_HREF_SCHEMES.has(new URL(raw, 'https://navslides.local').protocol)
  } catch {
    return false
  }
}

function sanitizeHref(value) {
  const raw = String(value || '').trim()
  return isSafeHref(raw) ? raw : '#'
}

function stripEventAttributes(html) {
  return String(html || '')
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\son[a-z-]+(?=[\s>])/gi, '')
}

function isSafeMediaSrc(value) {
  const raw = String(value || '').trim()
  if (!raw || CONTROL_CHARS.test(raw) || ATTRIBUTE_BREAKOUT.test(raw)) return false
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return true
  if (SAFE_MEDIA_DATA.test(raw)) return true
  try {
    return SAFE_MEDIA_SCHEMES.has(new URL(raw, 'https://navslides.local').protocol)
  } catch {
    return false
  }
}

function sanitizeMediaSrc(value) {
  const raw = String(value || '').trim()
  return isSafeMediaSrc(raw) ? raw : ''
}

function sanitizeUrlAttributes(html) {
  return String(html || '')
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])(.*?)\2/gi, (_, attr, quote, value) => {
      return ` ${attr}=${quote}${sanitizeHref(value)}${quote}`
    })
    .replace(/\s(href|src|xlink:href)\s*=\s*(?!['"])([^\s>]+)/gi, (_, attr, value) => {
      return ` ${attr}="${sanitizeHref(value)}"`
    })
}

function sanitizeSvgReference(value) {
  const raw = String(value || '').trim()
  if (!raw) return '#'
  if (raw.startsWith('#')) return raw
  if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i.test(raw)) return raw
  return '#'
}

function sanitizeSvgUrlAttributes(html) {
  return String(html || '')
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])(.*?)\2/gi, (_, attr, quote, value) => {
      return ` ${attr}=${quote}${sanitizeSvgReference(value)}${quote}`
    })
    .replace(/\s(href|src|xlink:href)\s*=\s*(?!['"])([^\s>]+)/gi, (_, attr, value) => {
      return ` ${attr}="${sanitizeSvgReference(value)}"`
    })
}

function sanitizeRichTextHtml(html) {
  return sanitizeStyleAttributes(
    sanitizeUrlAttributes(
      stripEventAttributes(String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ''))
    )
  )
}

function sanitizeMarkdownHtml(html) {
  return sanitizeRichTextHtml(html)
}

function sanitizeSvgHtml(svg) {
  let safe = String(svg || '')
    .replace(/<(script|foreignObject|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed)\b[^>]*\/?>/gi, '')
  safe = stripEventAttributes(safe)
  safe = sanitizeSvgUrlAttributes(safe)
  return safe
}

function escapePlainText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

module.exports = {
  isSafeHref,
  isSafeMediaSrc,
  sanitizeHref,
  sanitizeMediaSrc,
  sanitizeRichTextHtml,
  sanitizeRichTextStyle,
  sanitizeMarkdownHtml,
  sanitizeSvgHtml,
  sanitizeStyleAttributes,
  convertCssLengthToPx,
  escapePlainText,
}
