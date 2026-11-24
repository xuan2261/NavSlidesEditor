const fs = require('node:fs/promises')
const path = require('node:path')

const RASTER_ORIGIN = 'http://navslides-raster.invalid'
const VENDOR_DIR = path.resolve(__dirname, '..', 'vendor')
const CDN_TO_VENDOR = [
  [/cdn\.jsdelivr\.net\/npm\/d3(?:@[^/"']*)?/i, '/vendor/d3/dist/d3.min.js'],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]+\/d3\.min\.js/i, '/vendor/d3/dist/d3.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/"']*)?/i, '/vendor/chart.js/dist/chart.umd.js'],
  [
    /cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.css/i,
    '/vendor/katex/dist/katex.min.css',
  ],
  [
    /cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.js/i,
    '/vendor/katex/dist/katex.min.js',
  ],
  [/tikzjax\.com\/v1\/fonts\.css/i, '/vendor/tikzjax/fonts.css'],
  [/tikzjax\.com\/v1\/tikzjax\.js/i, '/vendor/tikzjax/tikzjax.js'],
]
const CONTENT_TYPES = {
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.gz': 'application/gzip',
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '')
}

function resolveVendorPath(url) {
  const raw = String(url || '')
  try {
    const pathname = new URL(raw, RASTER_ORIGIN).pathname
    if (pathname.startsWith('/vendor/')) return pathname
  } catch {
    return ''
  }
  const match = CDN_TO_VENDOR.find(([pattern]) => pattern.test(raw))
  return match ? match[1] : ''
}

function canPassThroughRequest(url, baseUrl) {
  const raw = String(url || '')
  if (raw === 'about:blank' || raw.startsWith('data:') || raw.startsWith('blob:')) return true
  if (!baseUrl) return false
  try {
    const request = new URL(raw),
      base = new URL(normalizeBaseUrl(baseUrl))
    return (
      ['http:', 'https:'].includes(base.protocol) &&
      base.origin !== RASTER_ORIGIN &&
      request.origin === base.origin
    )
  } catch {
    return false
  }
}

function vendorFilePath(vendorPath) {
  try {
    const relative = decodeURIComponent(vendorPath.slice('/vendor/'.length))
    if (
      !relative ||
      relative.includes('\\') ||
      relative.includes('\0') ||
      relative.split('/').some((part) => part === '..' || part === '.')
    )
      return ''
    const resolved = path.resolve(VENDOR_DIR, relative)
    return resolved.startsWith(`${VENDOR_DIR}${path.sep}`) ? resolved : ''
  } catch {
    return ''
  }
}

async function installVendorRoute(page, baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    if (!normalizedBaseUrl && requestUrl === `${RASTER_ORIGIN}/`) {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!doctype html><html></html>',
      })
      return
    }
    const vendorPath = resolveVendorPath(requestUrl)
    if (!vendorPath) {
      if (canPassThroughRequest(requestUrl, normalizedBaseUrl)) await route.continue()
      else await route.abort('blockedbyclient')
      return
    }
    const filePath = vendorFilePath(vendorPath)
    if (!filePath) {
      await route.abort('blockedbyclient')
      return
    }
    try {
      const [root, file] = await Promise.all([fs.realpath(VENDOR_DIR), fs.realpath(filePath)])
      if (!file.startsWith(`${root}${path.sep}`)) {
        await route.abort('blockedbyclient')
        return
      }
      await route.fulfill({
        status: 200,
        contentType:
          CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        headers: { 'access-control-allow-origin': '*' },
        body: await fs.readFile(file),
      })
    } catch {
      // Missing or unreadable pinned assets must fail, never fall back to the network.
      await route.abort('failed')
    }
  })
}

async function loadRasterHTML(page, html, baseUrl) {
  await installVendorRoute(page, baseUrl)
  // A real controlled origin gives relative vendor URLs and IndexedDB a usable base.
  if (!normalizeBaseUrl(baseUrl)) await page.goto(`${RASTER_ORIGIN}/`, { waitUntil: 'load' })
  await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
}

module.exports = {
  canPassThroughRequest,
  installVendorRoute,
  loadRasterHTML,
  normalizeBaseUrl,
  resolveVendorPath,
}
