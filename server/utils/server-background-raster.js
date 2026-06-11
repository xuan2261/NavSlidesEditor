const { chromium } = require('playwright')
const { generatePrintHTML, normalizePresentationNotes } = require('revealjs-shared')
const { getServerRasters } = require('./server-raster')

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 540
const SCREENSHOT_SCALE = Number(process.env.NAVSLIDES_PPTX_SCALE || 2)

const CDN_TO_VENDOR = [
  [/cdn\.jsdelivr\.net\/npm\/d3(?:@[^/"']*)?/i, '/vendor/d3/dist/d3.min.js'],
  [/cdnjs\.cloudflare\.com\/ajax\/libs\/d3\/[^/]+\/d3\.min\.js/i, '/vendor/d3/dist/d3.min.js'],
  [/cdn\.jsdelivr\.net\/npm\/chart\.js(?:@[^/"']*)?/i, '/vendor/chart.js/dist/chart.umd.js'],
  [/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.css/i, '/vendor/katex/dist/katex.min.css'],
  [/cdn\.jsdelivr\.net\/npm\/katex(?:@[^/"']*)?\/?dist\/katex\.min\.js/i, '/vendor/katex/dist/katex.min.js'],
  [/tikzjax\.com\/v1\/fonts\.css/i, '/vendor/tikzjax/fonts.css'],
  [/tikzjax\.com\/v1\/tikzjax\.js/i, '/vendor/tikzjax/tikzjax.js'],
]

function getResolution(resolution) {
  return {
    width: Number(resolution && resolution.width) || DEFAULT_WIDTH,
    height: Number(resolution && resolution.height) || DEFAULT_HEIGHT,
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

    try {
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
    } catch {
      await route.abort('failed')
    }
  })
}

async function rasterizeBackground(background, resolution, { baseUrl = '' } = {}) {
  const slideResolution = getResolution(resolution)
  const presentation = normalizePresentationNotes({
    title: 'background-raster',
    resolution: slideResolution,
    slides: [
      {
        id: 'bg-slide',
        background,
        elements: [],
      },
    ],
  })

  const html = generatePrintHTML(presentation, {
    autoPrint: false,
    includePrintBar: false,
    fragmentMode: 'final',
    baseUrl,
    exportElementIds: false,
    exportReadyDelayMs: 300,
  })

  const scale = Math.min(4, Math.max(1, SCREENSHOT_SCALE || 2))
  let browser

  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.NAVSLIDES_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })

    const context = await browser.newContext({
      viewport: { width: slideResolution.width, height: slideResolution.height },
      deviceScaleFactor: scale,
    })
    const page = await context.newPage()
    await installVendorRoute(page, baseUrl)
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction('window.__navslidesExportReady === true', null, { timeout: 15000 })
    await page.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready : true')
    await page.waitForTimeout(120)

    const slidePage = page.locator('.slide-page').first()
    await slidePage.waitFor({ state: 'visible', timeout: 3000 })
    const buffer = await slidePage.screenshot({
      type: 'png',
      animations: 'disabled',
      omitBackground: false,
    })

    await context.close()
    return `data:image/png;base64,${buffer.toString('base64')}`
  } finally {
    if (browser) await browser.close()
  }
}

async function rasterizeStaticVisualElement(element, { baseUrl = '', resolution, cache } = {}) {
  if (!element || !element.id || !element.type) return null

  const workingResolution = getResolution(resolution)
  const presentation = normalizePresentationNotes({
    title: 'single-element-raster',
    resolution: workingResolution,
    slides: [
      {
        id: 'single-slide',
        background: { type: 'none' },
        elements: [element],
      },
    ],
  })

  const rasters = await getServerRasters(presentation, {
    baseUrl,
    rasterTypes: [element.type],
    ...(cache ? { cache } : {}),
  })

  return rasters[element.id] || null
}

module.exports = {
  rasterizeBackground,
  rasterizeStaticVisualElement,
}
