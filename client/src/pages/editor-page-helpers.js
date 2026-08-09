export function getElementForActiveSlideEdit(activeSlide, fallbackSlide, elementId) {
  const slide = activeSlide || fallbackSlide
  const element = slide?.elements?.find((el) => el.id === elementId)
  return element?.type === 'text' ? element : null
}

export function getGameElementForActiveSlide(activeSlide, fallbackSlide, selectedElementId) {
  const slide = activeSlide || fallbackSlide
  const selectedGame = slide?.elements?.find(
    (element) => element.id === selectedElementId && element.type === 'game'
  )
  return selectedGame || slide?.elements?.find((element) => element.type === 'game') || null
}
