const { chromium } = require('playwright')
const crypto = require('crypto')
const { generatePrintHTML, normalizePresentationNotes, isNativeChartType } = require('revealjs-shared')

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 540
const SCREENSHOT_SCALE = Number(process.env.NAVSLIDES_PPTX_SCALE || 2)
const DEFAULT_RASTER_TYPES = new Set(['html', 'latex', 'icon', 'drawing', 'markdown', 'qrcode', 'svg'])

const CDN_TO_VENDOR = [
  [/cdn\.jsdelivr\.net\/npm\/d3(?:@[^/"']*)?/i, '/vendor/d3/dist/d3.min.js'],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]+\/d3\.min\.js/i, '/vendor/d3/dist/d3.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/"']*)?/i, '/vendor/chart.js/dist/chart.umd.js'],
  [/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.css/i, '/vendor/katex/dist/katex.min.css'],
  [/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.js/i, '/vendor/katex/dist/katex.min.js'],
  [/tikzjax\.com\/v1\/fonts\.css/i, '/vendor/tikzjax/fonts.css'],
  [/tikzjax\.com\/v1\/tikzjax\.js/i, '/vendor/tikzjax/tikzjax.js'],
]

const rasterCache = new Map()

function getResolution(presentation) {
  return {
    width: Number(presentation && presentation.resolution && presentation.resolution.width) || DEFAULT_WIDTH,
    height: Number(presentation && presentation.resolution && presentation.resolution.height) || DEFAULT_HEIGHT,
  }
}

function resolveVendorPath(url) {
  const raw = String(url || '')
  const vendorIndex = raw.indexOf('/vendor/')
  if (vendorIndex >= 0) return raw.slice(vendorIndex)
  const match = CDN_TO_VENDOR.find(([pattern]) => pattern.test(raw))
  return match ? match[1] : ''
}

function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim()
  return raw ? raw.replace(/\/+$/, '') : ''
}

function isSameOrigin(requestUrl, baseUrl) {
  const normalizedBase = normalizeBaseUrl(baseUrl)
  if (!normalizedBase) return false

  try {
    const request = new URL(requestUrl)
    const base = new URL(normalizedBase)
    return request.origin === base.origin
  } catch {
    return false
  }
}

function canPassThroughRequest(url, baseUrl) {
  const raw = String(url || '')
  const normalizedBase = normalizeBaseUrl(baseUrl)
  return (
    raw === 'about:blank' ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:') ||
    (normalizedBase && isSameOrigin(raw, normalizedBase))
  )
}

function getLaunchOptions() {
  const executablePath = process.env.NAVSLIDES_CHROMIUM_PATH || ''
  return {
    headless: true,
    executablePath: executablePath || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  }
}

function shouldRasterElement(element, rasterTypes) {
  if (!element || !element.id) return false
  if (rasterTypes.has(element.type)) return true
  if (element.type === 'chart' && !isNativeChartType((element.chartType || '').toLowerCase())) return true
  return false
}

function collectRasterTargets(presentation, rasterTypes) {
  return (presentation.slides || []).flatMap((slide, slideIndex) =>
    (slide.elements || [])
      .filter((element) => shouldRasterElement(element, rasterTypes))
      .map((element) => ({ id: element.id, slideIndex }))
  )
}

function getCacheKey(presentation, baseUrl, rasterTypes) {
  const contentHash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        resolution: presentation?.resolution || null,
        slides: presentation?.slides || [],
      })
    )
    .digest('hex')

  const summary = {
    id: presentation && presentation.id,
    contentHash,
    baseUrl,
    rasterTypes: [...rasterTypes].sort(),
  }
  return JSON.stringify(summary)
}

async function installVendorRoute(page, baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    const vendorPath = resolveVendorPath(requestUrl)

    if (!vendorPath && canPassThroughRequest(requestUrl, normalizedBaseUrl)) {
      await route.continue()
      return
    }

    if (!vendorPath || !normalizedBaseUrl) {
      await route.abort('blockedbyclient')
      return
    }

    try {
      const response = await fetch(`${normalizedBaseUrl}${vendorPath}`)
      if (!response.ok) {
        await route.abort('failed')
        return
      }
      await route.fulfill({
        status: response.status,
        headers: {
          'content-type': response.headers.get('content-type') || 'application/octet-stream',
          'access-control-allow-origin': '*',
        },
        body: Buffer.from(await response.arrayBuffer()),
      })
    } catch {
      await route.abort('failed')
    }
  })
}

async function getServerRasters(sourcePresentation, { baseUrl = '', rasterTypes: customRasterTypes } = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const presentation = normalizePresentationNotes(sourcePresentation || {})
  const rasterTypes = customRasterTypes ? new Set(customRasterTypes) : DEFAULT_RASTER_TYPES
  const targets = collectRasterTargets(presentation, rasterTypes)
  if (!targets.length) return {}

  const cacheKey = getCacheKey(presentation, normalizedBaseUrl, rasterTypes)
  if (rasterCache.has(cacheKey)) return rasterCache.get(cacheKey)

  const resolution = getResolution(presentation)
  const scale = Math.min(4, Math.max(1, SCREENSHOT_SCALE || 2))
  const html = generatePrintHTML(presentation, {
    autoPrint: false,
    includePrintBar: false,
    fragmentMode: 'final',
    baseUrl: normalizedBaseUrl,
    exportElementIds: true,
    exportReadyDelayMs: 300,
  })

  let browser
  const rasters = {}
  try {
    browser = await chromium.launch(getLaunchOptions())
    const context = await browser.newContext({
      viewport: { width: resolution.width, height: resolution.height },
      deviceScaleFactor: scale,
    })
    const page = await context.newPage()
    await installVendorRoute(page, normalizedBaseUrl)
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction('window.__navslidesExportReady === true', null, { timeout: 15000 })
    await page.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready : true')
    await page.waitForTimeout(150)

    for (const target of targets) {
      try {
        const slidePage = page.locator('.slide-page').nth(target.slideIndex)
        const element = slidePage.locator(`[data-export-element-id="${target.id}"]`).first()
        await element.waitFor({ state: 'visible', timeout: 4000 })
        const buffer = await element.screenshot({
          type: 'png',
          animations: 'disabled',
          omitBackground: true,
        })
        rasters[target.id] = `data:image/png;base64,${buffer.toString('base64')}`
      } catch {
        // keep non-rasterized target unresolved; strict mode decides later
      }
    }

    await context.close()
  } finally {
    if (browser) await browser.close()
  }

  rasterCache.set(cacheKey, rasters)
  return rasters
}

function clearRasterCache() {
  rasterCache.clear()
}

module.exports = {
  __private: {
    canPassThroughRequest,
    installVendorRoute,
    resolveVendorPath,
  },
  clearRasterCache,
  getServerRasters,
}
