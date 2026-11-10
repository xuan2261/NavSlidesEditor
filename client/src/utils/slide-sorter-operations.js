import { duplicateSlidesAtIndices, withDeletedSlideOccurrences } from '../hooks/slide-operation-helpers'

export function applySorterSlideOperation(presentation, operation, slideId, toIndex) {
  const slides = presentation.slides
  const index = slides.findIndex((slide) => slide.id === slideId)
  if (index < 0) return presentation
  if (operation === 'duplicate') {
    const result = duplicateSlidesAtIndices(
      slides,
      [index],
      undefined,
      0,
      presentation.layoutMasters,
      presentation.pptxSemantic
    )
    return {
      ...presentation,
      slides: result.slides,
      ...(result.pptxSemantic ? { pptxSemantic: result.pptxSemantic } : {}),
    }
  }
  if (operation === 'delete') {
    if (slides.length <= 1) return presentation
    const nextSlides = slides.filter((slide) => slide.id !== slideId)
    return withDeletedSlideOccurrences(presentation, nextSlides)
  }
  if (operation === 'move') {
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= slides.length || index === toIndex) return presentation
    const next = [...slides]
    const [slide] = next.splice(index, 1)
    next.splice(toIndex, 0, slide)
    return { ...presentation, slides: next }
  }
  return presentation
}

export function getSorterCurrentDestination(previousSlides, previousIndex, slides, verticalEdit) {
  const currentId = previousSlides[previousIndex]?.id
  const retainedIndex = slides.findIndex((slide) => slide.id === currentId)
  const index = retainedIndex >= 0 ? retainedIndex : Math.min(previousIndex, slides.length - 1)
  const child = retainedIndex >= 0 && verticalEdit?.parentId === currentId &&
    slides[index]?.children?.[verticalEdit.child] ? verticalEdit.child : null
  return { index: Math.max(0, index), child, identityChanged: retainedIndex < 0 }
}
