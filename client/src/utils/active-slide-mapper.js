// Active-slide addressing for vertical (child) slide editing.
//
// The editor tracks the active vertical edit as { parentId, child } where
// `child` is null (editing the parent) or a child index. parentId is the
// PARENT SLIDE'S id (parent-by-id): we resolve its array position at read time
// so slide reorder never silently re-points the active parent.
//
// This internal { parentId, child } model is DISTINCT from the pre-existing
// FLAT verticalIndex convention (0 = parent, child = childIndex + 1) used by
// socket/live/export. Use toFlatVerticalIndex to bridge to that model.

function parentIndexOf(slides, parentId) {
  if (parentId == null) return -1
  return slides.findIndex((s) => s.id === parentId)
}

/**
 * Resolve the slide the editor is currently acting on.
 * @param {Array} slides
 * @param {number} currentSlideIndex - fallback parent index when no vertical edit
 * @param {{parentId:string, child:number}|null} verticalEdit
 * @returns {Object|undefined} the active parent or child slide
 */
export function resolveActiveSlide(slides, currentSlideIndex, verticalEdit) {
  if (!Array.isArray(slides)) return undefined
  if (!verticalEdit || verticalEdit.child == null) {
    return slides[currentSlideIndex]
  }
  const pIdx = parentIndexOf(slides, verticalEdit.parentId)
  // Tracked parent id gone -> fall back to the current parent slide.
  if (pIdx === -1) return slides[currentSlideIndex]
  const child = slides[pIdx]?.children?.[verticalEdit.child]
  // Child index out of range -> fall back to the parent.
  return child ?? slides[pIdx]
}

/**
 * Apply a writer fn to the active slide (parent OR active child), returning a
 * new presentation. Every element write path routes through this so a write
 * never lands on the parent while a child is active.
 *
 * @param {Object} presentation
 * @param {number} currentSlideIndex
 * @param {{parentId:string, child:number}|null} verticalEdit
 * @param {(slide:Object) => Object} fn - pure slide transformer
 * @returns {Object} new presentation
 */
export function mapActiveSlide(presentation, currentSlideIndex, verticalEdit, fn) {
  if (!presentation) return presentation
  const slides = presentation.slides || []

  // Editing the parent (no vertical edit or child === null).
  if (!verticalEdit || verticalEdit.child == null) {
    return {
      ...presentation,
      slides: slides.map((s, i) => (i === currentSlideIndex ? fn(s) : s)),
    }
  }

  const pIdx = parentIndexOf(slides, verticalEdit.parentId)
  if (pIdx === -1) {
    // Tracked parent gone — act on the current parent slide as a safe fallback.
    return {
      ...presentation,
      slides: slides.map((s, i) => (i === currentSlideIndex ? fn(s) : s)),
    }
  }

  const parent = slides[pIdx]
  const child = parent?.children?.[verticalEdit.child]
  if (!child) return presentation // out-of-range child -> no-op

  return {
    ...presentation,
    slides: slides.map((s, i) =>
      i === pIdx
        ? {
            ...s,
            children: s.children.map((c, ci) => (ci === verticalEdit.child ? fn(c) : c)),
          }
        : s
    ),
  }
}

/**
 * Bridge the editor's { parent, child } / { child } model to the flat
 * verticalIndex convention used by socket/live/export: parent = 0, child N =
 * N + 1. The two models intentionally differ — this is the single conversion
 * point.
 * @param {{child:number|null}|null} verticalEdit
 * @returns {number}
 */
export function toFlatVerticalIndex(verticalEdit) {
  if (!verticalEdit || verticalEdit.child == null) return 0
  return verticalEdit.child + 1
}
