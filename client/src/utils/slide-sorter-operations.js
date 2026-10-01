import { duplicateSlidesAtIndices } from '../hooks/slide-operation-helpers'

export function applySorterSlideOperation(slides, operation, slideId, toIndex) {
  const index = slides.findIndex((slide) => slide.id === slideId)
  if (index < 0) return slides
  if (operation === 'duplicate') return duplicateSlidesAtIndices(slides, [index]).slides
  if (operation === 'delete') {
    return slides.length > 1 ? slides.filter((slide) => slide.id !== slideId) : slides
  }
  if (operation === 'move') {
    if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= slides.length || index === toIndex) return slides
    const next = [...slides]
    const [slide] = next.splice(index, 1)
    next.splice(toIndex, 0, slide)
    return next
  }
  return slides
}

export function getSorterCurrentDestination(previousSlides, previousIndex, slides, verticalEdit) {
  const currentId = previousSlides[previousIndex]?.id
  const retainedIndex = slides.findIndex((slide) => slide.id === currentId)
  const index = retainedIndex >= 0 ? retainedIndex : Math.min(previousIndex, slides.length - 1)
  const child = retainedIndex >= 0 && verticalEdit?.parentId === currentId &&
    slides[index]?.children?.[verticalEdit.child] ? verticalEdit.child : null
  return { index: Math.max(0, index), child, identityChanged: retainedIndex < 0 }
}
