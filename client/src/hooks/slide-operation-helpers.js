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
  const id = createId()
  const elementIds = new Map()
  const sourceElements = slide.elements || []
  for (const element of sourceElements) elementIds.set(element.id, createId())
  const remapEndpoint = (endpoint) =>
    endpoint && elementIds.has(endpoint.targetId)
      ? { ...endpoint, targetId: elementIds.get(endpoint.targetId) }
      : endpoint
  const elements = sourceElements.map((element) => ({
    ...element,
    id: elementIds.get(element.id),
    ...(element.connections
      ? {
          connections: {
            ...element.connections,
            ...(element.connections.start ? { start: remapEndpoint(element.connections.start) } : {}),
            ...(element.connections.end ? { end: remapEndpoint(element.connections.end) } : {}),
          },
        }
      : {}),
  }))
  const overrides = slide.layoutOverrides
    ? {
        ...slide.layoutOverrides,
        ...(Array.isArray(slide.layoutOverrides.hiddenElementIds)
          ? { hiddenElementIds: [...slide.layoutOverrides.hiddenElementIds] }
          : {}),
        ...(slide.layoutOverrides.elementPatches
          ? { elementPatches: Object.fromEntries(Object.entries(slide.layoutOverrides.elementPatches).map(([id, patch]) => [id, { ...patch }])) }
          : {}),
        ...(slide.layoutOverrides.placeholderBindings
          ? { placeholderBindings: Object.fromEntries(Object.entries(slide.layoutOverrides.placeholderBindings).flatMap(([placeholderId, elementId]) => elementIds.has(elementId) ? [[placeholderId, elementIds.get(elementId)]] : [])) }
          : {}),
      }
    : undefined
  return {
    ...slide,
    id,
    elements,
    ...(overrides ? { layoutOverrides: overrides } : {}),
    children: (slide.children || []).map((child) => cloneSlideWithNewIds(child, createId)),
  }
}

/**
 * @param {Object[]} slides
 * @param {number[]} indices
 * @param {() => string} [createId] - factory for new slide/element IDs (defaults to crypto.randomUUID)
 * @param {number} [currentSlideIndex] - for future undo/redo context tracking
 */
export function duplicateSlidesAtIndices(slides, indices, createId = () => crypto.randomUUID(), _currentSlideIndex = 0) {
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
