const pptxgen = require('pptxgenjs')
const {
  getPptxLayout,
  getPresentationResolution,
  getSlideNotes,
  normalizePresentationNotes,
} = require('revealjs-shared')
const { normalizePptxImportedPresentationForRead } = require('../services/presentation-normalization')
const { applySlideBackground } = require('./server-background')
const { addElementToPptxSlide } = require('./server-renderers')
const { getServerRasters } = require('./server-raster')

function getSafeTitle(title) {
  return String(title || 'Presentation').trim() || 'Presentation'
}

function getPptxExportLayout(presentation) {
  const originalSize = presentation && presentation._pptxMeta && presentation._pptxMeta.originalSize
  const width = Number(originalSize && originalSize.width)
  const height = Number(originalSize && originalSize.height)
  if (width > 0 && height > 0) return { width, height }
  return getPresentationResolution(presentation)
}

async function exportToFile(sourcePresentation, filePath, options = {}) {
  const baseUrl = options.baseUrl || process.env.NAVSLIDES_API_URL || ''
  const strictRaster = options.strictRaster !== false
  const allowFallback = Boolean(options.allowFallback)

  const presentation = normalizePresentationNotes(
    normalizePptxImportedPresentationForRead(sourcePresentation || {})
  )
  const warnings = []

  const pptx = new pptxgen()
  const resolution = getPresentationResolution(presentation)
  const layout = getPptxLayout(getPptxExportLayout(presentation))

  pptx.defineLayout({ name: 'NAVSLIDES', width: layout.width, height: layout.height })
  pptx.layout = 'NAVSLIDES'
  pptx.title = getSafeTitle(presentation && presentation.title)

  // Per-export raster cache: isolates this invocation so concurrent exports
  // can't wipe or share each other's memoized rasters.
  const rasterCache = new Map()
  const rasterOverrides = await getServerRasters(presentation, { baseUrl, cache: rasterCache })

  for (const [index, sourceSlide] of (presentation.slides || []).entries()) {
    const slideNumber = index + 1
    const slide = pptx.addSlide()

    await applySlideBackground(slide, sourceSlide, resolution, {
      warnings,
      slideNumber,
      baseUrl,
      strictRaster,
      allowFallback,
    })

    const elements = [...(sourceSlide.elements || [])]
      .filter((element) => !(element.hidden || false))
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const element of elements) {
      await addElementToPptxSlide({
        slide,
        element,
        resolution,
        layout,
        pptx,
        warnings,
        slideNumber,
        rasterOverrides,
        strictRaster,
        allowFallback,
        baseUrl,
        rasterCache,
      })
    }

    const notes = getSlideNotes(sourceSlide)
    if (notes) slide.addNotes(notes)
  }

  await pptx.writeFile({ fileName: filePath })

  return { warnings }
}

module.exports = {
  exportToFile,
}
