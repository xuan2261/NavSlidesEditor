// @vitest-environment jsdom
import { Editor } from '../../client/node_modules/@tiptap/core/dist/index.js'
import { describe, expect, it } from 'vitest'
import { semanticCaretMarks, semanticTextFromTipTap, semanticTextToTipTap, semanticTextLayoutKey } from '../../client/src/utils/pptx-semantic-text-bridge'
import { createEditorRichTextExtensions } from '../../client/src/hooks/editor-controller/editor-rich-text-extensions'
import { textDocumentHtml } from '../../shared/src/pptx-shape-label'
import { sanitizeRichTextHtml } from '../../shared/src/content-safety'
const ink = { kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] }
const none = { kind: 'none' }
const source = (highlight = ink) => ({ schemaVersion: 1, componentId: 'body', paragraphs: [
  { componentId: 'p', defaultRunProperties: { fontSizePt: 20 }, runs: [
    { componentId: 'r', kind: 'text', text: 'AB', properties: { highlight } },
    { componentId: 's', kind: 'text', text: 'C' },
  ] },
] })
const highlightMark = (json) => json.content[0].content[0].marks.find((mark) => mark.type === 'highlight')

describe('typed highlight frontend bridge and HTML paint', () => {
  it('paints native alpha and explicit none on existing spans without mutating declarations', () => {
    const document = source(), before = structuredClone(document)
    document.paragraphs[0].defaultRunProperties.highlight = { kind: 'srgb', value: 'FFFF00' }
    document.paragraphs[0].runs[1].properties = { highlight: none }
    const snapshot = structuredClone(document), html = textDocumentHtml(document)
    expect(html).toContain('background-color:rgba(255,0,0,0.5)')
    expect(html).toContain('background-color:transparent')
    expect(html).toContain('AB</span>')
    expect(sanitizeRichTextHtml(html)).toContain('background-color')
    expect(document).toEqual(snapshot)
    expect(before.paragraphs[0].runs[0].properties.highlight).toEqual(ink)
  })
  it('retains native kind/value/transforms across CSS normalization and writes only the changed canonical color', () => {
    const document = source(), snapshot = structuredClone(document), json = semanticTextToTipTap(document)
    expect(highlightMark(json).attrs.color).toBe('rgba(255,0,0,0.5)')
    highlightMark(json).attrs.color = 'rgba(255, 0, 0, 0.5)'
    expect(semanticTextFromTipTap(json)).toEqual(document)
    highlightMark(json).attrs.color = 'rgba(0, 0, 255, 0.25)'
    expect(semanticTextFromTipTap(json).paragraphs[0].runs[0].properties.highlight).toEqual({
      kind: 'srgb', value: '0000FF', transforms: [{ kind: 'alpha', value: 25000 }],
    })
    const editedProjection = semanticTextToTipTap(semanticTextFromTipTap(json), document)
    expect(highlightMark(editedProjection).attrs.color).toBe('rgba(0,0,255,0.25)')
    expect(document).toEqual(snapshot)
    highlightMark(json).attrs.color = 'url(unsafe)'
    expect(() => semanticTextFromTipTap(json)).toThrow(/Unsupported semantic color/)
  })
  it('paints direct scheme highlight from occurrence paint and retains its native transforms on a no-op', () => {
    const declaration = { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'alpha', value: 25000 }] }
    const document = source(declaration), paint = structuredClone(document)
    paint.paragraphs[0].runs[0].properties.highlight = { kind: 'srgb', value: '123456', transforms: declaration.transforms }
    const json = semanticTextToTipTap(document, paint)
    expect(highlightMark(json).attrs.color).toBe('rgba(18,52,86,0.25)')
    expect(semanticTextFromTipTap(json)).toEqual(document)
    expect(document.paragraphs[0].runs[0].properties.highlight).toEqual(declaration)
  })
  it('uses materialized inherited scheme paint while retaining authored absence and writes explicit none on removal', () => {
    const document = source(), paragraph = document.paragraphs[0]
    delete paragraph.runs[0].properties
    paragraph.defaultRunProperties.highlight = { kind: 'scheme', value: 'accent1' }
    const paint = structuredClone(document)
    paint.paragraphs[0].defaultRunProperties.highlight = { kind: 'srgb', value: '123456' }
    const json = semanticTextToTipTap(document, paint)
    expect(highlightMark(json).attrs.color).toBe('#123456')
    expect(semanticTextFromTipTap(json)).toEqual(document)
    json.content[0].content[0].marks = json.content[0].content[0].marks.filter((mark) => mark.type !== 'highlight')
    const cleared = semanticTextFromTipTap(json)
    expect(cleared.paragraphs[0].runs[0].properties.highlight).toEqual(none)
    expect(cleared.paragraphs[0].defaultRunProperties.highlight).toEqual(paragraph.defaultRunProperties.highlight)
    expect(highlightMark(semanticTextToTipTap(cleared))).toBeUndefined()
  })
  it('uses the configured Highlight extension for selected edits, typed source preservation, clear, undo and HTML reopen', () => {
    const document = source(), snapshot = structuredClone(document), element = globalThis.document.createElement('div')
    globalThis.document.body.append(element)
    const editor = new Editor({ element, extensions: createEditorRichTextExtensions(), content: semanticTextToTipTap(document) })
    try {
      expect(editor.extensionManager.extensions.find((extension) => extension.name === 'highlight').options.multicolor).toBe(true)
      editor.chain().setTextSelection({ from: 1, to: 2 }).setHighlight({ color: '#00FF00' }).run()
      const changed = semanticTextFromTipTap(editor.getJSON())
      expect(changed.paragraphs[0].runs.map((run) => [run.text, run.properties?.highlight])).toEqual([
        ['A', { kind: 'srgb', value: '00FF00' }], ['B', ink], ['C', undefined],
      ])
      editor.commands.undo()
      expect(semanticTextFromTipTap(editor.getJSON())).toEqual(document)
      editor.commands.redo()
      const html = editor.getHTML()
      editor.commands.setContent(html, { emitUpdate: false })
      expect(semanticTextFromTipTap(editor.getJSON())).toEqual(changed)
      editor.chain().setTextSelection({ from: 1, to: 2 }).unsetHighlight().run()
      expect(semanticTextFromTipTap(editor.getJSON()).paragraphs[0].runs[0].properties.highlight).toEqual(none)
      expect(document).toEqual(snapshot)
    } finally { editor.destroy(); element.remove() }
  })
  it('projects inherited end-caret paint without copying materialized color into authored run metadata', () => {
    const document = source()
    document.paragraphs[0].runs = []
    document.paragraphs[0].endRunProperties = { highlight: { kind: 'scheme', value: 'accent1' } }
    const paint = structuredClone(document)
    paint.paragraphs[0].endRunProperties.highlight = { kind: 'srgb', value: '123456' }
    const attrs = semanticTextToTipTap(document, paint).content[0].attrs
    const marks = semanticCaretMarks({ attrs, content: { size: 0 } })
    expect(marks.find((mark) => mark.type === 'highlight').attrs.color).toBe('#123456')
    expect(marks.find((mark) => mark.type === 'textStyle').attrs.pptxRun.run.properties.highlight)
      .toEqual({ kind: 'scheme', value: 'accent1' })
  })
  it('invalidates the occurrence editor cache when only materialized inherited highlight paint changes', () => {
    const document = source()
    const before = semanticTextLayoutKey(document, { highlightPaint: [['p', { kind: 'srgb', value: 'FFFF00' }]] })
    expect(semanticTextLayoutKey(document, { highlightPaint: [['p', { kind: 'srgb', value: '0000FF' }]] })).not.toBe(before)
  })
})
