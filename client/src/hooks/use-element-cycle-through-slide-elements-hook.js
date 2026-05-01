import { useCallback } from 'react'

export function useElementCycle(selectedElementIds, slides, currentSlideIndex) {
  const getElementsOnCurrentSlide = useCallback(() => {
    return slides && slides[currentSlideIndex]?.elements || []
  }, [slides, currentSlideIndex])

  const cycleNext = useCallback(() => {
    const els = getElementsOnCurrentSlide()
    if (els.length === 0) return null
    if (selectedElementIds.length !== 1) return els[0]?.id || null
    const currentIdx = els.findIndex((el) => el.id === selectedElementIds[0])
    if (currentIdx === -1) return els[0]?.id || null
    const nextIdx = (currentIdx + 1) % els.length
    return els[nextIdx]?.id || null
  }, [selectedElementIds, slides, currentSlideIndex, getElementsOnCurrentSlide])

  const cyclePrev = useCallback(() => {
    const els = getElementsOnCurrentSlide()
    if (els.length === 0) return null
    if (selectedElementIds.length !== 1) return els[els.length - 1]?.id || null
    const currentIdx = els.findIndex((el) => el.id === selectedElementIds[0])
    if (currentIdx === -1) return els[els.length - 1]?.id || null
    const prevIdx = (currentIdx - 1 + els.length) % els.length
    return els[prevIdx]?.id || null
  }, [selectedElementIds, slides, currentSlideIndex, getElementsOnCurrentSlide])

  return { cycleNext, cyclePrev }
}
