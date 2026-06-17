const { convertCssLengthToPx } = require('./css-length-conversion.js')
const { sanitizeRichTextStyle, sanitizeStyleAttributes } = require('./rich-text-style-sanitizer.js')

function sanitizeHref(value) {
  const raw = String(value || '').trim()
  if (!raw) return '#'
  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) {
    return raw
  }
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw
  return '#'
}

function stripEventAttributes(html) {
  return String(html || '')
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\son[a-z-]+(?=[\s>])/gi, '')
}

function isSafeMediaSrc(value) {
  const raw = String(value || '').trim()
  if (!raw) return false
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(raw)) return false
  if (/["'<>`\s]/.test(raw)) return false
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return true
  if (/^data:(image|audio|video)\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i.test(raw)) return true
  try {
    const parsed = new URL(raw, 'https://navslides.local')
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
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
