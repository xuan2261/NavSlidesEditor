import { useCallback, useMemo } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { SLIDE_TEMPLATES } from '../data/slide-templates'
import {
  cloneSlideWithNewIds,
  deleteSlidesAtIndices,
  duplicateSlidesAtIndices,
  withDeletedSlideOccurrences,
} from './slide-operation-helpers'
import { invalidatePptxFitMetaForUpdates } from '../utils/pptx-import-meta'
import { getRotatedAABB } from '../components/canvas/use-canvas-resize-rotate'
import {
  cloneInheritedDesignTokens,
  cloneTemplateElementForTheme,
} from '../utils/slide-template-theme-normalization'
import { hasBlockedGroupMutation } from '../utils/active-slide-selection'
import {
  applyConnectorDependentPatches,
  buildConnectorUpdateBatch,
  isPureUnlockUpdate,
} from '../utils/element-update-fanout'
import { showNotice } from '../utils/app-feedback'
import { applySemanticGeometry, semanticCompatibility, withoutSemanticGeometry } from '../utils/pptx-semantic-geometry-bridge'
import { semanticSelection, groupSemanticSelection, ungroupSemanticSelection,
  regroupSemanticSelection, semanticDeletion } from '../components/canvas/canvas-semantic-group-commands'
import { deleteSlideElements } from '../utils/delete-slide-elements'
import { semanticInstance } from 'revealjs-shared/src/pptx-semantic-records.js'


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
        const lockIntents = updates?.some((update) => Object.hasOwn(update, 'locked')) ? [] : null
        let semantic = prev.pptxSemantic
        const result = mapActive(
          prev,
          (s) => {
            if (s.locked) return s
            const requested = (updates || []).filter(({ id, ...partial }) => {
              const element = (s.elements || []).find((candidate) => candidate.id === id)
              const inst = semanticInstance(semantic, id)
              return (element && (!element.locked || isPureUnlockUpdate(partial))) ||
                (!element && inst && !inst.lineage?.tombstone)
            })
            if (!requested.length) return s
            if (semantic) semantic = applySemanticGeometry(semantic, s, requested)
            if (lockIntents) {
              for (const update of requested) {
                if (Object.hasOwn(update, 'locked')) lockIntents.push(update)
              }
            }
            const batch = buildConnectorUpdateBatch(s.elements || [], requested.map(({ id, ...partial }) =>
              ({ id, ...withoutSemanticGeometry(s.elements.find((e) => e.id === id), partial) })))
            const byId = new Map(batch.map(({ id, ...partial }) => [id, partial]))
            const updated = {
              ...s,
              elements: (s.elements || []).map((el) =>
                byId.has(el.id)
                  ? { ...el, ...invalidatePptxFitMetaForUpdates(el, byId.get(el.id)) }
                  : el
              ),
            }
            return semantic ? semanticCompatibility(semantic, updated, prev.pptxSemantic) : updated
          },
          lockIntents
        )
        return semantic ? { ...result, pptxSemantic: semantic } : result
      })
    },
    [setPresentation, mapActive]
  )

  const replaceElementZOrder = useCallback(
    (updates) => {
      setPresentation((prev) => {
        if (!prev) return prev
        const zById = Object.fromEntries(updates.map(({ id, zIndex }) => [id, zIndex]))
        return mapActive(prev, (slide) => {
          if (slide.locked) return slide
          return {
            ...slide,
            elements: (slide.elements || []).map((element) =>
              zById[element.id] === undefined ? element : { ...element, zIndex: zById[element.id] }
            ),
          }
        })
      })
    },
    [setPresentation, mapActive]
  )

  // ── Delete all selected elements ───────────────────────────────────────────
  const deleteSelectedElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    const activeSlide = activeSlideOf()
    if (activeSlide?.locked || hasBlockedGroupMutation(activeSlide, ids)) return
    const lockedIds = new Set(
      (activeSlide?.elements || [])
        .filter((el) => ids.includes(el.id) && el.locked)
        .map((el) => el.id)
    )
    const deletableIds = ids.filter((id) => !lockedIds.has(id))
    if (!deletableIds.length) return
    const deletedIds = presentation?.pptxSemantic
      ? semanticDeletion(presentation.pptxSemantic, activeSlide, deletableIds).elementIds : deletableIds
    if ((activeSlide?.elements || []).some((element) => deletedIds.includes(element.id) && element.locked)) return
    setPresentation((prev) => {
      let semantic = prev.pptxSemantic
      const result = mapActive(prev, (s) => {
        if (s.locked) return s
        const deletion = semantic ? semanticDeletion(semantic, s, deletableIds) : null
        const removed = deletion?.elementIds || deletableIds
        if ((s.elements || []).some((element) => removed.includes(element.id) && element.locked)) return s
        if (deletion) semantic = deletion.document
        return deleteSlideElements(s, removed)
      })
      return semantic ? { ...result, pptxSemantic: semantic } : result
    })
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
    presentation,
  ])

  // ── Group / ungroup ────────────────────────────────────────────────────────
  const groupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (ids.length < 2) return
    const slide = activeSlideOf()
    if (slide?.locked) return
    if (hasBlockedGroupMutation(slide, ids)) return
    if ((slide?.elements || []).some((el) => ids.includes(el.id) && el.locked)) return
    const groupId = crypto.randomUUID()
    if (presentation?.pptxSemantic) {
      const selected = semanticSelection(presentation.pptxSemantic, slide, ids)
      if (selected.length !== ids.length) throw new TypeError('Cannot mix legacy and semantic groups')
      const restoredGroupId = regroupSemanticSelection(presentation.pptxSemantic, selected)?.groupId
      setPresentation((prev) => {
        const selected = semanticSelection(prev.pptxSemantic, slide, ids)
        if (selected.length !== ids.length) throw new TypeError('Cannot mix legacy and semantic groups')
        const restored = regroupSemanticSelection(prev.pptxSemantic, selected)
        const semantic = restored?.document || groupSemanticSelection(prev.pptxSemantic, selected, groupId)
        return { ...mapActive(prev, (s) => semanticCompatibility(semantic, s, prev.pptxSemantic)), pptxSemantic: semantic }
      })
      setSelectedElementIds([restoredGroupId || groupId])
      return
    }
    setPresentation((prev) =>
      mapActive(prev, (s) => ({
        ...s,
        elements: (s.elements || []).map((el) => (ids.includes(el.id) ? { ...el, groupId } : el)),
      }))
    )
  }, [setPresentation, selectedElementIdsRef, activeSlideOf, mapActive, presentation, setSelectedElementIds])

  const ungroupElements = useCallback(() => {
    const ids = selectedElementIdsRef.current
    if (!ids.length) return
    if (presentation?.pptxSemantic) {
      try {
        ungroupSemanticSelection(presentation.pptxSemantic,
          semanticSelection(presentation.pptxSemantic, activeSlideOf(), ids))
      } catch (error) {
        showNotice(error.message)
        return
      }
    }
    setPresentation((prev) => {
      if (!prev) return prev
      const slide = activeSlideOf()
      if (slide?.locked) return prev
      if (hasBlockedGroupMutation(slide, ids)) return prev
      if (prev.pptxSemantic) {
        const selected = semanticSelection(prev.pptxSemantic, slide, ids)
        const semantic = ungroupSemanticSelection(prev.pptxSemantic, selected)
        return { ...mapActive(prev, (s) => semanticCompatibility(semantic, s, prev.pptxSemantic)), pptxSemantic: semantic }
      }
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
  }, [setPresentation, selectedElementIdsRef, activeSlideOf, mapActive, presentation])

  // ── Alignment ──────────────────────────────────────────────────────────────
  const alignElements = useCallback(
    (type) => {
      const ids = selectedElementIdsRef.current
      if (ids.length < 2) return
      setPresentation((prev) => {
        if (!prev) return prev
        const slide = activeSlideOf()
        if (slide?.locked || hasBlockedGroupMutation(slide, ids)) return prev
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
        return mapActive(prev, (sl) => {
          const elements = (sl.elements || []).map((el) =>
            upd[el.id] ? { ...el, ...upd[el.id] } : el
          )
          return { ...sl, elements: applyConnectorDependentPatches(elements) }
        })
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
      if (!presentation) return
      const insertAt = afterIndex !== undefined ? afterIndex + 1 : presentation.slides.length
      setPresentation((prev) => {
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
        return { ...prev, slides }
      })
      setCurrentSlideIndex(insertAt)
    },
    [presentation, setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const deleteSlide = useCallback(
    (index) => {
      if (!presentation || presentation.slides.length <= 1) return
      const result = deleteSlidesAtIndices(
        presentation.slides,
        [index],
        currentSlideIndexRef.current
      )
      if (result.slides === presentation.slides) return
      setPresentation((prev) => withDeletedSlideOccurrences(prev, result.slides))
      setCurrentSlideIndex(result.currentSlideIndex)
    },
    [presentation, setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
  )

  const duplicateSlide = useCallback(
    (index) => {
      let targetIndex = 0
      let warnings = []
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(
          prev.slides,
          [index],
          undefined,
          0,
          prev.layoutMasters,
          prev.pptxSemantic
        )
        targetIndex = result.currentSlideIndex
        warnings = result.warnings
        return {
          ...prev,
          slides: result.slides,
          ...(result.pptxSemantic ? { pptxSemantic: result.pptxSemantic } : {}),
        }
      })
      if (warnings.length)
        showNotice(warnings.map((warning) => warning.error).join('\n'), {
          title: 'Repair interaction targets',
          testId: 'interaction-reference-notice',
        })
      setCurrentSlideIndex(targetIndex)
    },
    [setPresentation, setCurrentSlideIndex]
  )

  const duplicateSlides = useCallback(
    (indices) => {
      let targetIndex = 0
      let warnings = []
      setPresentation((prev) => {
        if (!prev) return prev
        const result = duplicateSlidesAtIndices(
          prev.slides,
          indices,
          undefined,
          0,
          prev.layoutMasters,
          prev.pptxSemantic
        )
        targetIndex = result.currentSlideIndex
        warnings = result.warnings
        return {
          ...prev,
          slides: result.slides,
          ...(result.pptxSemantic ? { pptxSemantic: result.pptxSemantic } : {}),
        }
      })
      if (warnings.length)
        showNotice(warnings.map((warning) => warning.error).join('\n'), {
          title: 'Repair interaction targets',
          testId: 'interaction-reference-notice',
        })
      setCurrentSlideIndex(targetIndex)
    },
    [setPresentation, setCurrentSlideIndex]
  )

  const deleteSlides = useCallback(
    (indices) => {
      if (!presentation) return
      const result = deleteSlidesAtIndices(
        presentation.slides,
        indices,
        currentSlideIndexRef.current
      )
      if (result.slides === presentation.slides) return
      setPresentation((prev) => withDeletedSlideOccurrences(prev, result.slides))
      setCurrentSlideIndex(result.currentSlideIndex)
    },
    [presentation, setPresentation, setCurrentSlideIndex, currentSlideIndexRef]
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
        const warnings = []
        const cloned = cloneSlideWithNewIds(child, undefined, prev.layoutMasters, warnings, prev.pptxSemantic)
        if (warnings.length)
          showNotice(warnings.map((warning) => warning.error).join('\n'), {
            title: 'Repair interaction targets',
            testId: 'interaction-reference-notice',
          })
        return {
          ...prev,
          ...(cloned.pptxSemantic ? { pptxSemantic: cloned.pptxSemantic } : {}),
          slides: prev.slides.map((slide, index) => {
            if (index !== parentIndex) return slide
            const children = [...(slide.children || [])]
            children.splice(childIndex + 1, 0, cloned.slide)
            return { ...slide, children }
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
        const slides = prev.slides.map((s, i) =>
          i === parentIndex
            ? { ...s, children: s.children.filter((_, ci) => ci !== childIndex) }
            : s
        )
        return withDeletedSlideOccurrences(prev, slides)
      })
    },
    [setPresentation]
  )

  return {
    updateElements,
    replaceElementZOrder,
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
