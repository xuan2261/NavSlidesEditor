import { useCallback, useEffect, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import Highlight from '@tiptap/extension-highlight'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { MathNode } from '../../extensions/MathExtension'
import { FontFamily } from '../../extensions/FontFamily'
import { FontSize } from '../../extensions/FontSize'
import { FontWeight } from '../../extensions/tiptap-font-weight-extension'
import { LineHeight } from '../../extensions/tiptap-line-height-extension'
import { invalidatePptxFitMetaForUpdates } from '../../utils/pptx-import-meta'

const preserveBlockColors = (html) => {
  if (!html) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.body.querySelectorAll('ul, ol').forEach((list) => {
    const { color, fontSize, lineHeight } = list.style
    if (!color && !fontSize && !lineHeight) return
    list.querySelectorAll(':scope > li').forEach((li) => {
      if (color && !li.style.color) li.style.color = color
      if (fontSize && !li.style.fontSize) li.style.fontSize = fontSize
      if (lineHeight && !li.style.lineHeight) li.style.lineHeight = lineHeight
    })
    if (color) list.style.removeProperty('color')
    if (fontSize) list.style.removeProperty('font-size')
    if (lineHeight) list.style.removeProperty('line-height')
  })
  doc.body
    .querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, div')
    .forEach((element) => {
      const { color, fontSize } = element.style
      if (!color && !fontSize) return
      const span = doc.createElement('span')
      if (color) {
        span.style.color = color
        element.style.removeProperty('color')
      }
      if (fontSize) {
        span.style.fontSize = fontSize
        element.style.removeProperty('font-size')
      }
      while (element.firstChild) span.appendChild(element.firstChild)
      element.appendChild(span)
    })
  return doc.body.innerHTML
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
  useEffect(() => {
    editingElementIdRef.current = editingElementId
  }, [editingElementId, editingElementIdRef])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Color,
      TextStyle,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: 'Click to start typing...' }),
      MathNode,
      FontFamily,
      FontSize,
      FontWeight,
      LineHeight,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: '',
    editorProps: { handleKeyDown: (view, event) => exitEditOnEscape(view, event) },
    onUpdate: ({ editor: instance }) => {
      if (settingContent.current || !editingElementIdRef.current) return
      const content = instance.getHTML()
      const id = editingElementIdRef.current
      setPresentation((previous) =>
        mapActive(previous, (slide) => ({
          ...slide,
          elements: (slide.elements || []).map((element) =>
            element.id === id
              ? { ...element, ...invalidatePptxFitMetaForUpdates(element, { content }) }
              : element
          ),
        }))
      )
    },
  })

  const clearContent = useCallback(() => {
    if (!editor) return
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
      settingContent.current = true
      editor?.commands.setContent(preserveBlockColors(element.content || ''), false)
      settingContent.current = false
      setTimeout(() => editor?.commands.focus(), 10)
    },
    [activeSlideRef, currentSlideIndexRef, editingElementIdRef, editor, getElement, presentation, setActiveTab, setEditingElementId, setSelectedElementIds]
  )

  const stopEditingElement = useCallback(() => {
    setEditingElementId(null)
    editingElementIdRef.current = null
  }, [editingElementIdRef, setEditingElementId])

  return { editor, settingContent, editingElementIdRef, clearContent, startEditingElement, stopEditingElement }
}
