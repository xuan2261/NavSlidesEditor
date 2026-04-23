import pptxgen from 'pptxgenjs'
import { applySlideBackground } from './export-pptx-background'
import { getPptxLayout, getPresentationResolution } from './export-pptx-core'
import { addElementToPptxSlide } from './export-pptx-renderers'
import { getSlideNotes } from './slide-notes'

function getSafeFilename(title) {
  return `${String(title || 'presentation').replace(/[^a-z0-9]/gi, '_')}.pptx`
}

export async function exportToPptx(presentation) {
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
      })
    }

    const speakerNotes = getSlideNotes(sourceSlide)
    if (speakerNotes) slide.addNotes(speakerNotes)
  }

  await pptx.writeFile({ fileName: getSafeFilename(presentation?.title) })
  return warnings
}
