import { useCallback, useMemo } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import { deleteSlidesAtIndices, duplicateSlidesAtIndices } from './slide-operation-helpers'
import { invalidatePptxFitMetaForUpdates } from '../utils/pptx-import-meta'
import { getRotatedAABB } from '../components/canvas/use-canvas-resize-rotate'
import {
  cloneInheritedDesignTokens,
  cloneTemplateElementForTheme,
} from '../utils/slide-template-theme-normalization'
import { hasBlockedGroupMutation } from '../utils/active-slide-selection'

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
    const slide = activeSlideOf()
    if (hasBlockedGroupMutation(slide, ids)) return
    if ((slide?.elements || []).some((el) => ids.includes(el.id) && el.locked)) return
    const groupId = crypto.randomUUID()
    setPresentation((prev) =>
      mapActive(prev, (s) => ({
        ...s,
        elements: (s.elements || []).map((el) => (ids.includes(el.id) ? { ...el, groupId } : el)),
      }))
    )
  }, [setPresentation, selectedElementIdsRef, activeSlideOf, mapActive])

  const ungroupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    setPresentation((prev) => {
      if (!prev) return prev
      const slide = activeSlideOf()
      if (hasBlockedGroupMutation(slide, ids)) return prev
      const groupIds = new Set(
        (slide?.elements || [])
          .filter((el) => ids.includes(el.id) && el.groupId)
          .map((el) => el.groupId)
      )
      if (!groupIds.size) return prev
      const hasLockedMember = (slide?.elements || []).some(
        (el) => groupIds.has(el.groupId) && el.locked
      )
      if (hasLockedMember) return prev
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
        // Locked elements are protected from bulk moves (matching
        // deleteSelectedElements). Re-check the count AFTER filtering: a
        // selection of one free + one locked leaves a lone survivor, which
        // must not self-align.
        const els = (slide?.elements || []).filter((el) => ids.includes(el.id) && !el.locked)
        if (els.length < 2) return prev
        // Align/distribute on the element's true VISUAL (rotated) bounding box.
        // Rotation is about the element center, so a rigid translation shifts the
        // AABB by the same delta — new x/y = old x/y + (target - currentEdge).
        // For unrotated elements the AABB equals the element box (legacy result).
        const bb = new Map(els.map((e) => [e.id, getRotatedAABB(e)]))
        const upd = {}
        if (type === 'left') {
          const v = Math.min(...els.map((e) => bb.get(e.id).left))
          els.forEach((e) => {
            upd[e.id] = { x: e.x + (v - bb.get(e.id).left) }
          })
        } else if (type === 'right') {
          const v = Math.max(...els.map((e) => bb.get(e.id).right))
          els.forEach((e) => {
            upd[e.id] = { x: e.x + (v - bb.get(e.id).right) }
          })
        } else if (type === 'center-h') {
          const v =
            (Math.min(...els.map((e) => bb.get(e.id).left)) +
              Math.max(...els.map((e) => bb.get(e.id).right))) /
            2
          els.forEach((e) => {
            const b = bb.get(e.id)
            upd[e.id] = { x: e.x + (v - (b.left + b.right) / 2) }
          })
        } else if (type === 'top') {
          const v = Math.min(...els.map((e) => bb.get(e.id).top))
          els.forEach((e) => {
            upd[e.id] = { y: e.y + (v - bb.get(e.id).top) }
          })
        } else if (type === 'bottom') {
          const v = Math.max(...els.map((e) => bb.get(e.id).bottom))
          els.forEach((e) => {
            upd[e.id] = { y: e.y + (v - bb.get(e.id).bottom) }
          })
        } else if (type === 'center-v') {
          const v =
            (Math.min(...els.map((e) => bb.get(e.id).top)) +
              Math.max(...els.map((e) => bb.get(e.id).bottom))) /
            2
          els.forEach((e) => {
            const b = bb.get(e.id)
            upd[e.id] = { y: e.y + (v - (b.top + b.bottom) / 2) }
          })
        } else if (type === 'distribute-h') {
          const s = [...els].sort((a, b) => bb.get(a.id).left - bb.get(b.id).left)
          if (s.length > 1) {
            const l = bb.get(s[0].id).left,
              r = bb.get(s[s.length - 1].id).right
            const tw = s.reduce((a, e) => a + bb.get(e.id).width, 0),
              gap = (r - l - tw) / (s.length - 1)
            let cx = l
            s.forEach((e) => {
              upd[e.id] = { x: e.x + (cx - bb.get(e.id).left) }
              cx += bb.get(e.id).width + gap
            })
          }
        } else if (type === 'distribute-v') {
          const s = [...els].sort((a, b) => bb.get(a.id).top - bb.get(b.id).top)
          if (s.length > 1) {
            const t = bb.get(s[0].id).top,
              b = bb.get(s[s.length - 1].id).bottom
            const th = s.reduce((a, e) => a + bb.get(e.id).height, 0),
              gap = (b - t - th) / (s.length - 1)
            let cy = t
            s.forEach((e) => {
              upd[e.id] = { y: e.y + (cy - bb.get(e.id).top) }
              cy += bb.get(e.id).height + gap
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
        ? template.elements.map((el) => cloneTemplateElementForTheme(el, () => crypto.randomUUID()))
        : [
            {
              id: crypto.randomUUID(),
              type: 'text',
              x: 80,
              y: 160,
              width: 800,
              height: 220,
              zIndex: 1,
              textColor: 'auto',
              fontFamily: 'var(--ns-font-heading)',
              content:
                '<h2 style="text-align: center">New Slide</h2><p style="text-align: center">Double-click to edit</p>',
            },
          ]
      let nextSlideIndex = null
      setPresentation((prev) => {
        const insertAt = afterIndex !== undefined ? afterIndex + 1 : prev.slides.length
        const currentIdx = afterIndex !== undefined ? afterIndex : currentSlideIndexRef.current
        const referenceSlide = prev.slides[currentIdx] || prev.slides[prev.slides.length - 1]
        const inheritedBg = referenceSlide?.background
          ? { ...referenceSlide.background }
          : { type: 'none' }
        const inheritedDesignTokens = cloneInheritedDesignTokens(referenceSlide)
        const newSlide = {
          id: crypto.randomUUID(),
          elements: baseElements,
          notes: '',
          background: inheritedBg,
          ...(inheritedDesignTokens ? { designTokens: inheritedDesignTokens } : {}),
        }
        const slides = [...prev.slides]
        slides.splice(insertAt, 0, newSlide)
        // Select the new slide AFTER the state commits — never inside the
        // reducer (StrictMode double-invokes updaters; setState there is impure).
        nextSlideIndex = insertAt
        return { ...prev, slides }
      })
      if (nextSlideIndex != null) setCurrentSlideIndex(nextSlideIndex)
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const deleteSlide = useCallback(
    (index) => {
      let nextSlideIndex = null
      setPresentation((prev) => {
        if (!prev || prev.slides.length <= 1) return prev
        const result = deleteSlidesAtIndices(prev.slides, [index], currentSlideIndexRef.current)
        nextSlideIndex = result.currentSlideIndex
        return { ...prev, slides: result.slides }
      })
      if (nextSlideIndex != null) setCurrentSlideIndex(nextSlideIndex)
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const duplicateSlide = useCallback(
    (index) => {
      let nextSlideIndex = null
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(
          prev.slides,
          [index],
          () => crypto.randomUUID(),
          currentSlideIndexRef.current
        )
        nextSlideIndex = result.currentSlideIndex
        return { ...prev, slides: result.slides }
      })
      if (nextSlideIndex != null) setCurrentSlideIndex(nextSlideIndex)
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const duplicateSlides = useCallback(
    (indices) => {
      let nextSlideIndex = null
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(
          prev.slides,
          indices,
          () => crypto.randomUUID(),
          currentSlideIndexRef.current
        )
        nextSlideIndex = result.currentSlideIndex
        return { ...prev, slides: result.slides }
      })
      if (nextSlideIndex != null) setCurrentSlideIndex(nextSlideIndex)
    },
    [setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const deleteSlides = useCallback(
    (indices) => {
      let nextSlideIndex = null
      setPresentation((prev) => {
        if (!prev) return prev
        const result = deleteSlidesAtIndices(prev.slides, indices, currentSlideIndexRef.current)
        nextSlideIndex = result.currentSlideIndex
        return { ...prev, slides: result.slides }
      })
      if (nextSlideIndex != null) setCurrentSlideIndex(nextSlideIndex)
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
          background: parent.background ? { ...parent.background } : { type: 'none' },
          ...(parent.designTokens ? { designTokens: cloneInheritedDesignTokens(parent) } : {}),
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
