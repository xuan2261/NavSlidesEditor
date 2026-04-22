import { useCallback } from 'react'
import { usePresentationStore } from '../stores/presentation-store'
import { useEditorStore } from '../stores/editor-store'

export function useClipboard() {
  const presentation = usePresentationStore((s) => s.presentation)
  const currentSlideIndex = usePresentationStore((s) => s.currentSlideIndex)
  const addElement = usePresentationStore((s) => s.addElement)
  const deleteElement = usePresentationStore((s) => s.deleteElement)

  const selectedElementIds = useEditorStore((s) => s.selectedElementIds)
  const clipboard = useEditorStore((s) => s.clipboard)
  const setClipboard = useEditorStore((s) => s.setClipboard)
  const selectElement = useEditorStore((s) => s.selectElement)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  const performCopy = useCallback(() => {
    if (selectedElementIds.length === 0 || !presentation) return
    const slide = presentation.slides[currentSlideIndex]
    if (!slide) return

    const elementsToCopy = slide.elements.filter((el) => selectedElementIds.includes(el.id))
    if (elementsToCopy.length > 0) {
      setClipboard(elementsToCopy)
    }
  }, [selectedElementIds, presentation, currentSlideIndex, setClipboard])

  const performPaste = useCallback(() => {
    if (!clipboard || clipboard.length === 0) return

    const newElementIds = []
    clipboard.forEach((el) => {
      const newId = crypto.randomUUID()
      newElementIds.push(newId)
      addElement({ ...el, id: newId, x: (el.x || 0) + 20, y: (el.y || 0) + 20 })
    })

    if (newElementIds.length > 0) {
      selectElement(newElementIds[newElementIds.length - 1])
    }
  }, [clipboard, addElement, selectElement])

  const performCut = useCallback(() => {
    performCopy()
    selectedElementIds.forEach((id) => deleteElement(id))
    clearSelection()
  }, [performCopy, selectedElementIds, deleteElement, clearSelection])

  const performDuplicate = useCallback(() => {
    performCopy()
    setTimeout(performPaste, 50)
  }, [performCopy, performPaste])

  return { performCopy, performPaste, performCut, performDuplicate }
}
