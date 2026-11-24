import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import { EditorState } from '@tiptap/pm/state'
import { createEditorRichTextExtensions, preserveBlockColors } from './editor-rich-text-extensions'
import { invalidatePptxFitMetaForUpdates } from '../../utils/pptx-import-meta'
import { resolveSemanticText, semanticTextToTipTap, semanticTextFromTipTap, semanticCaretMarks, semanticTextLayoutKey, commitSemanticText } from '../../utils/pptx-semantic-text-bridge'
import { canonicalTextReadonly } from 'revealjs-shared/src/pptx-text-operations.js'
import { semanticInstance } from 'revealjs-shared/src/pptx-semantic-records.js'

function editableTextTarget(presentation, slide, element) {
  if (!element || element.type !== 'text' || slide?.locked || element.locked) return false
  const model = presentation?.pptxSemantic
  if (!element.pptxInstanceId || !model) return true
  const instance = semanticInstance(model, element.pptxInstanceId)
  return instance?.slideId === slide?.id && !canonicalTextReadonly(model, instance.id)
}

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
  const semanticTargetRef = useRef(null)
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
    parseOptions: { preserveWhitespace: 'full' },
    editorProps: { handleKeyDown: (view, event) => exitEditOnEscape(view, event) },
    onSelectionUpdate: ({ editor: instance }) => {
      const marks = semanticCaretMarks(instance.state.selection.$from.parent)
      if (marks) instance.view.dispatch(instance.state.tr.setStoredMarks(marks.map((mark) => instance.schema.markFromJSON(mark))))
    },
    onUpdate: ({ editor: instance }) => {
      if (settingContent.current || !editingElementIdRef.current) return
      const id = editingElementIdRef.current
      const target = activeSlideRef.current
      const element = target?.elements?.find((candidate) => candidate.id === id)
      if (!editableTextTarget(presentation, target, element)) return
      const content = instance.getHTML()
      if (semanticTargetRef.current) {
        const document = semanticTextFromTipTap(instance.getJSON())
        semanticTargetRef.current.document = document
        semanticTargetRef.current.layoutKey = semanticTextLayoutKey(document, semanticTargetRef.current.layoutDependencies)
        instance.commands.cacheSemanticTextLayout(semanticTargetRef.current.layoutKey, semanticTextToTipTap(document, semanticTargetRef.current.paintDocument, semanticTargetRef.current.equationContext))
        setPresentation((previous) => commitSemanticText(previous, element, document, content, mapTargetRef.current))
        return
      }
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
      editor.commands.setContent(typeof content === 'object' ? content : preserveBlockColors(content || ''), { emitUpdate: false, parseOptions: { preserveWhitespace: 'full' } })
      editor.view.updateState(EditorState.create({
        schema: editor.schema,
        doc: editor.state.doc,
        plugins: editor.state.plugins,
      }))
      const marks = semanticCaretMarks(editor.state.selection.$from.parent)
      if (marks) editor.view.dispatch(editor.state.tr.setStoredMarks(marks.map((mark) => editor.schema.markFromJSON(mark))))
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
      if (element.type === 'text' && !editableTextTarget(presentation, activeSlideRef.current, element)) return
      setActiveTab('home')
      setEditingElementId(elementId)
      editingElementIdRef.current = elementId
      setSelectedElementIds([elementId])
      if (element.type !== 'text') return
      if (!editor || editor.isDestroyed) return
      const semantic = resolveSemanticText(presentation, element)
      semanticTargetRef.current = semantic
      if (semantic) {
        if (editor.storage.semanticTextIdentity.layoutCache?.key !== semantic.layoutKey)
          editor.commands.cacheSemanticTextLayout(semantic.layoutKey, semanticTextToTipTap(semantic.document, semantic.paintDocument, semantic.equationContext))
        resetContent(editor.storage.semanticTextIdentity.layoutCache.content)
      } else resetContent(element.content || '')
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
    semanticTargetRef.current = null
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [editingElementIdRef, setEditingElementId])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    const slide = activeSlideRef.current
    const element = slide?.elements?.find((candidate) => candidate.id === editingElementId)
    editor.setEditable(editableTextTarget(presentation, slide, element), false)
  }, [presentation, activeSlideRef, editingElementId, editor])

  useLayoutEffect(() => {
    const semantic = semanticTargetRef.current
    if (!semantic || !editingElementIdRef.current) return
    const element = activeSlideRef.current?.elements?.find((candidate) => candidate.id === editingElementIdRef.current)
    const restored = resolveSemanticText(presentation, element)
    if (!restored || (restored.document === semantic.document && restored.layoutKey === semantic.layoutKey)) return
    let currentDocument
    try { currentDocument = editor && semanticTextFromTipTap(editor.getJSON()) } catch { currentDocument = null }
    if (restored.layoutKey !== semantic.layoutKey || JSON.stringify(restored.document) !== JSON.stringify(currentDocument)) {
      semanticTargetRef.current = restored
      editor.commands.cacheSemanticTextLayout(restored.layoutKey, semanticTextToTipTap(restored.document, restored.paintDocument, restored.equationContext))
      if (JSON.stringify(restored.document) !== JSON.stringify(currentDocument))
        resetContent(editor.storage.semanticTextIdentity.layoutCache.content)
    }
  }, [presentation, activeSlideRef, editingElementIdRef, editor, resetContent])

  return {
    editor,
    editingElementIdRef,
    clearContent,
    resetContent,
    startEditingElement,
    stopEditingElement,
  }
}
