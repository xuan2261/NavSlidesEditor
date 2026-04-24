const { chromium } = require('playwright')
const { generatePrintHTML, normalizePresentationNotes } = require('revealjs-shared')

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 540
const SCREENSHOT_SCALE = Number(process.env.NAVSLIDES_PPTX_SCALE || 2)
const RASTER_TYPES = new Set(['html', 'latex'])

const CDN_TO_VENDOR = [
  [/cdn\.jsdelivr\.net\/npm\/d3(?:@[^/"']*)?/i, '/vendor/d3/dist/d3.min.js'],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]+\/d3\.min\.js/i, '/vendor/d3/dist/d3.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/"']*)?/i, '/vendor/chart.js/dist/chart.umd.js'],
  [/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.css/i, '/vendor/katex/dist/katex.min.css'],
  [/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.js/i, '/vendor/katex/dist/katex.min.js'],
  [/tikzjax\.com\/v1\/fonts\.css/i, '/vendor/tikzjax/fonts.css'],
  [/tikzjax\.com\/v1\/tikzjax\.js/i, '/vendor/tikzjax/tikzjax.js'],
]

function getResolution(presentation) {
  return {
    width: Number(presentation?.resolution?.width) || DEFAULT_WIDTH,
    height: Number(presentation?.resolution?.height) || DEFAULT_HEIGHT,
  }
}

function resolveVendorPath(url) {
  const raw = String(url || '')
  const vendorIndex = raw.indexOf('/vendor/')
  if (vendorIndex >= 0) return raw.slice(vendorIndex)
  const match = CDN_TO_VENDOR.find(([pattern]) => pattern.test(raw))
  return match ? match[1] : ''
}

function canPassThroughRequest(url, baseUrl) {
  const raw = String(url || '')
  return (
    raw === 'about:blank' ||
    raw.startsWith('data:') ||
    raw.startsWith('blob:') ||
    (baseUrl && raw.startsWith(`${baseUrl}/`))
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

function collectRasterTargets(presentation) {
  return (presentation.slides || []).flatMap((slide, slideIndex) =>
    (slide.elements || [])
      .filter((element) => element?.id && RASTER_TYPES.has(element.type))
      .map((element) => ({ id: element.id, slideIndex }))
  )
}

async function installVendorRoute(page, baseUrl) {
  if (!baseUrl) return
  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url()
    const vendorPath = resolveVendorPath(requestUrl)
    if (!vendorPath) {
      if (canPassThroughRequest(requestUrl, baseUrl)) {
        await route.continue()
        return
      }
      await route.abort('blockedbyclient')
      return
    }

    const response = await fetch(`${baseUrl}${vendorPath}`)
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
  })
}

async function rasterizeComplexElements(sourcePresentation, { baseUrl = '' } = {}) {
  const presentation = normalizePresentationNotes(sourcePresentation || {})
  const targets = collectRasterTargets(presentation)
  if (!targets.length) return {}

  const resolution = getResolution(presentation)
  const scale = Math.min(4, Math.max(1, SCREENSHOT_SCALE || 2))
  const html = generatePrintHTML(presentation, {
    autoPrint: false,
    includePrintBar: false,
    fragmentMode: 'final',
    baseUrl,
    exportElementIds: true,
    exportReadyDelayMs: 300,
  })

  let browser
  try {
    browser = await chromium.launch(getLaunchOptions())
    const context = await browser.newContext({
      viewport: { width: resolution.width, height: resolution.height },
      deviceScaleFactor: scale,
    })
    const page = await context.newPage()
    await installVendorRoute(page, baseUrl)
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction('window.__navslidesExportReady === true', null, {
      timeout: 15000,
    })
    await page.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready : true')
    await page.waitForTimeout(150)

    const rasters = {}
    for (const target of targets) {
      const slidePage = page.locator('.slide-page').nth(target.slideIndex)
      const element = slidePage.locator(`[data-export-element-id="${target.id}"]`).first()
      await element.waitFor({ state: 'visible', timeout: 5000 })
      const buffer = await element.screenshot({
        type: 'png',
        animations: 'disabled',
        omitBackground: true,
      })
      rasters[target.id] = `data:image/png;base64,${buffer.toString('base64')}`
    }
    await context.close()
    return rasters
  } finally {
    if (browser) await browser.close()
  }
}

module.exports = {
  rasterizeComplexElements,
}
