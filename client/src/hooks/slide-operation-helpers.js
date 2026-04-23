export function clampSlideIndex(index, slideCount) {
  if (slideCount <= 0) return 0
  return Math.min(Math.max(index, 0), slideCount - 1)
}

function uniqueSortedIndices(indices, maxLength) {
  return [...new Set(indices)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < maxLength)
    .sort((a, b) => a - b)
}

function cloneSlideWithNewIds(slide, createId) {
  return {
    ...slide,
    id: createId(),
    elements: (slide.elements || []).map((element) => ({
      ...element,
      id: createId(),
    })),
    children: (slide.children || []).map((child) => cloneSlideWithNewIds(child, createId)),
  }
}

export function duplicateSlidesAtIndices(slides, indices, createId = () => crypto.randomUUID()) {
  const selected = uniqueSortedIndices(indices, slides.length)
  const selectedSet = new Set(selected)
  const duplicatedIndices = []
  const nextSlides = []

  slides.forEach((slide, index) => {
    nextSlides.push(slide)
    if (selectedSet.has(index)) {
      nextSlides.push(cloneSlideWithNewIds(slide, createId))
      duplicatedIndices.push(nextSlides.length - 1)
    }
  })

  return {
    slides: nextSlides,
    duplicatedIndices,
    currentSlideIndex:
      duplicatedIndices.length > 0 ? duplicatedIndices[duplicatedIndices.length - 1] : 0,
  }
}

export function deleteSlidesAtIndices(slides, indices, currentSlideIndex) {
  const selected = uniqueSortedIndices(indices, slides.length)
  if (!selected.length || slides.length - selected.length < 1) {
    return {
      slides,
      currentSlideIndex: clampSlideIndex(currentSlideIndex, slides.length),
    }
  }

  const selectedSet = new Set(selected)
  const nextSlides = slides.filter((_, index) => !selectedSet.has(index))
  const deletedBeforeOrAtCurrent = selected.filter((index) => index <= currentSlideIndex).length
  const nextIndex = clampSlideIndex(currentSlideIndex - deletedBeforeOrAtCurrent, nextSlides.length)

  return {
    slides: nextSlides,
    currentSlideIndex: nextIndex,
  }
}
