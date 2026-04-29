import pptxgen from 'pptxgenjs'
import { applySlideBackground } from './export-pptx-background'
import { getPptxLayout, getPresentationResolution } from './export-pptx-core'
import { addElementToPptxSlide } from './export-pptx-renderers'
import { clearPptxRasterAssetCaches } from './export-pptx-raster'
import { getSlideNotes } from './slide-notes'

function getSafeFilename(title) {
  return `${String(title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`
}

function hasElementType(slides, types) {
  return (slides || []).some((slide) => {
    const elements = slide.elements || []
    return elements.some((element) => types.has(element.type))
  })
}

function hasServerOnlyElements(presentation) {
  return hasElementType(presentation?.slides || [], new Set(['html', 'latex']))
}

function getServerOnlyElementIds(slides) {
  return (slides || []).flatMap((slide) =>
    (slide.elements || [])
      .filter((element) => ['html', 'latex'].includes(element.type) && element.id)
      .map((element) => element.id)
  )
}

function canUseServerRaster() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof fetch === 'function'
  )
}

async function fetchComplexElementRasters(presentation) {
  if (!hasServerOnlyElements(presentation)) return {}
  if (!canUseServerRaster()) {
    throw new Error('PPTX export with HTML or LaTeX requires the NavSlides server renderer')
  }

  const response = await fetch('/api/presentations/raster-elements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation }),
  })

  if (!response.ok) {
    let message = `Server PPTX rasterization failed (${response.status})`
    try {
      const payload = await response.json()
      message = payload.details || payload.error || message
    } catch {}
    throw new Error(message)
  }

  const payload = await response.json()
  const rasters = payload?.rasters || {}
  const missing = getServerOnlyElementIds(presentation?.slides || []).filter((id) => !rasters[id])
  if (missing.length) {
    throw new Error(`Server PPTX rasterization missed ${missing.length} HTML/LaTeX element(s)`)
  }
  return rasters
}

async function exportToPptxClient(presentation, rasterOverrides = {}) {
  const pptx = new pptxgen()
  const resolution = getPresentationResolution(presentation)
  const layout = getPptxLayout(resolution)
  const warnings = []

  pptx.defineLayout({ name: 'NAVSLIDES_CUSTOM', width: layout.width, height: layout.height })
  pptx.layout = 'NAVSLIDES_CUSTOM'
  pptx.title = presentation?.title || 'Presentation'

  for (const [slideIndex, sourceSlide] of (presentation?.slides || []).entries()) {
    const slideNumber = slideIndex + 1
    const slide = pptx.addSlide()
    await applySlideBackground(slide, sourceSlide.background, resolution, layout, warnings, slideNumber)

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
      })
    }

    const speakerNotes = getSlideNotes(sourceSlide)
    if (speakerNotes) slide.addNotes(speakerNotes)
  }

  await pptx.writeFile({ fileName: getSafeFilename(presentation?.title) })
  return warnings
}

export async function exportToPptx(presentation) {
  try {
    const rasterOverrides = await fetchComplexElementRasters(presentation)
    return await exportToPptxClient(presentation, rasterOverrides)
  } finally {
    clearPptxRasterAssetCaches()
  }
}
