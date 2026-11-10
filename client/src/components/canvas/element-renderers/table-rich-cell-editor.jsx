import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { createRichTableCell, tableCellHtml } from 'revealjs-shared'
import { createEditorRichTextExtensions, preserveBlockColors } from '../../../hooks/editor-controller/editor-rich-text-extensions'

export default function TableRichCellEditor({ cell, row, column, onChange }) {
  const html = tableCellHtml(cell)
  const extensions = useMemo(() => createEditorRichTextExtensions(), [])
  const [initialContent] = useState(() => preserveBlockColors(html))
  const sourceHtml = useRef(html)
  const target = useRef(null)
  const synchronizing = useRef(false)
  useLayoutEffect(() => {
    target.current = onChange
    return () => { target.current = null }
  }, [onChange])

  const editor = useEditor({
    extensions,
    content: initialContent,
    parseOptions: { preserveWhitespace: 'full' },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': `Table rich cell row ${row + 1} column ${column + 1}`,
        'aria-multiline': 'true',
        style: 'outline:none;min-height:1em;white-space:pre-wrap;word-break:break-word',
      },
    },
    onUpdate: ({ editor: instance }) => {
      if (synchronizing.current || instance.isDestroyed || !target.current) return
      const next = createRichTableCell(instance.getHTML())
      sourceHtml.current = next.html
      target.current(next)
    },
  })

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Settle schema normalization without recording an authored table change.
    editor.commands.setMeta('preventUpdate', true)
    editor.commands.focus('end', { scrollIntoView: false })
  }, [editor])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || sourceHtml.current === html) return
    sourceHtml.current = html
    if (editor.getHTML() === html) return
    synchronizing.current = true
    try {
      editor.commands.setContent(preserveBlockColors(html), {
        emitUpdate: false, parseOptions: { preserveWhitespace: 'full' },
      })
    } finally {
      synchronizing.current = false
    }
  }, [editor, html])

  const stopPropagation = (event) => event.stopPropagation()
  return <div onMouseDown={stopPropagation} onPointerDown={stopPropagation} onKeyDown={stopPropagation}>
    <EditorContent editor={editor} />
  </div>
}
