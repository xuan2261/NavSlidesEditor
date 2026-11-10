// @vitest-environment jsdom
import { useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
import { useEditorRichTextController } from '../../client/src/hooks/editor-controller/use-editor-rich-text-controller'
import { normalizeTextDocument } from '../../shared/src/pptx-text-document'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
const { EditorContent } = createRequire(createRequire(import.meta.url).resolve('../../client/package.json'))('@tiptap/react')
import { semanticTextToTipTap, semanticTextFromTipTap } from '../../client/src/utils/pptx-semantic-text-bridge'
const document = () => ({
  schemaVersion: 1, componentId: 'body',
  body: { insetLeftEmu: 1234, autofit: { mode: 'none' }, verticalAlign: 'ctr' },
  paragraphs: [{ componentId: 'p1', properties: { direction: 'rtl', tabs: [{ positionEmu: 2345, alignment: 'dec' }],
      bullet: { kind: 'character', character: '•' }, spaceAfter: { unit: 'points', value: 3.5 } },
    defaultRunProperties: { language: 'ja-JP' }, endRunProperties: { fontSizePt: 12 },
    runs: [{ componentId: 'r1', kind: 'text', text: ' A\t', properties: { fontSizePt: 12, language: 'en-US', kerningPt: 2 } },
      { componentId: 'r2', kind: 'text', text: '中אב ', properties: { fontSizePt: 24, bold: true, direction: 'rtl' } },
    ] }],
})
const seed = () => ({
    slides: [{ id: 'slide', elements: [
      { id: 'text', type: 'text', pptxInstanceId: 'i1', content: '<p>Wrong compatibility text</p>' },
      { id: 'other', type: 'text', pptxInstanceId: 'i2', content: '<p>Other</p>' },
    ] }],
    pptxSemantic: { schemaVersion: 1, fonts: {}, styles: {}, definitions: { def: {
      id: 'def', kind: 'text',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: '2', preconditionHash: 'a'.repeat(64) },
      components: [{ id: 'body', kind: 'property', locator: { path: [0, 0, 2], preconditionHash: 'a'.repeat(64) } }], content: { textDocument: document() },
    } }, instances: {
      i1: { id: 'i1', slideId: 'slide', definitionId: 'def', parentInstanceId: null, localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} },
      i2: { id: 'i2', slideId: 'slide', definitionId: 'def', parentInstanceId: null, localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 1, overrides: {} },
    } },
})
let current
function Harness() {
  const [presentation, setPresentation] = useState(null), [editingElementId, setEditingElementId] = useState(null)
  const editingElementIdRef = useRef(null), activeSlideRef = useRef(null)
  useLayoutEffect(() => { activeSlideRef.current = presentation?.slides[0] }, [presentation])
  const currentSlideIndexRef = useRef(0), selectedElementIdsRef = useRef(['text']), verticalEditRef = useRef(null)
  const rich = useEditorRichTextController({
    presentation, setPresentation, mapActive: (deck, fn) => ({ ...deck, slides: [fn(deck.slides[0])] }),
    activeSlideRef, currentSlideIndexRef, editingElementId, editingElementIdRef,
    setEditingElementId, setSelectedElementIds: () => {}, setActiveTab: () => {},
    getElement: (slide, _fallback, id) => slide.elements.find((el) => el.id === id),
    exitEditOnEscape: () => false,
  })
  const { seedHistory, ...history } = useEditorHistoryController({
    presentation, setPresentation, currentSlideIndexRef, verticalEditRef, selectedElementIdsRef, editingElementIdRef,
    setSelectedElementIds: () => {}, setEditingElementId, setCurrentSlideIndex: () => {}, setVerticalEdit: () => {},
    resetContent: rich.resetContent,
  })
  useLayoutEffect(() => { current = { ...rich, ...history, seedHistory, presentation, setPresentation } }, [rich, history, seedHistory, presentation])
  return <EditorContent editor={rich.editor} />
}
function mount(initial = seed()) {
  if (initial.pptxSemantic) initial = { ...initial, pptxSemantic: normalizePptxSemanticDocument(initial.pptxSemantic) }
  render(<Harness />)
  act(() => { current.seedHistory(initial); current.setPresentation(initial) })
  act(() => current.startEditingElement('text'))
  return current.editor
}
const edited = () => current.presentation.pptxSemantic.instances.i1.overrides.components?.body?.textDocument
afterEach(cleanup)
describe('canonical semantic text with mounted TipTap and real controller', () => {
  it('preserves inherited outline declarations and noFill while typing and undoing', () => {
    const initial = seed(), doc = initial.pptxSemantic.definitions.def.content.textDocument
    const outline = { width: 19050, color: { kind: 'srgb', value: 'FF0000' } }
    doc.paragraphs[0].defaultRunProperties.outline = outline
    doc.paragraphs[0].runs[1].properties.outline = { fill: 'none', color: { kind: 'none' } }
    const editor = mount(initial)
    const first = editor.getJSON().content[0].content.find((node) => node.text?.includes('A'))
    expect(first.marks.find((mark) => mark.type === 'textStyle').attrs.pptxRun.outline).toEqual(outline)
    act(() => editor.chain().setTextSelection(2).insertContent('!').run())
    expect(edited().paragraphs[0].defaultRunProperties.outline).toEqual(outline)
    expect(edited().paragraphs[0].runs[0].properties).not.toHaveProperty('outline')
    expect(edited().paragraphs[0].runs[1].properties.outline).toEqual({ fill: 'none', color: { kind: 'none' } })
    act(() => editor.commands.undo())
    expect(edited()).toEqual(doc)
  })
  it('uses source identity, preserves native sizes and Unicode on no-op focus/blur', () => {
    const initial = seed(), editor = mount(initial)
    expect(editor.state.doc.textContent).toBe(' A\t中אב ')
    expect(editor.getHTML()).toMatch(/12pt.*24pt/s)
    act(() => { editor.commands.focus(undefined, { scrollIntoView: false }); editor.commands.blur(); current.stopEditingElement() })
    expect(current.presentation).toEqual(initial)
  })
  it('paints typed preset color and alpha in mounted TipTap without rewriting it on focus/blur', () => {
    const initial = seed()
    const color = { kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] }
    initial.pptxSemantic.definitions.def.content.textDocument.paragraphs[0].runs[0].properties.color = color
    const editor = mount(initial)
    expect(editor.getHTML()).toContain('color: rgba(255, 0, 0, 0.5)')
    act(() => { editor.commands.focus(undefined, { scrollIntoView: false }); editor.commands.blur(); current.stopEditingElement() })
    expect(current.presentation).toEqual(initial)
  })
  it('preserves typed preset source when DOM normalizes rgba spacing and saves a selected color edit', () => {
    const source = document()
    const color = { kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] }
    source.paragraphs[0].runs[0].properties.color = color
    const json = semanticTextToTipTap(source)
    const mark = json.content[0].content[0].marks.find((entry) => entry.type === 'textStyle')
    mark.attrs.color = 'rgba(255, 0, 0, 0.5)'
    expect(semanticTextFromTipTap(json)).toEqual(source)
    mark.attrs.color = 'rgba(0, 0, 255, 0.25)'
    const changed = semanticTextFromTipTap(json)
    expect(changed.paragraphs[0].runs[0].properties.color).toEqual({
      kind: 'srgb', value: '0000FF', transforms: [{ kind: 'alpha', value: 25000 }],
    })
    expect(source.paragraphs[0].runs[0].properties.color).toEqual(color)
  })
  it('applies selected-run size only, with paragraph metadata and other occurrence intact', () => {
    const initial = seed(), editor = mount(initial)
    act(() => editor.chain().setTextSelection({ from: 2, to: 3 }).setFontSize('30pt').run())
    const doc = normalizeTextDocument(edited())
    expect(doc.paragraphs[0].runs.map((r) => [r.text, r.properties.fontSizePt])).toEqual([[' ', 12], ['A', 30], ['\t', 12], ['中אב ', 24]])
    expect(doc.paragraphs[0].properties).toEqual(document().paragraphs[0].properties)
    expect(doc.body).toEqual(document().body)
    expect(current.presentation.pptxSemantic).toMatchObject({ definitions: initial.pptxSemantic.definitions, instances: { i2: initial.pptxSemantic.instances.i2 } })
    expect(current.presentation.slides[0].elements[0].content).toContain('40px')
    expect(current.presentation.slides[0].elements[0]).not.toHaveProperty('pptxTextDocument')
    expect(normalizePptxSemanticDocument(current.presentation.pptxSemantic)).toEqual(current.presentation.pptxSemantic)
    act(() => editor.chain().setLineHeight('18pt').setTextAlign('right').run())
    expect(edited().paragraphs[0].properties).toEqual({ ...document().paragraphs[0].properties, alignment: 'r', lineSpacing: { unit: 'points', value: 18 } })
    act(() => editor.commands.setLineHeight('1.15')); expect(edited().paragraphs[0].properties.lineSpacing).toEqual({ unit: 'percent', value: 115000 })
  })
  it('inserts with caret style and deletes with unique coherent structural IDs', () => {
    const editor = mount()
    act(() => editor.chain().setTextSelection(6).insertContent('字').run())
    expect(edited().paragraphs[0].runs[1]).toMatchObject({ text: '中א字ב ', properties: { fontSizePt: 24 } })
    act(() => editor.chain().setTextSelection({ from: 2, to: 6 }).deleteSelection().run())
    const doc = normalizeTextDocument(edited())
    expect(doc.paragraphs[0].runs.map((r) => r.text).join('')).toBe(' 字ב ')
    expect(doc.paragraphs[0].componentId).toBe('p1')
  })
  it('undo and redo restore canonical source and edited metadata', () => {
    const editor = mount()
    act(() => editor.chain().setTextSelection(6).insertContent('字').run())
    const changed = edited()
    act(() => editor.commands.undo())
    expect(edited()).toEqual(document())
    act(() => editor.commands.redo())
    expect(edited()).toEqual(changed)
  })
  it('rejects invalid native style atomically instead of replacing text', () => {
    const editor = mount(), before = current.presentation, beforeDocument = editor.state.doc
    act(() => editor.chain().setTextSelection({ from: 2, to: 3 }).setFontSize('calc(1px)').run())
    expect(current.presentation).toBe(before)
    expect(editor.state.doc).toBe(beforeDocument)
    expect(editor.state.doc.textContent).toBe(' A\t中אב ')
  })
  it('composition transaction preserves untouched run and paragraph semantics', () => {
    const editor = mount(); let composed
    const capture = ({ transaction }) => { if (transaction.getMeta('composition') === 1) composed = transaction.doc }
    editor.on('transaction', capture)
    act(() => editor.view.dispatch(editor.state.tr.insertText('語', 6).setMeta('composition', 1)))
    editor.off('transaction', capture)
    expect(editor.state.doc).toBe(composed)
    expect(edited().paragraphs[0].runs[0]).toEqual(document().paragraphs[0].runs[0])
    expect(edited().paragraphs[0].properties).toEqual(document().paragraphs[0].properties)
    expect(edited().paragraphs[0].runs[1].text).toBe('中א語ב ')
  })
  it('retains metadata through real HTML parse and structural paragraph split', () => {
    const editor = mount(), html = editor.getHTML()
    act(() => editor.commands.setContent(html, { parseOptions: { preserveWhitespace: 'full' } }))
    expect(edited() ?? document()).toEqual(document())
    act(() => editor.chain().setTextSelection(6).splitBlock().run())
    const doc = normalizeTextDocument(edited())
    expect(doc.paragraphs).toHaveLength(2)
    expect(doc.paragraphs[1].properties).toEqual(document().paragraphs[0].properties)
    expect(doc.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('')).toBe(' A\t中אב ')
  })
  it('document history restores canonical schema before further input', () => {
    const editor = mount()
    act(() => editor.chain().setTextSelection(6).insertContent('字').run())
    act(() => current.commitHistoryTransaction())
    act(() => current.handleUndo())
    expect(edited()).toBeUndefined()
    expect(editor.state.doc.textContent).toBe(' A\t中אב ')
    expect(editor.state.doc.firstChild.attrs.pptxParagraph.paragraph.componentId).toBe('p1')
    act(() => current.handleRedo())
    expect(edited().paragraphs[0].runs[1].text).toBe('中א字ב ')
    act(() => editor.chain().setTextSelection(6).insertContent('?').run())
    expect(edited().paragraphs[0].runs[1]).toMatchObject({ text: '中א?字ב ', properties: { fontSizePt: 24 } })
    act(() => current.commitHistoryTransaction())
    act(() => current.setPresentation((deck) => ({ ...deck, slides: [{ ...deck.slides[0], elements: deck.slides[0].elements.map((element) => ({ ...element, x: 10 })) }] })))
    act(() => current.commitHistoryTransaction())
    act(() => current.handleUndo())
    expect(editor.state.doc.firstChild.attrs.pptxParagraph.paragraph.componentId).toBe('p1')
  })
  it('preserves fields, breaks, native underline/color and untouched property precision', () => {
    const initial = seed(), doc = initial.pptxSemantic.definitions.def.content.textDocument
    doc.paragraphs[0].runs.splice(1, 0, { componentId: 'empty', kind: 'text', text: '', properties: { fontSizePt: 7, baseline: 4000 } })
    doc.paragraphs[0].runs.push({ componentId: 'br', kind: 'break', properties: { fontSizePt: 12.3456789 } },
      { componentId: 'field', kind: 'field', text: '7', field: { id: 'slide-num', type: 'slidenum' }, proofing: { smtClean: false }, properties: { underline: 'wavyDbl', color: { kind: 'srgb', value: 'Aa0000' }, baseline: 1200 } },
    )
    const editor = mount(initial); act(() => editor.chain().setTextSelection(2).insertContent('!').run())
    const result = normalizeTextDocument(edited())
    expect(result.paragraphs[0].runs.filter((run) => ['empty', 'br', 'field'].includes(run.componentId))).toEqual(doc.paragraphs[0].runs.filter((run) => ['empty', 'br', 'field'].includes(run.componentId)))
  })
  it('removes selected bold without changing its native size or adjacent run', () => {
    const editor = mount(); act(() => editor.chain().setTextSelection({ from: 4, to: 8 }).unsetBold().run())
    expect(edited().paragraphs[0].runs[0]).toEqual(document().paragraphs[0].runs[0])
    expect(edited().paragraphs[0].runs[1].properties).toEqual({ ...document().paragraphs[0].runs[1].properties, bold: false })
  })
  it('invalidates editor layout on used font and box changes, not unrelated fonts', () => {
    const initial = seed(), model = initial.pptxSemantic
    model.definitions.def.content.textDocument.paragraphs[0].runs[0].properties.fontLatin = { typeface: 'Aptos' }
    model.fonts = { aptos: { typeface: 'Aptos', assetHash: 'a'.repeat(64) }, other: { typeface: 'Unused', assetHash: 'b'.repeat(64) } }
    const editor = mount(initial); act(() => editor.chain().setTextSelection(6).insertContent('!').run())
    const before = editor.storage.semanticTextIdentity.layoutCache, beforeDocument = editor.state.doc
    act(() => current.setPresentation((deck) => ({ ...deck, pptxSemantic: { ...deck.pptxSemantic, fonts: { ...model.fonts, other: { ...model.fonts.other, assetHash: 'c'.repeat(64) } } } })))
    expect(editor.storage.semanticTextIdentity.layoutCache).toBe(before)
    act(() => current.setPresentation((deck) => ({ ...deck, pptxSemantic: { ...deck.pptxSemantic, fonts: { ...model.fonts, aptos: { ...model.fonts.aptos, assetHash: 'd'.repeat(64) } } } })))
    expect(editor.storage.semanticTextIdentity.layoutCache).not.toBe(before)
    const afterFont = editor.storage.semanticTextIdentity.layoutCache
    act(() => current.setPresentation((deck) => ({ ...deck, slides: [{ ...deck.slides[0], elements: deck.slides[0].elements.map((element) => ({ ...element, width: 200 })) }] })))
    expect(editor.storage.semanticTextIdentity.layoutCache).not.toBe(afterFont); expect(editor.state.doc).toBe(beforeDocument)
    act(() => editor.commands.undo())
    expect(edited()).toEqual(model.definitions.def.content.textDocument)
  })
  it.each([false, true])('inserts into an empty source document with native caret defaults (paragraph=%s)', (hasParagraph) => {
    const initial = seed(), doc = initial.pptxSemantic.definitions.def.content.textDocument
    doc.paragraphs = hasParagraph ? [{ componentId: 'empty-p', runs: [], defaultRunProperties: { fontSizePt: 24 }, endRunProperties: { fontSizePt: 12 } }] : []
    const editor = mount(initial); act(() => editor.commands.insertContent('X'))
    expect(normalizeTextDocument(edited()).paragraphs[0].runs[0].text).toBe('X')
    expect(edited().paragraphs[0].runs[0].properties.fontSizePt).toBe(hasParagraph ? 12 : undefined)
  })
  it('keeps legacy HTML editing operational', () => {
    const initial = seed()
    delete initial.pptxSemantic
    delete initial.slides[0].elements[0].pptxInstanceId
    initial.slides[0].elements[0].content = '<p>Legacy</p>'
    const editor = mount(initial)
    act(() => editor.chain().setTextSelection(7).insertContent('!').run())
    expect(current.presentation.slides[0].elements[0].content).toBe('<p>Legacy!</p>')
  })
})
