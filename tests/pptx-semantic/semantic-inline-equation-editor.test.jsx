// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { createRequire } from 'node:module'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { semanticTextFromTipTap, semanticTextToTipTap } from '../../client/src/utils/pptx-semantic-text-bridge'
import { useEditorRichTextController } from '../../client/src/hooks/editor-controller/use-editor-rich-text-controller'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import { normalizePptxSemanticDocument } from '../../shared/src/pptx-semantic-document'
const { EditorContent } = createRequire(createRequire(import.meta.url).resolve('../../client/package.json'))('@tiptap/react')
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
const part = 'ppt/slides/slide1.xml'
const nativeId = (kind, path) => `${part}#${kind}:${path}`
const astNode = (componentId, type, children = [], text) => ({ componentId, namespaceUri: M,
  type, attributes: [], children, ...(text === undefined ? {} : { text }) })
const equation = () => ({ schemaVersion: 1, root: astNode(nativeId('math-component', '0.0.2.0.1'), 'oMath', [
  astNode(nativeId('math-component', '0.0.2.0.1.0'), 'r', [astNode(nativeId('math-component', '0.0.2.0.1.0.0'), 't', [], 'x')]),
]) })
const source = () => ({ schemaVersion: 1, componentId: 'body', paragraphs: [{ componentId: nativeId('paragraph', '0.0.2.0'),
  defaultRunProperties: { fontSizePt: 18 }, runs: [
    { componentId: 'before', kind: 'text', text: 'before ' },
    { componentId: nativeId('inline-equation', '0.0.2.0.1'), kind: 'equation', ommlDocument: equation(), properties: { fontSizePt: 24 } },
    { componentId: 'after', kind: 'text', text: ' after' },
  ] }] })
function astIds(node) { return [node.componentId, ...node.children.flatMap(astIds)] }
function bodyIds(document) { return [document.componentId, ...document.paragraphs.flatMap((paragraph) => [
  paragraph.componentId, ...paragraph.runs.flatMap((run) => [run.componentId,
    ...(run.ommlDocument ? astIds(run.ommlDocument.root) : [])]),
])] }
function seed() {
  const element = { id: 'text', type: 'text', x: 0, y: 0, width: 400, height: 200,
    textColor: '#123456', fontSize: 18, pptxInstanceId: 'instance', content: '<p>compatibility</p>' }
  return { slides: [{ id: 'slide', elements: [element] }], pptxSemantic: normalizePptxSemanticDocument({
    schemaVersion: 1, fonts: {}, styles: {}, definitions: { definition: { id: 'definition', kind: 'text',
      source: { partUri: 'ppt/slides/slide1.xml', nativeId: '2', preconditionHash: 'a'.repeat(64) },
      components: [
        { id: 'body', kind: 'property', locator: { path: [0, 0, 2], preconditionHash: 'a'.repeat(64) } },
        ...[[nativeId('paragraph', '0.0.2.0'), 'paragraph'],
          [nativeId('inline-equation', '0.0.2.0.1'), 'run'],
          ...astIds(equation().root).map((id) => [id, 'property'])]
          .map(([id, kind]) => ({ id, kind, locator: {
            path: id.split(':').at(-1).split('.').map(Number), preconditionHash: 'a'.repeat(64),
          } })),
      ],
      content: { textDocument: source() } } }, instances: { instance: { id: 'instance', slideId: 'slide',
      definitionId: 'definition', parentInstanceId: null, localTransform: [1, 0, 0, 1, 0, 0], paintIndex: 0, overrides: {} } },
  }) }
}
let current
function Harness() {
  const [presentation, setPresentation] = useState(seed), [editingElementId, setEditingElementId] = useState(null)
  const activeSlideRef = useRef(presentation.slides[0]), editingElementIdRef = useRef(null), currentSlideIndexRef = useRef(0)
  useLayoutEffect(() => { activeSlideRef.current = presentation.slides[0] }, [presentation])
  const rich = useEditorRichTextController({ presentation, setPresentation,
    mapActive: (deck, fn) => ({ ...deck, slides: [fn(deck.slides[0])] }),
    activeSlideRef, editingElementIdRef, currentSlideIndexRef, editingElementId, setEditingElementId,
    setSelectedElementIds: () => {}, setActiveTab: () => {}, exitEditOnEscape: () => false,
    getElement: (slide, _fallback, id) => slide.elements.find((element) => element.id === id),
  })
  useLayoutEffect(() => { current = { ...rich, presentation, setPresentation } }, [rich, presentation])
  const slide = presentation.slides[0]
  return <><EditorContent editor={rich.editor} /><PropertiesPanel slide={slide} selectedElement={slide.elements[0]}
    presentation={presentation} selectedElementIds={['text']} editor={rich.editor} editingElementId={editingElementId} /></>
}
function mount() {
  render(<Harness />)
  act(() => current.startEditingElement('text'))
  return current.editor
}
const edited = () => current.presentation.pptxSemantic.instances.instance.overrides.components?.body?.textDocument
const atomPosition = (editor) => {
  let position
  editor.state.doc.descendants((node, pos) => { if (node.type.name === 'semanticEquation') position = pos })
  return position
}
afterEach(cleanup)
describe('inline equation canonical editor bridge', () => {
  it('roundtrips text-equation-text as an atomic node with complete native metadata and no text field', () => {
    const document = source(), json = semanticTextToTipTap(document)
    expect(json.content[0].content.map((node) => node.type)).toEqual(['text', 'semanticEquation', 'text'])
    expect(json.content[0].content[1].attrs.pptxRun.run).toEqual(document.paragraphs[0].runs[1])
    expect(semanticTextFromTipTap(json)).toEqual(document)
    expect(semanticTextFromTipTap(json).paragraphs[0].runs[1]).not.toHaveProperty('text')
  })
  it('reseeds every duplicated AST ID without colliding with any retained text/body/AST identity', () => {
    const document = source()
    const reserved = `${equation().root.componentId}~1`
    document.paragraphs[0].runs.push({ componentId: reserved, kind: 'text', text: 'reserved' })
    const json = semanticTextToTipTap(document)
    const atom = json.content[0].content[1]
    json.content[0].content.splice(2, 0, structuredClone(atom), structuredClone(atom))
    const result = semanticTextFromTipTap(json), equations = result.paragraphs[0].runs.filter((run) => run.kind === 'equation')
    expect(equations).toHaveLength(3)
    expect(equations[0]).toEqual(document.paragraphs[0].runs[1])
    for (const copy of equations.slice(1)) {
      expect(astIds(copy.ommlDocument.root).every((id) => !astIds(equation().root).includes(id))).toBe(true)
      expect(copy).not.toHaveProperty('text')
    }
    expect(new Set(bodyIds(result)).size).toBe(bodyIds(result).length)
    expect(result.paragraphs[0].runs.at(-1).componentId).toBe(reserved)
  })
  it('reseeds all AST IDs on a new equation run identity, preserving token and source attributes', () => {
    const json = semanticTextToTipTap(source())
    json.content[0].content[1].attrs.pptxRun.run = { ...json.content[0].content[1].attrs.pptxRun.run, componentId: 'pasted-equation' }
    const run = semanticTextFromTipTap(json).paragraphs[0].runs[1]
    expect(run.componentId).toBe('pasted-equation')
    expect(astIds(run.ommlDocument.root).every((id) => !astIds(equation().root).includes(id))).toBe(true)
    expect(run.ommlDocument.root.children[0].children[0].text).toBe('x')
  })
  it('uses selected atom structure/token controls and real TipTap transactions for override undo/redo and reopen', async () => {
    const editor = mount()
    const atom = editor.state.doc.nodeAt(atomPosition(editor))
    expect(atom.isAtom && atom.isInline).toBe(true)
    expect(atom.attrs.pptxRun.run.ommlDocument).toEqual(equation())
    expect((await screen.findAllByRole('alert')).some((alert) => /font.*runtime/i.test(alert.textContent))).toBe(true)
    act(() => editor.commands.setNodeSelection(atomPosition(editor)))
    fireEvent.click(screen.getByRole('button', { name: `Select t ${nativeId('math-component', '0.0.2.0.1.0.0')}` }))
    fireEvent.change(screen.getByLabelText('Math run text'), { target: { value: 'alpha' } })
    expect(edited().paragraphs[0].runs[1].ommlDocument.root.children[0].children[0].text).toBe('alpha')
    expect(edited().paragraphs[0].runs[1]).not.toHaveProperty('text')
    expect(edited().paragraphs[0].runs.filter((run) => run.kind === 'text')).toEqual(source().paragraphs[0].runs.filter((run) => run.kind === 'text'))
    const saved = JSON.parse(JSON.stringify(current.presentation))
    expect(normalizePptxSemanticDocument(saved.pptxSemantic)).toEqual(saved.pptxSemantic)
    act(() => editor.commands.undo())
    expect(edited()).toEqual(source())
    act(() => editor.commands.redo())
    expect(edited().paragraphs[0].runs[1].ommlDocument.root.children[0].children[0].text).toBe('alpha')
    act(() => current.stopEditingElement())
    act(() => current.startEditingElement('text'))
    expect(editor.state.doc.nodeAt(atomPosition(editor)).attrs.pptxRun.run.ommlDocument.root.children[0].children[0].text).toBe('alpha')
  })
  it('pastes real equation HTML without flattening or retaining duplicate AST IDs', () => {
    const editor = mount(), html = editor.getHTML()
    expect(html).toContain('data-pptx-equation')
    act(() => editor.chain().setTextSelection(editor.state.doc.content.size - 1).insertContent(html).run())
    const result = edited(), equations = result.paragraphs.flatMap((paragraph) => paragraph.runs).filter((run) => run.kind === 'equation')
    expect(equations).toHaveLength(2)
    expect(new Set(bodyIds(result)).size).toBe(bodyIds(result).length)
    expect(astIds(equations[1].ommlDocument.root).every((id) => !astIds(equations[0].ommlDocument.root).includes(id))).toBe(true)
  })
  it('inserts a real fraction subtree through the selected atom without creating a family override', () => {
    const editor = mount()
    act(() => editor.commands.setNodeSelection(atomPosition(editor)))
    fireEvent.click(screen.getByRole('button', { name: 'Insert fraction', exact: true }))
    const document = edited(), run = document.paragraphs[0].runs[1]
    expect(run.ommlDocument.root.children.at(-1).type).toBe('f')
    expect(new Set(bodyIds(document)).size).toBe(bodyIds(document).length)
    expect(Object.keys(current.presentation.pptxSemantic.instances.instance.overrides.components)).toEqual(['body'])
    expect(current.presentation.pptxSemantic.instances.instance.overrides.components.body).not.toHaveProperty('ommlDocument')
    expect(editor.state.selection.node.type.name).toBe('semanticEquation')
    act(() => editor.commands.undo())
    expect(edited()).toEqual(source())
  })
  it('rejects equation metadata masquerading as editable text and invalid AST edits atomically', () => {
    const json = semanticTextToTipTap(source())
    json.content[0].content[1] = { type: 'text', text: 'flattened', marks: [{
      type: 'textStyle', attrs: { pptxRun: json.content[0].content[1].attrs.pptxRun },
    }] }
    expect(() => semanticTextFromTipTap(json)).toThrow(/atomic equation node/)
    const editor = mount()
    act(() => editor.commands.setNodeSelection(atomPosition(editor)))
    const before = editor.state.doc
    expect(() => editor.commands.updateSelectedSemanticEquation({ schemaVersion: 1, root: {} })).toThrow()
    expect(editor.state.doc).toBe(before)
    expect(edited()).toBeUndefined()
    act(() => current.setPresentation((deck) => ({ ...deck, slides: [{ ...deck.slides[0], locked: true }] })))
    expect(screen.getByRole('button', { name: 'Insert fraction', exact: true }).disabled).toBe(true)
  })
})
