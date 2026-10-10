import { resolveActiveSlide } from './active-slide-mapper'

export function resolveHistoryAuthoringSlide(
  snapshot,
  { presentationId, masterId, currentSlideIndex, verticalEdit }
) {
  const master =
    snapshot.id === presentationId && masterId
      ? snapshot.layoutMasters?.find((layout) => layout.id === masterId)
      : null
  if (master) return { elements: master.fixedElements }
  const index = Math.min(currentSlideIndex, (snapshot.slides?.length ?? 1) - 1)
  let vertical = index === currentSlideIndex ? verticalEdit : null
  if (vertical?.child != null) {
    const parent = snapshot.slides?.find((slide) => slide.id === vertical.parentId)
    if (!parent?.children || vertical.child >= parent.children.length) vertical = null
  }
  return resolveActiveSlide(snapshot.slides, index, vertical)
}
