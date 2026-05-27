import { isSafeHref } from './url-safety'

const LENGTH_PROPS = new Set(['font-size', 'letter-spacing', 'line-height'])
const LENGTH_FACTORS = { pt: 96 / 72, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }
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

function formatPx(value) {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}px`
}

function convertCssLengthToPx(value, property) {
  const prop = String(property || '').trim().toLowerCase()
  if (!LENGTH_PROPS.has(prop)) return value
  const match = /^(-?\d+(?:\.\d+)?)(pt|in|cm|mm)$/i.exec(String(value || '').trim())
  if (!match) return value
  const raw = Number(match[1])
  const factor = LENGTH_FACTORS[match[2].toLowerCase()]
  return Number.isFinite(raw) && factor ? formatPx(raw * factor) : value
}

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
    .replace(/\sstyle=(["'])(.*?)\1/gi, (_match, quote, value) => {
      const safeStyle = sanitizeRichTextStyle(value)
      return safeStyle ? ` style=${quote}${safeStyle}${quote}` : ''
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
      if (name === 'style') {
        const safeStyle = sanitizeRichTextStyle(value)
        if (safeStyle) node.setAttribute(attribute.name, safeStyle)
        else node.removeAttribute(attribute.name)
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
