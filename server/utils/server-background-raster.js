const { staticRasterTargetId } = require('revealjs-shared/src/education/static-raster-targets.js')
const { chromium } = require('playwright')
const { generatePrintHTML, normalizePresentationNotes } = require('revealjs-shared')
const { getServerRasters } = require('./server-raster')
const { loadRasterHTML } = require('./server-raster-vendor-route.js')

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 540
const SCREENSHOT_SCALE = Number(process.env.NAVSLIDES_PPTX_SCALE || 2)

function getResolution(resolution) {
  return {
    width: Number(resolution && resolution.width) || DEFAULT_WIDTH,
    height: Number(resolution && resolution.height) || DEFAULT_HEIGHT,
  }
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
    await loadRasterHTML(page, html, baseUrl)
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

async function rasterizeStaticVisualElement(
  element,
  { baseUrl = '', resolution, cache, teacherReveal = false, designTokens } = {}
) {
  if (!element || !element.id || !element.type) return null

  const workingResolution = getResolution(resolution)
  const presentation = normalizePresentationNotes({
    title: 'single-element-raster',
    resolution: workingResolution,
    designTokens,
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
    teacherReveal: teacherReveal === true,
    rasterTypes: [element.type],
    ...(cache ? { cache } : {}),
  })

  return rasters[staticRasterTargetId(element, 'single-slide')] || null
}

module.exports = {
  rasterizeBackground,
  rasterizeStaticVisualElement,
}
