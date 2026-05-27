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

function sanitizeUrlAttributes(html) {
  return String(html || '')
    .replace(/\s(href|src|xlink:href)\s*=\s*(['"])(.*?)\2/gi, (_, attr, quote, value) => {
      return ` ${attr}=${quote}${sanitizeHref(value)}${quote}`
    })
    .replace(/\s(href|src|xlink:href)\s*=\s*(?!['"])([^\s>]+)/gi, (_, attr, value) => {
      return ` ${attr}="${sanitizeHref(value)}"`
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
  safe = sanitizeUrlAttributes(safe)
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
  sanitizeRichTextHtml,
  sanitizeRichTextStyle,
  sanitizeMarkdownHtml,
  sanitizeSvgHtml,
  sanitizeStyleAttributes,
  convertCssLengthToPx,
  escapePlainText,
}
