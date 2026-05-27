const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')
const { sanitizeRichTextStyle } = require('revealjs-shared')

const DOMPurify = createDOMPurify(new JSDOM('').window)

const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:', 'tel:']

function sanitizeStyle(value) {
  return sanitizeRichTextStyle(value)
}

// Phase 0: Validate href protocol — only allow safe protocols
function validateHref(href) {
  if (!href) return null
  const trimmed = href.trim().toLowerCase()
  if (!SAFE_PROTOCOLS.some((p) => trimmed.startsWith(p))) return null
  return href.trim()
}

function sanitizeHtml(html) {
  // Phase 0: Extended tags — a, s, strike, del, sub, sup added
  const clean = DOMPurify.sanitize(String(html || ''), {
    ALLOWED_TAGS: [
      'p', 'span', 'strong', 'em', 'b', 'i', 'u',
      'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3',
      'a',        // NEW: hyperlinks
      's', 'strike', 'del', // NEW: strikethrough
      'sub', 'sup',         // NEW: subscript/superscript
    ],
    ALLOWED_ATTR: ['style', 'href'], // NEW: href
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onclick', 'onmouseover', 'onerror', 'onload', 'onfocus', 'onblur'],
  })

  // Post-process: validate href protocols
  return clean.replace(/<a\s+([^>]*href=[^>]*)>/gi, (_match, attrs) => {
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i)
    if (!hrefMatch) return `<a ${attrs}>`
    const validated = validateHref(hrefMatch[1])
    if (!validated) {
      // Strip href entirely if invalid protocol
      const safeAttrs = attrs.replace(/href=["'][^"']+["']/gi, '')
      return `<a ${safeAttrs}>`
    }
    return `<a ${attrs}>`
  }).replace(/\sstyle="([^"]*)"/gi, (_match, style) => {
    const safeStyle = sanitizeStyle(style)
    return safeStyle ? ` style="${safeStyle}"` : ''
  })
}

module.exports = {
  sanitizeHtml,
  sanitizeStyle,
}
