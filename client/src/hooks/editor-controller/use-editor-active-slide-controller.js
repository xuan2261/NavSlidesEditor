import { useCallback, useEffect, useRef } from 'react'
import { mapActiveSlide, resolveActiveSlide } from '../../utils/active-slide-mapper'

export function useEditorActiveSlideController({
  presentation,
  currentSlideIndex,
  verticalEdit,
  setVerticalEdit,
}) {
  const currentSlideIndexRef = useRef(currentSlideIndex)
  const verticalEditRef = useRef(verticalEdit)

  useEffect(() => {
    currentSlideIndexRef.current = currentSlideIndex
  }, [currentSlideIndex])

  useEffect(() => {
    verticalEditRef.current = verticalEdit
  }, [verticalEdit])

  useEffect(() => {
    if (!presentation || !verticalEdit || verticalEdit.child == null) return
    const parent = presentation.slides.find((slide) => slide.id === verticalEdit.parentId)
    if (!parent?.children || verticalEdit.child >= parent.children.length) setVerticalEdit(null)
  }, [presentation, setVerticalEdit, verticalEdit])

  const activeSlide = resolveActiveSlide(
    presentation?.slides,
    currentSlideIndex,
    verticalEdit
  )
  const activeSlideRef = useRef(activeSlide)
  useEffect(() => {
    activeSlideRef.current = activeSlide
  }, [activeSlide])

  const mapActive = useCallback(
    (previous, transform) =>
      mapActiveSlide(
        previous,
        currentSlideIndexRef.current,
        verticalEditRef.current,
        transform
      ),
    []
  )

  const currentVerticalIndex =
    verticalEdit?.child != null
      ? {
          parent:
            presentation?.slides?.findIndex((slide) => slide.id === verticalEdit.parentId) ?? -1,
          child: verticalEdit.child,
        }
      : null

  return {
    activeSlide,
    activeSlideRef,
    currentSlideIndexRef,
    currentVerticalIndex,
    mapActive,
    verticalEditRef,
  }
}
