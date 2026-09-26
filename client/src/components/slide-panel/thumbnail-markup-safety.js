import { isSafeHref } from '../../utils/url-safety'
import { sanitizeRichTextHtml } from '../../utils/content-safety'

// Thumbnail markup is mounted in the editor document, not in an isolated frame.
// Keep this narrower than the canvas sanitizer: only inert presentation markup is allowed.
const HTML_TAGS = new Set('a b blockquote br code del div em figcaption figure h1 h2 h3 h4 h5 h6 hr i img li mark ol p pre s small span strong sub sup table tbody td tfoot th thead tr u ul'.split(' '))
const HTML_STYLE = new Set('color font-family font-size font-style font-weight line-height text-align text-decoration vertical-align letter-spacing text-shadow background background-color'.split(' '))
const SVG_TAGS = new Set('svg g defs path rect circle ellipse line polyline polygon text tspan image use lineargradient radialgradient stop clippath mask pattern marker title desc'.split(' '))
const SVG_ATTRS = new Set('xmlns xmlns:xlink viewbox preserveaspectratio width height x y x1 x2 y1 y2 cx cy r rx ry d points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-miterlimit opacity color offset stop-color stop-opacity gradientunits gradienttransform spreadmethod fx fy fr clip-path mask patternunits patterncontentunits patterntransform markerwidth markerheight refx refy orient text-anchor dominant-baseline font-size font-family font-weight font-style letter-spacing id'.split(' '))
const SVG_STYLE = new Set('fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity color stop-color stop-opacity font-size font-family font-weight font-style text-anchor dominant-baseline letter-spacing'.split(' '))
const RASTER_DATA = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i
const LOCAL_REFERENCE = /^#[a-zA-Z_][\w:.-]*$/

function safeImageSource(value) {
  const url = String(value || '').trim()
  if (/^data:/i.test(url)) return RASTER_DATA.test(url)
  return isSafeHref(url) && !/^(?:mailto:|tel:|#)/i.test(url)
}

function safeStyle(value, properties, svg = false) {
  return String(value || '').split(';').map((declaration) => {
    const colon = declaration.indexOf(':')
    if (colon < 0) return ''
    const name = declaration.slice(0, colon).trim().toLowerCase()
    const css = declaration.slice(colon + 1).trim()
    if (!properties.has(name) || !css || /[\\@{}<>]|\p{Cc}/u.test(css) || /(?:expression|javascript|behavior|binding|@import|image-set|cross-fade|paint|var)\s*\(/i.test(css)) return ''
    // SVG gradients use local paint servers; no external CSS/resource URLs.
    if (/url\s*\(/i.test(css) && (!svg || !/^(?:url\(#[a-zA-Z_][\w:.-]*\)|none)$/i.test(css))) return ''
    return `${name}: ${css}`
  }).filter(Boolean).join('; ')
}

function cleanHtml(root) {
  for (const node of Array.from(root.children)) {
    if (!HTML_TAGS.has(node.localName)) {
      node.remove()
      continue
    }
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      if (name === 'style') {
        const style = safeStyle(attr.value, HTML_STYLE)
        if (style) node.setAttribute('style', style)
        else node.removeAttribute(attr.name)
      } else if (name === 'href' && node.localName === 'a' && isSafeHref(attr.value)) {
        // Keep valid links for appearance; the preview host is inert.
      } else if (name === 'src' && node.localName === 'img' && safeImageSource(attr.value)) {
        // Only image elements may initiate image loads.
      } else if ((name === 'alt' && node.localName === 'img') || name === 'title') {
        // Text-only attributes.
      } else if ((name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan') && /^\d{1,4}$/.test(attr.value)) {
        // Static dimensions and table layout.
      } else {
        node.removeAttribute(attr.name)
      }
    }
    cleanHtml(node)
  }
}

export function sanitizeThumbnailHtml(content) {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(`<div>${sanitizeRichTextHtml(content)}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return ''
  cleanHtml(root)
  return root.innerHTML
}

function cleanSvg(node) {
  for (const child of Array.from(node.children)) {
    if (child.namespaceURI !== 'http://www.w3.org/2000/svg' || !SVG_TAGS.has(child.localName.toLowerCase())) child.remove()
    else cleanSvg(child)
  }
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase()
    const value = attr.value.trim()
    if (name === 'style') {
      const style = safeStyle(value, SVG_STYLE, true)
      if (style) node.setAttribute('style', style)
      else node.removeAttribute(attr.name)
    } else if (name === 'href' || name === 'xlink:href') {
      if (!((node.localName === 'use' && LOCAL_REFERENCE.test(value)) || (node.localName === 'image' && (LOCAL_REFERENCE.test(value) || safeImageSource(value))))) node.removeAttribute(attr.name)
    } else if (!SVG_ATTRS.has(name) || /[\\@{}<>]|\p{Cc}/u.test(value) || /url\s*\(/i.test(value) && !/^(?:url\(#[a-zA-Z_][\w:.-]*\)|none)$/.test(value)) {
      node.removeAttribute(attr.name)
    }
  }
}

export function sanitizeThumbnailSvg(content) {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(String(content || ''), 'image/svg+xml')
  const root = doc.documentElement
  if (root?.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg' || doc.querySelector('parsererror')) return ''
  cleanSvg(root)
  return new XMLSerializer().serializeToString(root)
}
