import pptxgen from 'pptxgenjs'
import { applySlideBackground } from './export-pptx-background'
import {
  attachPptxExportReport,
  getPptxExportLayout,
  getPptxLayout,
  getPresentationResolution,
  recordPptxExportWarning,
} from './export-pptx-core'
import { addElementToPptxSlide } from './export-pptx-renderers'
import { clearPptxRasterAssetCaches } from './export-pptx-raster'
import { getSlideNotes } from './slide-notes'
import {
  DEFAULT_TOKENS,
  getPptxElementExportStrategy,
  mergeTokens,
  resolveConnectorGeometry,
  resolveEffectiveSlide,
} from 'revealjs-shared'

function resolvePptxSlide(sourceSlide, layoutMasters, warnings, slideNumber) {
  const { slide, warnings: layoutWarnings } = resolveEffectiveSlide(sourceSlide, layoutMasters)
  if (sourceSlide?.layoutId) {
    recordPptxExportWarning(warnings, {
      element: { id: sourceSlide.layoutId, type: 'layout' },
      slideNumber,
      message: `Slide ${slideNumber}: linked layout was flattened for PowerPoint export; native PowerPoint masters are not preserved.`,
      fallback: 'flattened-elements',
    })
  }
  layoutWarnings.forEach((warning) => warnings.push(`Slide ${slideNumber}: ${warning}`))
  return slide
}

function getSafeFilename(title) {
  return `${String(title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`
}

function requiresServerRaster(element) {
  return getPptxElementExportStrategy(element).mode === 'server-prefetch-raster'
}

function flattenPptxSlides(slides) {
  const flattened = []
  const visit = (slide) => {
    if (!slide) return
    flattened.push(slide)
    ;(slide.children || []).forEach(visit)
  }
  ;(slides || []).forEach(visit)
  return flattened
}

function hasServerRasterElements(slides) {
  return (slides || []).some((slide) => {
    const elements = (slide.elements || []).filter((element) => !(element.hidden || false))
    return elements.some(requiresServerRaster)
  })
}

function hasServerOnlyElements(presentation) {
  return hasServerRasterElements(flattenPptxSlides(presentation?.slides))
}

function validateServerRasterElementIds(slides) {
  const seen = new Map()

  for (const [slideIndex, slide] of (slides || []).entries()) {
    for (const element of slide.elements || []) {
      if (element.hidden || false) continue
      let id = typeof element.id === 'string' ? element.id.trim() : ''
      if (requiresServerRaster(element) && !id) {
        // Legacy decks can carry id-less raster elements; assign one so the
        // server render/match pipeline can target them.
        element.id = crypto.randomUUID()
        id = element.id
      }
      if (!id) continue
      const previous = seen.get(id)
      if (previous && (requiresServerRaster(previous.element) || requiresServerRaster(element))) {
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
    slides: flattenPptxSlides(presentation?.slides).map(({ children: _children, ...slide }) => ({
      ...slide,
      elements: (slide.elements || []).filter((element) => !(element.hidden || false)),
    })),
  }
}

function canUseServerRaster() {
  return (
    typeof window !== 'undefined' && typeof document !== 'undefined' && typeof fetch === 'function'
  )
}

async function fetchComplexElementRasters(presentation) {
  if (!hasServerOnlyElements(presentation)) return {}
  const flattenedSlides = flattenPptxSlides(presentation?.slides)
  validateServerRasterElementIds(flattenedSlides)
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
  const missing = getServerOnlyElementIds(flattenedSlides).filter((id) => !rasters[id])
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

  for (const [slideIndex, sourceSlide] of flattenPptxSlides(presentation?.slides).entries()) {
    const slideNumber = slideIndex + 1
    const source = resolvePptxSlide(sourceSlide, presentation?.layoutMasters, warnings, slideNumber)
    const slide = pptx.addSlide()
    const slideTokens = mergeTokens(
      mergeTokens(DEFAULT_TOKENS, presentation?.designTokens),
      source?.designTokens
    )
    await applySlideBackground(
      slide,
      source.background,
      resolution,
      layout,
      warnings,
      slideNumber,
      slideTokens
    )

    const { effectiveLines } = resolveConnectorGeometry(source.elements || [])
    const elements = [...(source.elements || [])]
      .filter((element) => !(element.hidden || false))
      .map((element) => (element.id ? effectiveLines.get(element.id) || element : element))
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    for (const element of elements) {
      if (element.type === 'line' && element.connections) {
        recordPptxExportWarning(warnings, {
          element,
          slideNumber,
          message: `Slide ${slideNumber}: connector attachment semantics were flattened to resolved line endpoints`,
          fallback: 'native-line',
        })
      }
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

    const speakerNotes = getSlideNotes(source)
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
