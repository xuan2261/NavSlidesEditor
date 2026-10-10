import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
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
      const id = editingElementIdRef.current
      const target = activeSlideRef.current
      const element = target?.elements?.find((candidate) => candidate.id === id)
      if (!element || element.type !== 'text' || target.locked || element.locked) return
      const content = instance.getHTML()
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

  const resetContent = useCallback((content) => {
    if (!editor || editor.isDestroyed) return
    settingContent.current = true
    try {
      editor.commands.setContent(preserveBlockColors(content || ''), { emitUpdate: false })
      editor.view.updateState(EditorState.create({
        schema: editor.schema,
        doc: editor.state.doc,
        plugins: editor.state.plugins,
      }))
    } finally {
      settingContent.current = false
    }
  }, [editor])

  const clearContent = useCallback(() => resetContent(''), [resetContent])

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
      resetContent(element.content || '')
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
      resetContent,
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
    editingElementIdRef,
    clearContent,
    resetContent,
    startEditingElement,
    stopEditingElement,
  }
}
