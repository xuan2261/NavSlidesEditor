import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import { createEditorRichTextExtensions, preserveBlockColors } from './editor-rich-text-extensions'
import { invalidatePptxFitMetaForUpdates } from '../../utils/pptx-import-meta'

export function useEditorRichTextController({
  presentation,
  setPresentation,
  mapActive,
  activeSlideRef,
  currentSlideIndexRef,
  editingElementId,
  editingElementIdRef,
  setEditingElementId,
  setSelectedElementIds,
  setActiveTab,
  getElement,
  exitEditOnEscape,
}) {
  const settingContent = useRef(false)
  const mapTargetRef = useRef(mapActive)
  useLayoutEffect(() => {
    mapTargetRef.current = mapActive
  }, [mapActive])
  useEffect(() => {
    editingElementIdRef.current = editingElementId
  }, [editingElementId, editingElementIdRef])

  const editor = useEditor({
    extensions: createEditorRichTextExtensions(),
    content: '',
    editorProps: { handleKeyDown: (view, event) => exitEditOnEscape(view, event) },
    onUpdate: ({ editor: instance }) => {
      if (settingContent.current || !editingElementIdRef.current) return
      const content = instance.getHTML()
      const id = editingElementIdRef.current
      setPresentation((previous) =>
        mapTargetRef.current(previous, (slide) => ({
          ...slide,
          elements: (slide.elements || []).map((element) =>
            element.id === id && element.type === 'text'
              ? { ...element, ...invalidatePptxFitMetaForUpdates(element, { content }) }
              : element
          ),
        }))
      )
    },
  })

  const clearContent = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    settingContent.current = true
    editor.commands.setContent('', false)
    settingContent.current = false
  }, [editor])

  const startEditingElement = useCallback(
    (elementId) => {
      const element = getElement(
        activeSlideRef.current,
        presentation?.slides[currentSlideIndexRef.current],
        elementId
      )
      if (!element || activeSlideRef.current?.locked || element.locked) return
      setActiveTab('home')
      setEditingElementId(elementId)
      editingElementIdRef.current = elementId
      setSelectedElementIds([elementId])
      if (element.type !== 'text') return
      if (!editor || editor.isDestroyed) return
      settingContent.current = true
      editor.commands.setContent(preserveBlockColors(element.content || ''), false)
      settingContent.current = false
      setTimeout(() => {
        if (!editor.isDestroyed && editingElementIdRef.current === elementId)
          editor.commands.focus()
      }, 10)
    },
    [
      activeSlideRef,
      currentSlideIndexRef,
      editingElementIdRef,
      editor,
      getElement,
      presentation,
      setActiveTab,
      setEditingElementId,
      setSelectedElementIds,
    ]
  )

  const stopEditingElement = useCallback(() => {
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [editingElementIdRef, setEditingElementId])

  return {
    editor,
    settingContent,
    editingElementIdRef,
    clearContent,
    startEditingElement,
    stopEditingElement,
  }
}
