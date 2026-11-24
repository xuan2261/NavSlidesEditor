import { semanticInstance, semanticDefinition, semanticInstances } from 'revealjs-shared/src/pptx-semantic-records.js'
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
  return expandSelectionIdsForGroups(slide, [elementId])
}

export function expandSelectionIdsForGroups(slide, ids, { includeHidden = false } = {}) {
  if (!slide || !Array.isArray(ids)) return []
  const elements = slide.elements || []
  const selected = new Set(ids)
  for (const id of ids) {
    const element = elements.find((el) => el.id === id)
    if (!element?.groupId) continue
    for (const member of elements) {
      if (member.groupId !== element.groupId) continue
      if (!includeHidden && member.hidden) continue
      selected.add(member.id)
    }
  }
  return [...selected]
}

export function hasBlockedGroupMutation(slide, ids) {
  if (!slide || !Array.isArray(ids) || !ids.length) return false
  const elements = slide.elements || []
  const byGroup = new Map()
  for (const element of elements) {
    if (!element.groupId) continue
    const members = byGroup.get(element.groupId) || []
    members.push(element)
    byGroup.set(element.groupId, members)
  }

  const selected = new Set(ids)
  for (const id of selected) {
    const element = elements.find((el) => el.id === id)
    if (!element?.groupId) continue
    const members = byGroup.get(element.groupId) || []
    const hasSelectedVisibleMember = members.some(
      (member) => selected.has(member.id) && !member.hidden
    )
    if (!hasSelectedVisibleMember) continue
    if (members.some((member) => member.locked || member.hidden)) return true
  }
  return false
}

export function semanticClipboardMutationBlocked(document, slide, ids) {
  if (!document || !slide) return false
  const roots = new Set(
    ids
      .map((id) => slide.elements?.find((element) => element.id === id)?.pptxInstanceId || id)
      .filter((id) => semanticInstance(document, id)?.slideId === slide.id)
  )
  const protectedInstance = (instance) => {
    const definition = semanticDefinition(document, instance.definitionId)
    return (
      instance.overrides.locked ||
      (instance.overrides.hidden ?? instance.hidden ?? definition?.content?.hidden ?? false)
    )
  }
  for (const id of roots) {
    const root = semanticInstance(document, id)
    if (!root || root.lineage?.tombstone || root.lineage?.paintOnly) return true
    let current = root
    while (current) {
      if (current.lineage?.tombstone || protectedInstance(current)) return true
      current = semanticInstance(document, current.parentInstanceId)
    }
  }
  for (const [, instance] of semanticInstances(document)) {
    if (instance.slideId !== slide.id || instance.lineage?.tombstone) continue
    let parent = instance.parentInstanceId
    while (parent !== null && parent !== undefined) {
      if (roots.has(parent) && protectedInstance(instance)) return true
      parent = semanticInstance(document, parent)?.parentInstanceId
    }
  }
  return false
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
  const replaces = type === 'move' && !shiftKey && !currentSelectionIds.includes(elementId)
  if (!replaces) return currentSelectionIds
  return getSelectionIdsForActiveSlideElement(activeSlide, fallbackSlide, elementId)
}
