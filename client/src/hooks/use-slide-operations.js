import { useCallback, useMemo } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import {
  deleteSlidesAtIndices,
  duplicateSlidesAtIndices,
} from './slide-operation-helpers'
import { invalidatePptxFitMetaForUpdates } from '../utils/pptx-import-meta'

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
  mapActiveSlide,
  getActiveSlide,
}) {
  const setSelectedElementIds = useEditorStore((s) => s.setSelectedElementIds)
  const setEditingElementId = useEditorStore((s) => s.setEditingElementId)

  // Fallback router for older call sites / tests that don't inject one: act on
  // the parent slide at currentSlideIndexRef. Memoized so callback deps stay
  // stable across renders.
  const mapActive = useMemo(
    () =>
      mapActiveSlide ||
      ((prev, fn) =>
        prev
          ? {
              ...prev,
              slides: prev.slides.map((s, i) => (i === currentSlideIndexRef.current ? fn(s) : s)),
            }
          : prev),
    [mapActiveSlide, currentSlideIndexRef]
  )
  const activeSlideOf = useMemo(
    () => getActiveSlide || (() => presentation?.slides?.[currentSlideIndexRef.current]),
    [getActiveSlide, presentation, currentSlideIndexRef]
  )

  // ── Multi-element batch update ─────────────────────────────────────────────
  const updateElements = useCallback(
    (updates) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const map = {}
        updates.forEach((u) => {
          map[u.id] = u
        })
        return mapActive(prev, (s) => ({
          ...s,
          elements: (s.elements || []).map((el) =>
            map[el.id] ? { ...el, ...invalidatePptxFitMetaForUpdates(el, map[el.id]) } : el
          ),
        }))
      })
    },
    [setPresentation, mapActive]
  )

  // ── Delete all selected elements ───────────────────────────────────────────
  const deleteSelectedElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    const activeSlide = activeSlideOf()
    const lockedIds = new Set(
      (activeSlide?.elements || [])
        .filter((el) => ids.includes(el.id) && el.locked)
        .map((el) => el.id)
    )
    const deletableIds = ids.filter((id) => !lockedIds.has(id))
    if (!deletableIds.length) return
    setPresentation((prev) =>
      mapActive(prev, (s) => ({
        ...s,
        elements: (s.elements || []).filter((el) => !deletableIds.includes(el.id)),
      }))
    )
    if (lockedIds.size) {
      setSelectedElementIds(ids.filter((id) => lockedIds.has(id)))
    } else {
      setSelectedElementIds([])
      setEditingElementId(null)
      editingElementIdRef.current = null
    }
  }, [
    activeSlideOf,
    setPresentation,
    selectedElementIdsRef,
    editingElementIdRef,
    setSelectedElementIds,
    setEditingElementId,
    mapActive,
  ])

  // ── Group / ungroup ────────────────────────────────────────────────────────
  const groupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    const groupId = crypto.randomUUID()
    setPresentation((prev) =>
      mapActive(prev, (s) => ({
        ...s,
        elements: (s.elements || []).map((el) => (ids.includes(el.id) ? { ...el, groupId } : el)),
      }))
    )
  }, [setPresentation, selectedElementIdsRef, mapActive])

  const ungroupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    setPresentation((prev) => {
      if (!prev) return prev
      const slide = activeSlideOf()
      const groupIds = new Set(
        (slide?.elements || [])
          .filter((el) => ids.includes(el.id) && el.groupId)
          .map((el) => el.groupId)
      )
      if (!groupIds.size) return prev
      return mapActive(prev, (s) => ({
        ...s,
        elements: (s.elements || []).map((el) =>
          groupIds.has(el.groupId) ? { ...el, groupId: undefined } : el
        ),
      }))
    })
  }, [setPresentation, selectedElementIdsRef, activeSlideOf, mapActive])

  // ── Alignment ──────────────────────────────────────────────────────────────
  const alignElements = useCallback(
    (type) => {
      const ids = selectedElementIdsRef.current
      if (ids.length < 2) return
      setPresentation((prev) => {
        if (!prev) return prev
        const slide = activeSlideOf()
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
        return mapActive(prev, (sl) => ({
          ...sl,
          elements: (sl.elements || []).map((el) => (upd[el.id] ? { ...el, ...upd[el.id] } : el)),
        }))
      })
    },
    [setPresentation, selectedElementIdsRef, activeSlideOf, mapActive]
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

  // ── Vertical (child) slide CRUD ────────────────────────────────────────────
  const addChildSlide = useCallback(
    (parentIndex) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const parent = prev.slides[parentIndex]
        if (!parent) return prev
        const newChild = {
          id: crypto.randomUUID(),
          elements: [],
          notes: '',
          background: parent.background ? { ...parent.background } : { type: 'color', color: '#1e1e2e' },
        }
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === parentIndex ? { ...s, children: [...(s.children || []), newChild] } : s
          ),
        }
      })
    },
    [setPresentation]
  )

  const duplicateChildSlide = useCallback(
    (parentIndex, childIndex) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const parent = prev.slides[parentIndex]
        const child = parent?.children?.[childIndex]
        if (!child) return prev
        const dup = {
          ...child,
          id: crypto.randomUUID(),
          elements: (child.elements || []).map((el) => ({ ...el, id: crypto.randomUUID() })),
        }
        return {
          ...prev,
          slides: prev.slides.map((s, i) => {
            if (i !== parentIndex) return s
            const children = [...(s.children || [])]
            children.splice(childIndex + 1, 0, dup)
            return { ...s, children }
          }),
        }
      })
    },
    [setPresentation]
  )

  const deleteChildSlide = useCallback(
    (parentIndex, childIndex) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const parent = prev.slides[parentIndex]
        if (!parent?.children?.[childIndex]) return prev
        return {
          ...prev,
          slides: prev.slides.map((s, i) =>
            i === parentIndex
              ? { ...s, children: s.children.filter((_, ci) => ci !== childIndex) }
              : s
          ),
        }
      })
    },
    [setPresentation]
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
    addChildSlide,
    duplicateChildSlide,
    deleteChildSlide,
  }
}
