const BLOCKED_SVG_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed']

function sanitizeSvgReference(value) {
  const raw = String(value || '').trim()
  if (!raw) return '#'
  if (raw.startsWith('#')) return raw
  if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]*$/i.test(raw)) return raw
  return '#'
}

function sanitizeSvgContentString(svgContent) {
  return String(svgContent || '')
    .replace(/<(script|foreignObject|iframe|object|embed)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|foreignObject|iframe|object|embed)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z-]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, '')
    .replace(/\s(xlink:href|href|src)\s*=\s*(['"])(.*?)\2/gi, (_match, attr, quote, value) => {
      return ` ${attr}=${quote}${sanitizeSvgReference(value)}${quote}`
    })
    .replace(/\s(xlink:href|href|src)\s*=\s*(?!['"])([^\s>]+)/gi, (_match, attr, value) => {
      return ` ${attr}="${sanitizeSvgReference(value)}"`
    })
}

export function sanitizeSvgContent(svgContent) {
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return sanitizeSvgContentString(svgContent)
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(String(svgContent || ''), 'image/svg+xml')
  const root = doc.documentElement
  if (!root) return ''
  if (root.nodeName.toLowerCase() === 'parsererror') return sanitizeSvgContentString(svgContent)

  root.querySelectorAll(BLOCKED_SVG_TAGS.join(',')).forEach((node) => node.remove())
  ;[root, ...root.querySelectorAll('*')].forEach((node) => {
    Array.from(node.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value
      if (name.startsWith('on')) {
        node.removeAttribute(attribute.name)
        return
      }
      if (name === 'href' || name === 'xlink:href' || name === 'src') {
        node.setAttribute(attribute.name, sanitizeSvgReference(value))
      }
    })
  })

  return root.outerHTML
}
