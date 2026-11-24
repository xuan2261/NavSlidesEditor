import { portableMimeMatches } from 'revealjs-shared/src/education/portable-resource-contract.js'
const CDN_MAP = [
  [/^https:\/\/cdn\.jsdelivr\.net\/npm\/d3(?:@[^/]*)?(?:\/.*)?$/i, '/vendor/d3/dist/d3.min.js'],
  [
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/]*)?(?:\/.*)?$/i,
    '/vendor/chart.js/dist/chart.umd.js',
  ],
  [
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/marked(?:@[^/]*)?(?:\/.*)?$/i,
    '/vendor/marked/marked.min.js',
  ],
  [
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/]*)?\/dist\/katex\.min\.js$/i,
    '/vendor/katex/dist/katex.min.js',
  ],
  [
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/]*)?\/dist\/katex\.min\.css$/i,
    '/vendor/katex/dist/katex.min.css',
  ],
  [
    /^https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]+\/d3\.min\.js$/i,
    '/vendor/d3/dist/d3.min.js',
  ],
]
export function resolvePortableUrl(reference, base, origin) {
  const url = new URL(reference, base)
  const mapped = CDN_MAP.find(([pattern]) => pattern.test(url.href))
  if (mapped) return new URL(mapped[1], origin).href
  return url.href
}
export function bytesToDataUrl(bytes, mime) {
  let binary = ''
  for (let start = 0; start < bytes.length; start += 8192)
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192))
  return `data:${mime};base64,${btoa(binary)}`
}
export function decodeDataUrl(url) {
  const comma = url.indexOf(',')
  if (comma < 0) throw new TypeError('Malformed data URL')
  const header = url.slice(5, comma)
  const mime = (header.split(';')[0] || 'text/plain').toLowerCase()
  const payload = decodeURIComponent(url.slice(comma + 1))
  const bytes = /;base64(?:;|$)/i.test(header)
    ? Uint8Array.from(atob(payload), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(payload)
  return { mime, bytes }
}
export function resourceKind(url) {
  if (/^data:/i.test(url)) {
    const mime = url.slice(5, url.indexOf(',')).split(';')[0].toLowerCase()
    if (portableMimeMatches('font', mime)) return 'font'
    if (portableMimeMatches('media', mime)) return 'media'
    return 'image'
  }
  const path = new URL(url, 'https://portable.invalid/').pathname
  if (/\.(?:woff2?|ttf|otf|eot)$/i.test(path)) return 'font'
  if (/\.(?:mp[34]|webm|ogg|wav|m4a|vtt)$/i.test(path)) return 'media'
  return 'image'
}
