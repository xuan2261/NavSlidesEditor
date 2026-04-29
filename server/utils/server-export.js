const pptxgen = require('pptxgenjs')
const {
  getPptxLayout,
  getPresentationResolution,
  getSlideNotes,
  normalizePresentationNotes,
} = require('revealjs-shared')
const { applySlideBackground } = require('./server-background')
const { addElementToPptxSlide } = require('./server-renderers')
const { clearRasterCache, getServerRasters } = require('./server-raster')

function getSafeTitle(title) {
  return String(title || 'Presentation').trim() || 'Presentation'
}

async function exportToFile(sourcePresentation, filePath, options = {}) {
  const baseUrl = options.baseUrl || process.env.NAVSLIDES_API_URL || ''
  const strictRaster = options.strictRaster !== false
  const allowFallback = Boolean(options.allowFallback)

  const presentation = normalizePresentationNotes(sourcePresentation || {})
  const warnings = []

  const pptx = new pptxgen()
  const resolution = getPresentationResolution(presentation)
  const layout = getPptxLayout(resolution)

  pptx.defineLayout({ name: 'NAVSLIDES', width: layout.width, height: layout.height })
  pptx.layout = 'NAVSLIDES'
  pptx.title = getSafeTitle(presentation && presentation.title)

  const rasterOverrides = await getServerRasters(presentation, { baseUrl })

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

    const elements = [...(sourceSlide.elements || [])].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
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
      })
    }

    const notes = getSlideNotes(sourceSlide)
    if (notes) slide.addNotes(notes)
  }

  await pptx.writeFile({ fileName: filePath })
  clearRasterCache()

  return { warnings }
}

module.exports = {
  exportToFile,
}
