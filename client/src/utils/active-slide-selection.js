// Selection resolution for clicks/pointer-downs on canvas elements.
//
// Grabbing a grouped element selects the WHOLE group so a drag moves the group
// as a unit. The pointer-down resolver decides the selection synchronously at
// press time so the drag never reads a stale post-render selection ref.

/**
 * Expand an element id to its full group on the active slide.
 * Falls back to the provided slide when no vertical-child slide is active.
 * @returns {string[]} group member ids, or just [elementId] when ungrouped
 */
export function getSelectionIdsForActiveSlideElement(activeSlide, fallbackSlide, elementId) {
  const slide = activeSlide || fallbackSlide
  const element = slide?.elements?.find((el) => el.id === elementId)
  if (!element?.groupId) return [elementId]
  return (slide?.elements || []).filter((el) => el.groupId === element.groupId).map((el) => el.id)
}

/**
 * Compute the selection a pointer-down should hand to the drag.
 *
 * Replacing the selection only happens when grabbing an UNSELECTED element with
 * a plain (no-shift) move — that mirrors the click-to-select behavior and, for
 * grouped elements, expands to the whole group. Every other case (already
 * selected, shift held, or a resize/rotate handle) keeps the current selection
 * so multi-element group drags are preserved.
 *
 * @param {{activeSlide:Object, fallbackSlide?:Object, elementId:string,
 *          currentSelectionIds:string[], shiftKey:boolean, type:string}} args
 * @returns {string[]} the selection ids to drive the drag with
 */
export function resolvePointerDownSelection({
  activeSlide,
  fallbackSlide,
  elementId,
  currentSelectionIds,
  shiftKey,
  type,
}) {
  const replaces =
    type === 'move' && !shiftKey && !currentSelectionIds.includes(elementId)
  if (!replaces) return currentSelectionIds
  return getSelectionIdsForActiveSlideElement(activeSlide, fallbackSlide, elementId)
}
