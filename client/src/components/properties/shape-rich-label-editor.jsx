import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  createEditorRichTextExtensions,
  preserveBlockColors,
} from '../../hooks/editor-controller/editor-rich-text-extensions'

function RichLabelDocument({ element, enabled, onUpdate }) {
  const extensions = useMemo(() => createEditorRichTextExtensions(), [])
  const [initialContent] = useState(() => preserveBlockColors(element.textHtml))
  const sourceHtml = useRef(element.textHtml)
  const target = useRef(null)
  const synchronizing = useRef(false)

  // A removed target loses its write capability before deferred TipTap teardown.
  useLayoutEffect(() => {
    target.current = { id: element.id, enabled, onUpdate }
    return () => {
      target.current = null
    }
  }, [element.id, enabled, onUpdate])

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable: enabled,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Shape rich label',
        'aria-multiline': 'true',
        'aria-readonly': enabled ? 'false' : 'true',
        'data-testid': 'prop-shape-rich-label',
        class:
          'min-h-20 max-h-60 overflow-auto px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-accent',
      },
    },
    onUpdate: ({ editor: instance }) => {
      const current = target.current
      if (
        synchronizing.current ||
        instance.isDestroyed ||
        !current?.enabled ||
        current.id !== element.id
      )
        return
      current.onUpdate({ textHtml: instance.getHTML(), text: instance.getText() })
    },
  })
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Settle schema append-transactions before the first user selection. Opening
    // a label must not publish normalization as an authored/history change.
    editor.commands.setMeta('preventUpdate', true)
  }, [editor])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(enabled, false)
    editor.view.dom.setAttribute('aria-readonly', enabled ? 'false' : 'true')
  }, [editor, enabled])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || sourceHtml.current === element.textHtml) return
    sourceHtml.current = element.textHtml
    // A store echo is already in the editor; replacing it would end composition.
    if (editor.getHTML() === element.textHtml) return
    synchronizing.current = true
    try {
      editor.commands.setContent(preserveBlockColors(element.textHtml), { emitUpdate: false })
    } finally {
      synchronizing.current = false
    }
  }, [editor, element.textHtml])

  return (
    <div className="flex flex-col gap-1 mb-2.5">
      <div className="text-[11px] text-text-muted">Label Text</div>
      <div className="rounded-sm border border-border bg-card text-text-primary">
        <EditorContent editor={editor} />
      </div>
      {!enabled && (
        <p className="m-0 text-[11px] text-text-muted">
          Select one unlocked shape to edit its rich label.
        </p>
      )}
    </div>
  )
}

export default function ShapeRichLabelEditor({
  element,
  selectedElementIds,
  disabled = false,
  onUpdate,
}) {
  const ids = selectedElementIds || [element.id]
  const enabled =
    !disabled &&
    element.type === 'shape' &&
    !element.locked &&
    ids.length === 1 &&
    ids[0] === element.id
  return (
    <RichLabelDocument key={element.id} element={element} enabled={enabled} onUpdate={onUpdate} />
  )
}
