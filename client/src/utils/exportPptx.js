import pptxgen from 'pptxgenjs'
import { applySlideBackground } from './export-pptx-background'
import {
  attachPptxExportReport,
  getPptxExportLayout,
  getPptxLayout,
  getPresentationResolution,
} from './export-pptx-core'
import { addElementToPptxSlide } from './export-pptx-renderers'
import { clearPptxRasterAssetCaches } from './export-pptx-raster'
import { getSlideNotes } from './slide-notes'
import { DEFAULT_TOKENS, getPptxElementExportStrategy, mergeTokens } from 'revealjs-shared'

function getSafeFilename(title) {
  return `${String(title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`
}

function requiresServerRaster(element) {
  return getPptxElementExportStrategy(element).mode === 'server-prefetch-raster'
}

function hasServerRasterElements(slides) {
  return (slides || []).some((slide) => {
    const elements = (slide.elements || []).filter((element) => !(element.hidden || false))
    return elements.some(requiresServerRaster)
  })
}

function hasServerOnlyElements(presentation) {
  return hasServerRasterElements(presentation?.slides || [])
}

function validateServerRasterElementIds(slides) {
  const seen = new Map()

  for (const [slideIndex, slide] of (slides || []).entries()) {
    for (const element of slide.elements || []) {
      if (element.hidden || false) continue
      const id = typeof element.id === 'string' ? element.id.trim() : ''
      if (requiresServerRaster(element) && !id) {
        throw new Error(
          `PPTX export requires a stable id for ${element.type} on slide ${slideIndex + 1}`
        )
      }
      if (!id) continue
      const previous = seen.get(id)
      if (
        previous &&
        (requiresServerRaster(previous.element) || requiresServerRaster(element))
      ) {
        throw new Error(
          `PPTX export found duplicate element id "${id}" on slides ${previous.slideIndex + 1} and ${slideIndex + 1}`
        )
      }
      seen.set(id, { slideIndex, type: element.type, element })
    }
  }

}

function getServerOnlyElementIds(slides) {
  return (slides || []).flatMap((slide) =>
    (slide.elements || [])
      .filter((element) => !(element.hidden || false) && requiresServerRaster(element))
      .map((element) => element.id.trim())
  )
}

function withoutHiddenElements(presentation) {
  return {
    ...presentation,
    slides: (presentation?.slides || []).map((slide) => ({
      ...slide,
      elements: (slide.elements || []).filter((element) => !(element.hidden || false)),
    })),
  }
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
  validateServerRasterElementIds(presentation?.slides || [])
  if (!canUseServerRaster()) {
    throw new Error('PPTX export with HTML or LaTeX requires the NavSlides server renderer')
  }

  const response = await fetch('/api/presentations/raster-elements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ presentation: withoutHiddenElements(presentation) }),
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
    throw new Error(`Server PPTX rasterization missed ${missing.length} required element(s)`)
  }
  return rasters
}

async function exportToPptxClient(presentation, rasterOverrides = {}) {
  const pptx = new pptxgen()
  const resolution = getPresentationResolution(presentation)
  const layout = getPptxLayout(getPptxExportLayout(presentation))
  const warnings = []
  attachPptxExportReport(warnings)

  pptx.defineLayout({ name: 'NAVSLIDES_CUSTOM', width: layout.width, height: layout.height })
  pptx.layout = 'NAVSLIDES_CUSTOM'
  pptx.title = presentation?.title || 'Presentation'

  for (const [slideIndex, sourceSlide] of (presentation?.slides || []).entries()) {
    const slideNumber = slideIndex + 1
    const slide = pptx.addSlide()
    const slideTokens = mergeTokens(
      mergeTokens(DEFAULT_TOKENS, presentation?.designTokens),
      sourceSlide?.designTokens
    )
    await applySlideBackground(slide, sourceSlide.background, resolution, layout, warnings, slideNumber, slideTokens)

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
        designTokens: slideTokens,
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
