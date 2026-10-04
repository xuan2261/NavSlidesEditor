const { getCurvedLineRasterGeometry } = require('revealjs-shared/src/curved-line-raster.js')
const { captureCurvedLine } = require('./server-curved-line-capture.js')
const {
  prepareStaticRasterPresentation,
} = require('revealjs-shared/src/education/static-raster-targets.js')
const { chromium } = require('playwright')
const crypto = require('crypto')
const {
  canPassThroughRequest,
  installVendorRoute,
  loadRasterHTML,
  normalizeBaseUrl,
  resolveVendorPath,
} = require('./server-raster-vendor-route.js')
const {
  generatePrintHTML,
  getPptxElementExportStrategy,
  hasPptxImageVisualEffects,
  isNativeChartType,
  isPptxRasterSafeImageSource,
  normalizePresentationNotes,
} = require('revealjs-shared')

const DEFAULT_WIDTH = 960
const DEFAULT_HEIGHT = 540
const SCREENSHOT_SCALE = Number(process.env.NAVSLIDES_PPTX_SCALE || 2)
const DEFAULT_RASTER_TYPES = new Set([
  'html',
  'latex',
  'icon',
  'drawing',
  'markdown',
  'qrcode',
  'svg',
  'timeline',
  'game',
  'image',
  'line',
])

function getResolution(presentation) {
  return {
    width:
      Number(presentation && presentation.resolution && presentation.resolution.width) ||
      DEFAULT_WIDTH,
    height:
      Number(presentation && presentation.resolution && presentation.resolution.height) ||
      DEFAULT_HEIGHT,
  }
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
  if (!element) return false
  if (element.type === 'line') {
    return rasterTypes.has('line') && getPptxElementExportStrategy(element).requiresServer === true
  }
  if (element.type === 'image') {
    return (
      rasterTypes.has('image') &&
      hasPptxImageVisualEffects(element) &&
      isPptxRasterSafeImageSource(element.src)
    )
  }
  if (rasterTypes.has(element.type)) return true
  if (element.type === 'chart' && !isNativeChartType((element.chartType || '').toLowerCase()))
    return true
  return false
}

function validateRasterTargetIds(presentation, rasterTypes) {
  const seen = new Map()
  for (const [slideIndex, slide] of (presentation.slides || []).entries()) {
    for (const element of slide.elements || []) {
      if (element.hidden || !shouldRasterElement(element, rasterTypes)) continue
      if (typeof element.id !== 'string' || !element.id.trim()) {
        // Legacy decks can carry id-less raster elements; assign one so the
        // render/match pipeline can target them.
        element.id = crypto.randomUUID()
      }
      const id = element.id.trim()
      const previous = seen.get(id)
      if (previous) {
        const error = new Error(
          `Duplicate raster target id "${id}" on slides ${previous.slideIndex + 1} and ${slideIndex + 1}`
        )
        error.code = 'INVALID_RASTER_TARGETS'
        throw error
      }
      seen.set(id, { slideIndex, type: element.type })
    }
  }
}

function collectRasterTargets(presentation, rasterTypes) {
  validateRasterTargetIds(presentation, rasterTypes)
  return (presentation.slides || []).flatMap((slide, slideIndex) =>
    (slide.elements || [])
      .filter((element) => !(element.hidden || false))
      .filter((element) => shouldRasterElement(element, rasterTypes))
      .map((element) => ({
        id: element.id.trim(),
        slideIndex,
        type: element.type,
        ...(element.type === 'line' ? { geometry: getCurvedLineRasterGeometry(element) } : {}),
      }))
  )
}

function getCacheKey(presentation, baseUrl, rasterTypes, teacherReveal) {
  const contentHash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({
        resolution: presentation?.resolution || null,
        designTokens: presentation?.designTokens || null,
        teacherReveal: teacherReveal === true,
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

async function captureRasters(html, targets, { resolution, scale, baseUrl }) {
  let browser
  const rasters = {}
  try {
    try {
      browser = await chromium.launch(getLaunchOptions())
    } catch (error) {
      throw new Error(
        `Failed to launch Chromium for PPTX rasterization. Run "npx playwright install chromium" ` +
          `(or set NAVSLIDES_CHROMIUM_PATH to a Chromium binary). Original error: ${error.message}`
      )
    }
    const context = await browser.newContext({
      viewport: { width: resolution.width, height: resolution.height },
      deviceScaleFactor: scale,
    })
    const page = await context.newPage()
    await loadRasterHTML(page, html, baseUrl)
    await page.waitForFunction('window.__navslidesExportReady === true', null, { timeout: 15000 })
    await page.evaluate('document.fonts && document.fonts.ready ? document.fonts.ready : true')
    await page.waitForTimeout(150)

    for (const target of targets) {
      try {
        const slidePage = page.locator('.slide-page').nth(target.slideIndex)
        const element = slidePage.locator(`[data-export-element-id="${target.id}"]`).first()
        await element.waitFor({ state: 'visible', timeout: 4000 })
        // Rotation is reapplied by the PPTX image object, not baked twice.
        await element.evaluate((node, image) => {
          node.style.transform = 'none'
          if (image) node.style.opacity = '1'
        }, target.type === 'image')
        if (target.type === 'line') {
          rasters[target.id] = await captureCurvedLine(element, target.geometry, scale)
          continue
        }
        if (target.type === 'game') {
          await element.evaluate(async (node) => {
            await Promise.all(
              [...node.querySelectorAll('img')].map(async (image) => {
                try {
                  await image.decode()
                } catch {
                  throw new Error(`Authored game media failed to load: ${image.alt || image.src}`)
                }
                if (!image.naturalWidth)
                  throw new Error('Authored game image has no decoded pixels')
              })
            )
          })
        }
        const buffer = await element.screenshot({
          type: 'png',
          animations: 'disabled',
          omitBackground: true,
        })
        rasters[target.id] = `data:image/png;base64,${buffer.toString('base64')}`
      } catch (error) {
        if (target.type === 'game' || target.type === 'line')
          throw new Error(`Failed to capture ${target.type} "${target.id}": ${error.message}`, {
            cause: error,
          })
        // Other targets remain unresolved for their existing export policy.
      }
    }

    await context.close()
  } finally {
    if (browser) await browser.close()
  }
  return rasters
}

// `cache` is an optional per-export Map for memoization. It defaults to a fresh
// Map per call so concurrent exports never share or wipe each other's entries
// (the previous global cache + end-of-export clear caused a cross-export race).
// `capture` is injectable so unit tests can exercise routing without launching
// a real browser.
async function getServerRasters(
  sourcePresentation,
  {
    baseUrl = '',
    teacherReveal = false,
    rasterTypes: customRasterTypes,
    cache = new Map(),
    capture = captureRasters,
  } = {}
) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const presentation = prepareStaticRasterPresentation(
    normalizePresentationNotes(sourcePresentation || {})
  )
  const rasterTypes = customRasterTypes ? new Set(customRasterTypes) : DEFAULT_RASTER_TYPES
  const targets = collectRasterTargets(presentation, rasterTypes)
  if (!targets.length) return {}

  const cacheKey = getCacheKey(presentation, normalizedBaseUrl, rasterTypes, teacherReveal)
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  const resolution = getResolution(presentation)
  const scale = Math.min(4, Math.max(1, SCREENSHOT_SCALE || 2))
  const html = generatePrintHTML(presentation, {
    autoPrint: false,
    includePrintBar: false,
    fragmentMode: 'final',
    baseUrl: normalizedBaseUrl,
    exportElementIds: true,
    exportReadyDelayMs: 300,
    teacherReveal: teacherReveal === true,
  })

  const rasters = await capture(html, targets, { resolution, scale, baseUrl: normalizedBaseUrl })
  const missingRequired = targets.filter(
    (target) => (target.type === 'game' || target.type === 'line') && !rasters[target.id]
  )
  if (missingRequired.length)
    throw new Error(
      `Missing authored raster capture: ${missingRequired.map((target) => `${target.type} "${target.id}"`).join(', ')}`
    )

  cache.set(cacheKey, rasters)
  return rasters
}

module.exports = {
  __private: {
    canPassThroughRequest,
    collectRasterTargets,
    installVendorRoute,
    resolveVendorPath,
    validateRasterTargetIds,
  },
  getServerRasters,
}
