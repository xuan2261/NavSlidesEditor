import { resolveEffectiveSlide } from 'revealjs-shared'

export function getElementForActiveSlideEdit(activeSlide, fallbackSlide, elementId) {
  const slide = activeSlide || fallbackSlide
  const element = slide?.elements?.find((el) => el.id === elementId)
  return element?.type === 'text' || element?.type === 'table' ? element : null
}

export function getGameElementForActiveSlide(
  activeSlide,
  fallbackSlide,
  selectedElementId,
  layoutMasters
) {
  const source = activeSlide || fallbackSlide
  if (!source) return null
  const slide = resolveEffectiveSlide(source, layoutMasters).slide
  const games =
    slide.elements?.filter((element) => element.type === 'game' && !element.hidden) || []
  return games.find((element) => element.id === selectedElementId) || games[0] || null
}
