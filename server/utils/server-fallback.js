const { isNativeChartType, normalizeCssColor } = require('revealjs-shared')
const { normalizeServerImageSource } = require('./server-image-source')
const { rasterizeStaticVisualElement } = require('./server-background-raster')

// timeline and game are static-renderable via the Phase-4 shared HTML renderers
// (timeline → SVG with event images; game → labeled placeholder badge), so they
// route through the rasterizer instead of crashing the strict export.
const STATIC_VISUAL_TYPES = new Set([
  'html',
  'latex',
  'icon',
  'drawing',
  'markdown',
  'qrcode',
  'svg',
  'timeline',
  'game',
])

function isRasterizable(element) {
  if (!element) return false
  if (STATIC_VISUAL_TYPES.has(element.type)) return true
  if (element.type === 'chart') return !isNativeChartType((element.chartType || '').toLowerCase())
  return false
}

function addPlaceholder(slide, bounds, element) {
  const fill = normalizeCssColor('#1f2937').color
  const line = normalizeCssColor('#94a3b8').color
  const text = normalizeCssColor('#e2e8f0').color

  slide.addShape('rect', {
    ...bounds,
    fill: { color: fill, transparency: 12 },
    line: { color: line, width: 1 },
    rotate: element.rotation || 0,
  })
  slide.addText(`${element.type || 'element'} preview unavailable`, {
    ...bounds,
    margin: 0.08,
    color: text,
    fontSize: 11,
    align: 'center',
    valign: 'mid',
    fit: 'shrink',
    rotate: element.rotation || 0,
  })
}

async function addFallbackElement(slide, element, bounds, warnings, slideNumber, options = {}) {
  const {
    baseUrl = '',
    resolution,
    rasterCache,
    // injectable so unit tests can exercise routing/isolation without a browser
    rasterizeElement = rasterizeStaticVisualElement,
  } = options

  if (element.type === 'video' && element.poster) {
    const source = normalizeServerImageSource(element.poster)
    if (source) {
      slide.addImage({ ...source, ...bounds, rotate: element.rotation || 0 })
      warnings.push(`Slide ${slideNumber}: used video poster fallback`)
      return
    }
  }

  if (isRasterizable(element)) {
    let rasterData = null
    try {
      rasterData = await rasterizeElement(element, { baseUrl, resolution, cache: rasterCache })
    } catch (error) {
      warnings.push(`Slide ${slideNumber}: rasterization error for ${element.type} (${error.message})`)
    }

    if (rasterData) {
      slide.addImage({ data: rasterData, ...bounds, rotate: element.rotation || 0 })
      warnings.push(`Slide ${slideNumber}: rasterized ${element.type} fallback`)
      return
    }
    // Per-element isolation (strict or not): a single element that cannot be
    // rasterized degrades to a gray placeholder so the deck still exports —
    // it must never throw and abort the whole presentation.
  }

  addPlaceholder(slide, bounds, element)
  warnings.push(`Slide ${slideNumber}: inserted placeholder for ${element.type}`)
}

module.exports = {
  addFallbackElement,
}
