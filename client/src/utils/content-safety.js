import { isSafeHref } from './url-safety'

const BLOCKED_HTML_TAGS = ['script', 'iframe', 'object', 'embed']
const BLOCKED_SVG_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed']

function sanitizeHrefLike(value) {
  return isSafeHref(value) ? value : '#'
}

function fallbackSanitize(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])(.*?)\2/gi, (match, attr, quote, value) => {
      const safe = sanitizeHrefLike(value)
      return ` ${attr}=${quote}${safe}${quote}`
    })
}

export function sanitizeRichTextHtml(html) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return fallbackSanitize(html)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${String(html || '')}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''

  root.querySelectorAll(BLOCKED_HTML_TAGS.join(',')).forEach((node) => node.remove())
  root.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if (name.startsWith('on')) {
        node.removeAttribute(attribute.name)
        return
      }
      if ((name === 'href' || name === 'src') && !isSafeHref(value)) {
        node.setAttribute(attribute.name, '#')
      }
    })
  })

  return root.innerHTML
}

export function sanitizeSvgContent(svgContent) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return String(svgContent || '')
      .replace(/<(script|foreignObject|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
      .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(xlink:href|href)\s*=\s*(['"])\s*javascript:[^'"]*\2/gi, ' $1="#"')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(String(svgContent || ''), 'image/svg+xml')
  const root = doc.documentElement
  if (!root) return ''

  root.querySelectorAll(BLOCKED_SVG_TAGS.join(',')).forEach((node) => node.remove())
  root.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if (name.startsWith('on')) {
        node.removeAttribute(attribute.name)
        return
      }
      if ((name === 'href' || name === 'xlink:href') && !isSafeHref(value)) {
        node.setAttribute(attribute.name, '#')
      }
    })
  })

  return root.outerHTML
}
