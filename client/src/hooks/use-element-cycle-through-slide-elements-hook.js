import { useCallback } from 'react'

export function useElementCycle(selectedElementIds, slides, currentSlideIndex) {
  const getElementsOnCurrentSlide = useCallback(() => {
    const groups = new Set()
    return (slides?.[currentSlideIndex]?.elements || []).filter((element) => {
      if (element.hidden) return false
      if (!element.groupId) return true
      if (groups.has(element.groupId)) return false
      groups.add(element.groupId)
      return true
    })
  }, [slides, currentSlideIndex])

  // slides and currentSlideIndex omitted from deps — getElementsOnCurrentSlide already captures them via its own deps
  const cycleNext = useCallback(() => {
    const els = getElementsOnCurrentSlide()
    if (els.length === 0) return null
    const selected = els.filter((element) => selectedElementIds.includes(element.id))
    if (selected.length !== 1) return els[0]?.id || null
    const currentIdx = els.indexOf(selected[0])
    const nextIdx = (currentIdx + 1) % els.length
    return els[nextIdx]?.id || null
  }, [selectedElementIds, getElementsOnCurrentSlide])

  // slides and currentSlideIndex omitted from deps — getElementsOnCurrentSlide already captures them via its own deps
  const cyclePrev = useCallback(() => {
    const els = getElementsOnCurrentSlide()
    if (els.length === 0) return null
    const selected = els.filter((element) => selectedElementIds.includes(element.id))
    if (selected.length !== 1) return els[els.length - 1]?.id || null
    const currentIdx = els.indexOf(selected[0])
    const prevIdx = (currentIdx - 1 + els.length) % els.length
    return els[prevIdx]?.id || null
  }, [selectedElementIds, getElementsOnCurrentSlide])

  return { cycleNext, cyclePrev }
}
