import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import {
  createEditorRichTextExtensions,
  preserveBlockColors,
} from '../../hooks/editor-controller/editor-rich-text-extensions'
import {
  resolveSemanticText,
  semanticTextToTipTap,
  semanticTextFromTipTap,
  semanticCaretMarks,
} from '../../utils/pptx-semantic-text-bridge'
import { semanticInstance } from 'revealjs-shared/src/pptx-semantic-records.js'

function RichLabelDocument({ element, enabled, onUpdate, semanticDocument, paintDocument, equationContext }) {
  const extensions = useMemo(() => createEditorRichTextExtensions(), [])
  const [initialContent] = useState(() =>
    semanticDocument
      ? semanticTextToTipTap(semanticDocument, paintDocument, equationContext)
      : preserveBlockColors(element.textHtml)
  )
  const sourceHtml = useRef(element.textHtml)
  const sourceDocument = useRef(semanticDocument)
  const target = useRef(null)
  const synchronizing = useRef(false)

  // A removed target loses its write capability before deferred TipTap teardown.
  useLayoutEffect(() => {
    target.current = { id: element.id, enabled, onUpdate, semanticDocument }
    return () => {
      target.current = null
    }
  }, [element.id, enabled, onUpdate, semanticDocument])

  const editor = useEditor({
    extensions,
    content: initialContent,
    parseOptions: { preserveWhitespace: 'full' },
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
    onSelectionUpdate: ({ editor: instance }) => {
      const marks = semanticCaretMarks(instance.state.selection.$from.parent)
      if (marks)
        instance.view.dispatch(
          instance.state.tr.setStoredMarks(marks.map((mark) => instance.schema.markFromJSON(mark)))
        )
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
      current.onUpdate({
        textHtml: instance.getHTML(),
        text: instance.getText(),
        ...(current.semanticDocument
          ? { semanticTextDocument: semanticTextFromTipTap(instance.getJSON()) }
          : {}),
      })
    },
  })
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    // Settle schema append-transactions before the first user selection. Opening
    // a label must not publish normalization as an authored/history change.
    editor.commands.setMeta('preventUpdate', true)
    const marks = semanticCaretMarks(editor.state.selection.$from.parent)
    if (marks)
      editor.view.dispatch(
        editor.state.tr.setStoredMarks(marks.map((mark) => editor.schema.markFromJSON(mark)))
      )
  }, [editor])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(enabled, false)
    editor.view.dom.setAttribute('aria-readonly', enabled ? 'false' : 'true')
  }, [editor, enabled])

  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (semanticDocument) {
      if (JSON.stringify(sourceDocument.current) === JSON.stringify(semanticDocument)) return
      sourceDocument.current = semanticDocument
      if (
        JSON.stringify(semanticTextFromTipTap(editor.getJSON())) ===
        JSON.stringify(semanticDocument)
      )
        return
    } else if (sourceHtml.current === element.textHtml) return
    sourceHtml.current = element.textHtml
    // A store echo is already in the editor; replacing it would end composition.
    if (!semanticDocument && editor.getHTML() === element.textHtml) return
    synchronizing.current = true
    try {
      editor.commands.setContent(
        semanticDocument
          ? semanticTextToTipTap(semanticDocument, paintDocument, equationContext)
          : preserveBlockColors(element.textHtml),
        { emitUpdate: false, parseOptions: { preserveWhitespace: 'full' } }
      )
    } finally {
      synchronizing.current = false
    }
  }, [editor, element.textHtml, semanticDocument, paintDocument, equationContext])

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
  pptxSemantic,
}) {
  const ids = selectedElementIds || [element.id]
  const semantic = resolveSemanticText({ pptxSemantic }, element)
  let instance = semanticInstance(pptxSemantic, element.pptxInstanceId)
  let semanticReadonly = false
  while (instance) {
    semanticReadonly ||= Boolean(
      instance.overrides.locked || instance.lineage?.tombstone || instance.lineage?.paintOnly
    )
    instance = semanticInstance(pptxSemantic, instance.parentInstanceId)
  }
  const enabled =
    !disabled &&
    !semanticReadonly &&
    element.type === 'shape' &&
    !element.locked &&
    ids.length === 1 &&
    ids[0] === element.id
  return (
    <RichLabelDocument
      key={element.id}
      element={element}
      enabled={enabled}
      onUpdate={onUpdate}
      semanticDocument={semantic?.document}
      paintDocument={semantic?.paintDocument}
      equationContext={semantic?.equationContext}
    />
  )
}
