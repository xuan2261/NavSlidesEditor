import { useCallback } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import {
  deleteSlidesAtIndices,
  duplicateSlidesAtIndices,
} from './slide-operation-helpers'

/**
 * Hook encapsulating multi-element operations (align, group, delete-selected)
 * and slide CRUD (add, delete, duplicate, move).
 *
 * Keeps EditorPage lean by extracting ~250 lines of callback logic.
 */
export function useSlideOperations({
  presentation,
  setPresentation,
  currentSlideIndex: _currentSlideIndex,
  setCurrentSlideIndex,
  currentSlideIndexRef,
  selectedElementIdsRef,
  editingElementIdRef,
}) {
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const setEditingElementId = useEditorStore((s) => s.setEditingElementId)

  // ── Multi-element batch update ─────────────────────────────────────────────
  const updateElements = useCallback(
    (updates) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const map = {}
        updates.forEach((u) => {
          map[u.id] = u
        })
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === currentSlideIndexRef.current
              ? {
                  ...s,
                  elements: (s.elements || []).map((el) => (map[el.id] ? { ...el, ...map[el.id] } : el)),
                }
              : s
          ),
        }
      })
    },
    [setPresentation, currentSlideIndexRef]
  )

  // ── Delete all selected elements ───────────────────────────────────────────
  const deleteSelectedElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    const currentSlide = presentation?.slides?.[currentSlideIndexRef.current]
    const lockedIds = new Set(
      (currentSlide?.elements || [])
        .filter((el) => ids.includes(el.id) && el.locked)
        .map((el) => el.id)
    )
    const deletableIds = ids.filter((id) => !lockedIds.has(id))
    if (!deletableIds.length) return
    setPresentation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current
            ? { ...s, elements: (s.elements || []).filter((el) => !deletableIds.includes(el.id)) }
            : s
        ),
      }
    })
    if (lockedIds.size) {
      setSelectedElementIds(ids.filter((id) => lockedIds.has(id)))
    } else {
      setSelectedElementIds([])
      setEditingElementId(null)
      editingElementIdRef.current = null
    }
  }, [
    presentation,
    setPresentation,
    selectedElementIdsRef,
    currentSlideIndexRef,
    editingElementIdRef,
    setSelectedElementIds,
    setEditingElementId,
  ])

  // ── Group / ungroup ────────────────────────────────────────────────────────
  const groupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    const groupId = crypto.randomUUID()
    setPresentation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current
            ? {
                ...s,
                elements: (s.elements || []).map((el) => (ids.includes(el.id) ? { ...el, groupId } : el)),
              }
            : s
        ),
      }
    })
  }, [setPresentation, selectedElementIdsRef, currentSlideIndexRef])

  const ungroupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    setPresentation((prev) => {
      if (!prev) return prev
      const slide = prev.slides[currentSlideIndexRef.current]
      const groupIds = new Set(
        (slide?.elements || [])
          .filter((el) => ids.includes(el.id) && el.groupId)
          .map((el) => el.groupId)
      )
      if (!groupIds.size) return prev
      return {
        ...prev,
        slides: prev.slides.map((s, i) =>
          i === currentSlideIndexRef.current
            ? {
                ...s,
                elements: (s.elements || []).map((el) =>
                  groupIds.has(el.groupId) ? { ...el, groupId: undefined } : el
                ),
              }
            : s
        ),
      }
    })
  }, [setPresentation, selectedElementIdsRef, currentSlideIndexRef])

  // ── Alignment ──────────────────────────────────────────────────────────────
  const alignElements = useCallback(
    (type) => {
      const ids = selectedElementIdsRef.current
      if (ids.length < 2) return
      setPresentation((prev) => {
        if (!prev) return prev
        const slide = prev.slides[currentSlideIndexRef.current]
        const els = (slide?.elements || []).filter((el) => ids.includes(el.id))
        const upd = {}
        if (type === 'left') {
          const v = Math.min(...els.map((e) => e.x))
          els.forEach((e) => {
            upd[e.id] = { x: v }
          })
        } else if (type === 'right') {
          const v = Math.max(...els.map((e) => e.x + e.width))
          els.forEach((e) => {
            upd[e.id] = { x: v - e.width }
          })
        } else if (type === 'center-h') {
          const v =
            (Math.min(...els.map((e) => e.x)) + Math.max(...els.map((e) => e.x + e.width))) / 2
          els.forEach((e) => {
            upd[e.id] = { x: v - e.width / 2 }
          })
        } else if (type === 'top') {
          const v = Math.min(...els.map((e) => e.y))
          els.forEach((e) => {
            upd[e.id] = { y: v }
          })
        } else if (type === 'bottom') {
          const v = Math.max(...els.map((e) => e.y + e.height))
          els.forEach((e) => {
            upd[e.id] = { y: v - e.height }
          })
        } else if (type === 'center-v') {
          const v =
            (Math.min(...els.map((e) => e.y)) + Math.max(...els.map((e) => e.y + e.height))) / 2
          els.forEach((e) => {
            upd[e.id] = { y: v - e.height / 2 }
          })
        } else if (type === 'distribute-h') {
          const s = [...els].sort((a, b) => a.x - b.x)
          if (s.length > 1) {
            const l = s[0].x,
              r = s[s.length - 1].x + s[s.length - 1].width
            const tw = s.reduce((a, e) => a + e.width, 0),
              gap = (r - l - tw) / (s.length - 1)
            let cx = l
            s.forEach((e) => {
              upd[e.id] = { x: cx }
              cx += e.width + gap
            })
          }
        } else if (type === 'distribute-v') {
          const s = [...els].sort((a, b) => a.y - b.y)
          if (s.length > 1) {
            const t = s[0].y,
              b = s[s.length - 1].y + s[s.length - 1].height
            const th = s.reduce((a, e) => a + e.height, 0),
              gap = (b - t - th) / (s.length - 1)
            let cy = t
            s.forEach((e) => {
              upd[e.id] = { y: cy }
              cy += e.height + gap
            })
          }
        }
        return {
          ...prev,
          slides: prev.slides.map((sl, i) =>
            i === currentSlideIndexRef.current
              ? {
                  ...sl,
                  elements: (sl.elements || []).map((el) => (upd[el.id] ? { ...el, ...upd[el.id] } : el)),
                }
              : sl
          ),
        }
      })
    },
    [setPresentation, selectedElementIdsRef, currentSlideIndexRef]
  )

  // ── Slide CRUD ─────────────────────────────────────────────────────────────
  const addSlide = useCallback(
    (templateKey = null, afterIndex) => {
      const template =
        templateKey && SLIDE_TEMPLATES[templateKey] ? SLIDE_TEMPLATES[templateKey] : null
      const baseElements = template
        ? template.elements.map((el) => ({ ...el, id: crypto.randomUUID() }))
        : [
            {
              id: crypto.randomUUID(),
              type: 'text',
              x: 80,
              y: 160,
              width: 800,
              height: 220,
              zIndex: 1,
              content:
                '<h2 style="text-align: center">New Slide</h2><p style="text-align: center">Double-click to edit</p>',
            },
          ]
      setPresentation((prev) => {
        const insertAt = afterIndex !== undefined ? afterIndex + 1 : prev.slides.length
        const currentIdx = afterIndex !== undefined ? afterIndex : currentSlideIndexRef.current
        const referenceSlide = prev.slides[currentIdx] || prev.slides[prev.slides.length - 1]
        const inheritedBg = referenceSlide?.background
          ? { ...referenceSlide.background }
          : { type: 'color', color: '#1e1e2e' }
        const newSlide = {
          id: crypto.randomUUID(),
          elements: baseElements,
          notes: '',
          background: inheritedBg,
        }
        const slides = [...prev.slides]
        slides.splice(insertAt, 0, newSlide)
        setCurrentSlideIndex(insertAt)
        return { ...prev, slides }
      })
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const deleteSlide = useCallback(
    (index) => {
      setPresentation((prev) => {
        if (!prev || prev.slides.length <= 1) return prev
        const result = deleteSlidesAtIndices(prev.slides, [index], currentSlideIndexRef.current)
        setCurrentSlideIndex(result.currentSlideIndex)
        return { ...prev, slides: result.slides }
      })
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const duplicateSlide = useCallback(
    (index) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(prev.slides, [index], () => crypto.randomUUID(), currentSlideIndexRef.current)
        setCurrentSlideIndex(result.currentSlideIndex)
        return { ...prev, slides: result.slides }
      })
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const duplicateSlides = useCallback(
    (indices) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(prev.slides, indices, () => crypto.randomUUID(), currentSlideIndexRef.current)
        setCurrentSlideIndex(result.currentSlideIndex)
        return { ...prev, slides: result.slides }
      })
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const deleteSlides = useCallback(
    (indices) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const result = deleteSlidesAtIndices(prev.slides, indices, currentSlideIndexRef.current)
        setCurrentSlideIndex(result.currentSlideIndex)
        return { ...prev, slides: result.slides }
      })
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const moveSlide = useCallback(
    (fromIndex, toIndex) => {
      if (!presentation) return
      if (toIndex < 0 || toIndex >= presentation.slides.length) return
      setPresentation((prev) => {
        const slides = [...prev.slides]
        const [removed] = slides.splice(fromIndex, 1)
        slides.splice(toIndex, 0, removed)
        return { ...prev, slides }
      })
      setCurrentSlideIndex(toIndex)
    },
    [presentation, setPresentation, setCurrentSlideIndex]
  )

  return {
    updateElements,
    deleteSelectedElements,
    groupElements,
    ungroupElements,
    alignElements,
    addSlide,
    deleteSlide,
    duplicateSlide,
    deleteSlides,
    duplicateSlides,
    moveSlide,
  }
}
