import { useCallback, useEffect, useRef } from 'react'

export function useEditorInteractionReset({
  clearRichTextContent,
  editingElementIdRef,
  setActiveWorkspaceOverlay,
  setCodeEditorState,
  setCurrentSlideIndex,
  setEditingElementId,
  setHtmlEditorState,
  setLatexEditorState,
  setSelectedElementIds,
  setVerticalEdit,
}) {
  const clearRichTextContentRef = useRef(clearRichTextContent)

  useEffect(() => {
    clearRichTextContentRef.current = clearRichTextContent
  }, [clearRichTextContent])

  return useCallback(() => {
    setCurrentSlideIndex(0)
    setVerticalEdit(null)
    setSelectedElementIds([])
    setEditingElementId(null)
    editingElementIdRef.current = null
    setHtmlEditorState(null)
    setCodeEditorState(null)
    setLatexEditorState(null)
    setActiveWorkspaceOverlay(null)
    clearRichTextContentRef.current()
  }, [
    editingElementIdRef,
    setActiveWorkspaceOverlay,
    setCodeEditorState,
    setCurrentSlideIndex,
    setEditingElementId,
    setHtmlEditorState,
    setLatexEditorState,
    setSelectedElementIds,
    setVerticalEdit,
  ])
}
