import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import { resolveHistoryAuthoringSlide } from '../../utils/history-authoring-slide'
import { useSlideOperations } from '../use-slide-operations'
import { useEditorActiveSlideController } from './use-editor-active-slide-controller'
import { useEditorLayoutController } from './use-editor-layout-controller'
import { useEditorHistoryController } from './use-editor-history-controller'
import { useEditorElementController } from './use-editor-element-controller'
import { useEditorSelectionController } from './use-editor-selection-controller'

export const shapes = [
  { id: 'a', type: 'shape', x: 100, y: 50, width: 200, height: 100, fill: '#123456' },
  { id: 'b', type: 'shape', x: 400, y: 100, width: 100, height: 100, fill: '#abcdef' },
  { id: 'c', type: 'shape', x: 250, y: 200, width: 80, height: 60, fill: '#654321' },
]
export function authoringSeed() {
  return {
    id: 'safety-deck',
    resolution: { width: 1600, height: 900 },
    slides: [
      {
        id: 'parent',
        elements: [{ ...shapes[0], id: 'parent-guard' }],
        children: [
          { id: 'child', elements: shapes.map((element) => ({ ...element })) },
          { id: 'sibling', elements: [{ ...shapes[1], id: 'sibling-guard' }] },
        ],
      },
    ],
    layoutMasters: [
      {
        id: 'master',
        name: 'Safety master',
        placeholders: [],
        fixedElements: [
          ...shapes.map((element, index) => ({
            ...element,
            id: 'm-' + element.id,
            locked: index !== 1,
          })),
          { ...shapes[0], id: 'm-unset', x: 700 },
        ],
      },
      {
        id: 'other',
        name: 'Other master',
        placeholders: [],
        fixedElements: [{ ...shapes[0], id: 'other-guard', locked: true }],
      },
    ],
  }
}
export function useAuthoringSafetyHarness(seed) {
  const [presentation, setPresentation] = useState(seed)
  const [position, setPosition] = useState({ index: 0, vertical: null })
  const index = position.index
  const verticalEdit = position.vertical
  const setCurrentSlideIndex = useCallback(
    (next) =>
      setPosition((previous) => {
        const index = typeof next === 'function' ? next(previous.index) : next
        return index === previous.index ? previous : { index, vertical: null }
      }),
    []
  )
  const setVerticalEdit = useCallback(
    (next) =>
      setPosition((previous) => {
        const vertical = typeof next === 'function' ? next(previous.vertical) : next
        return vertical === previous.vertical ? previous : { ...previous, vertical }
      }),
    []
  )
  const selectedIds = useEditorStore((state) => state.selectedElementIds)
  const editingId = useEditorStore((state) => state.editingElementId)
  const setSelectedElementIds = useEditorStore((state) => state.setSelectedElementIds)
  const setEditingElementId = useEditorStore((state) => state.setEditingElementId)
  const selectedElementIdsRef = useRef(selectedIds)
  const editingElementIdRef = useRef(editingId)
  useEffect(() => {
    selectedElementIdsRef.current = selectedIds
  }, [selectedIds])
  useEffect(() => {
    editingElementIdRef.current = editingId
  }, [editingId])
  const active = useEditorActiveSlideController({
    presentation,
    currentSlideIndex: index,
    verticalEdit,
    setVerticalEdit,
  })
  const layout = useEditorLayoutController({
    presentation,
    setPresentation,
    mapActive: active.mapActive,
    setSelectedElementIds,
  })
  const slide = layout.masterEdit
    ? { id: 'master:' + layout.masterEdit.id, elements: layout.masterEdit.fixedElements }
    : active.activeSlide
  const slideRef = useRef(slide)
  useLayoutEffect(() => {
    slideRef.current = slide
  }, [slide])
  const getSlide = useCallback(() => slideRef.current, [])
  const single = useEditorElementController({
    setPresentation,
    mapActive: active.mapActive,
    activeSlide: active.activeSlide,
    setSelectedElementIds,
    editingElementId: editingId,
    setEditingElementId,
    editingElementIdRef,
  })
  const operations = useSlideOperations({
    presentation,
    setPresentation,
    currentSlideIndex: index,
    setCurrentSlideIndex,
    currentSlideIndexRef: active.currentSlideIndexRef,
    selectedElementIdsRef,
    editingElementIdRef,
    mapActiveSlide: layout.mapAuthoringTarget,
    getActiveSlide: getSlide,
  })
  const selection = useEditorSelectionController({
    presentation,
    selectedElementIdsRef,
    activeSlideRef: active.activeSlideRef,
    currentSlideIndexRef: active.currentSlideIndexRef,
    editingElementIdRef,
    getSelectionSlide: getSlide,
    updateElement: layout.masterEdit ? layout.updateMasterElement : single.updateElement,
    updateElements: operations.updateElements,
    replaceElementZOrder: operations.replaceElementZOrder,
    setSelectedElementIds,
    setEditingElementId,
    clearRichTextContent: () => setEditingElementId(null),
    notifyBlockedAction: (reason) => {
      throw new Error('Unexpected block: ' + reason)
    },
  })
  const resolveHistorySlide = useCallback(
    (state) =>
      resolveHistoryAuthoringSlide(state, {
        presentationId: presentation.id,
        masterId: layout.masterEdit?.id,
        currentSlideIndex: active.currentSlideIndexRef.current,
        verticalEdit: active.verticalEditRef.current,
      }),
    [presentation.id, layout.masterEdit?.id, active.currentSlideIndexRef, active.verticalEditRef]
  )
  const history = useEditorHistoryController({
    presentation,
    setPresentation,
    setCurrentSlideIndex,
    setVerticalEdit,
    resolveHistorySlide,
    selectedElementIdsRef,
    editingElementIdRef,
    setSelectedElementIds,
    setEditingElementId,
    resetContent: () => {},
  })
  useEffect(() => {
    history.seedHistory(seed)
    setPresentation(JSON.parse(JSON.stringify(seed)))
  }, [seed, history.seedHistory])
  return {
    presentation,
    setPresentation,
    selectedIds,
    editingId,
    verticalEdit,
    setVerticalEdit,
    setCurrentSlideIndex,
    ...layout,
    ...operations,
    ...selection,
    ...history,
  }
}
