// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPresentation } from './field-fixtures.js'
import { useEditorRichTextController } from '../../client/src/hooks/editor-controller/use-editor-rich-text-controller.js'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller.js'
import { useSlideOperations } from '../../client/src/hooks/use-slide-operations.js'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller.js'
import { applySemanticGeometry } from '../../client/src/utils/pptx-semantic-geometry-bridge.js'
import { commitSemanticText, resolveSemanticText } from '../../client/src/utils/pptx-semantic-text-bridge.js'
import { materializeTextDocument } from '../../shared/src/pptx-text-materialization.js'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector.js')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline.js')
const { EditorContent } = createRequire(require.resolve('../../client/package.json'))('@tiptap/react')
const mapActive = (deck, fn) => ({ ...deck, slides: deck.slides.map((slide, i) => i === 0 ? fn(slide) : slide) })
let current
function Harness({ initial }) {
  const [presentation, setPresentation] = useState(initial)
  const [editingElementId, setEditingElementId] = useState(null)
  const activeSlide = presentation.slides[0]
  const activeSlideRef = useRef(activeSlide), currentSlideIndexRef = useRef(0)
  const editingElementIdRef = useRef(null)
  const element = activeSlide.elements.find((item) => item.pptxInstanceId.includes('#shape:2'))
  const selectedElementIdsRef = useRef([element.id])
  useLayoutEffect(() => { activeSlideRef.current = activeSlide }, [activeSlide])
  const operations = useSlideOperations({ presentation, setPresentation, currentSlideIndexRef, selectedElementIdsRef, editingElementIdRef })
  const elements = useEditorElementController({ presentation, setPresentation, mapActive,
    activeSlide, editingElementIdRef })
  const selection = useEditorSelectionController({ activeSlideRef, selectedElementIdsRef,
    updateElement: elements.updateElement, updateElements: operations.updateElements,
    notifyBlockedAction: () => { throw new Error('Unexpected blocked edit') } })
  const rich = useEditorRichTextController({ presentation, setPresentation, mapActive, activeSlideRef,
    currentSlideIndexRef, editingElementId, editingElementIdRef, setEditingElementId,
    setSelectedElementIds: () => {}, setActiveTab: () => {}, exitEditOnEscape: () => false,
    getElement: (slide, _fallback, id) => slide.elements.find((item) => item.id === id) })
  useLayoutEffect(() => { current = { presentation, setPresentation, element, ...selection, ...rich } },
    [presentation, setPresentation, element, selection, rich])
  return <EditorContent editor={rich.editor} />
}
afterEach(cleanup)
async function imported() {
  return (await projectSemanticImport({ zip: fieldFixture(), presentation: fieldPresentation() })).presentation
}
describe('native txBox canonical editing end to end', () => {
  it('edits real imported type=text through TipTap, materializes, saves and reopens without changing siblings or baseline', async () => {
    const initial = await imported(), before = structuredClone(initial)
    render(<Harness initial={initial} />)
    expect(current.element.type).toBe('text')
    const id = current.element.pptxInstanceId
    const source = resolveSemanticText(initial, current.element).document
    act(() => current.startEditingElement(current.element.id))
    act(() => current.editor.view.dispatch(current.editor.state.tr.insertText('Edited', 2)))
    const edited = resolveSemanticText(current.presentation, current.element).document
    expect(edited.paragraphs[0].runs[0].text).toContain('Edited')
    expect(edited.paragraphs[0].runs.slice(1)).toEqual(source.paragraphs[0].runs.slice(1))
    expect(materializeTextDocument(current.presentation.pptxSemantic, id)).toEqual(edited)
    const saved = JSON.parse(JSON.stringify(current.presentation))
    expect(() => assertSemanticBaseline(initial, saved)).not.toThrow()
    expect(saved.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    for (const [otherId, instance] of Object.entries(before.pptxSemantic.instances)) {
      if (otherId === id) continue
      expect(current.presentation.pptxSemantic.instances[otherId]).toEqual(instance)
      expect(saved.pptxSemantic.instances[otherId]).toEqual(JSON.parse(JSON.stringify(instance)))
    }
    act(() => current.setPresentation(before))
    act(() => current.setPresentation(saved))
    expect(current.editor.state.doc.textContent).toContain('Edited')
    const replacement = structuredClone(edited)
    replacement.paragraphs[0].runs[0].text = 'Selection edit '
    const selectionBefore = current.presentation.pptxSemantic
    act(() => current.updateSelectedElements({ semanticTextDocument: replacement, content: '<p>Selection edit</p>' }))
    expect(resolveSemanticText(current.presentation, current.element).document).toEqual(replacement)
    expect(materializeTextDocument(current.presentation.pptxSemantic, id)).toEqual(replacement)
    expect(current.presentation.pptxSemantic.definitions).toBe(selectionBefore.definitions)
    for (const [otherId, instance] of Object.entries(selectionBefore.instances))
      if (otherId !== id) expect(current.presentation.pptxSemantic.instances[otherId]).toBe(instance)
    expect(initial).toEqual(before)
  })
  it('rejects legacy text caches, malformed and foreign bodies atomically on native text occurrences', async () => {
    const initial = await imported()
    const element = initial.slides[0].elements.find((item) => item.pptxInstanceId.includes('#shape:2'))
    const source = resolveSemanticText(initial, element).document, before = structuredClone(initial)
    for (const patch of [{ textHtml: '<p>Overwrite</p>' }, { content: '<p>Overwrite</p>' },
      { semanticTextDocument: { ...source, componentId: 'foreign-body' } },
      { semanticTextDocument: { ...source, schemaVersion: 2 } }]) {
      expect(() => applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [{ id: element.id, ...patch }])).toThrow()
      expect(initial).toEqual(before)
    }
    expect(() => commitSemanticText(initial, element, { ...source, componentId: 'foreign-body' }, '', mapActive)).toThrow()
    expect(() => commitSemanticText(initial, element, { ...source, schemaVersion: 2 }, '', mapActive)).toThrow()
  })
  it('does not enter or publish TipTap edits when the native occurrence becomes readonly', async () => {
    const initial = structuredClone(await imported())
    const element = initial.slides[0].elements.find((item) => item.pptxInstanceId.includes('#shape:2'))
    initial.pptxSemantic.instances[element.pptxInstanceId].overrides.locked = true
    render(<Harness initial={initial} />)
    act(() => current.startEditingElement(element.id))
    expect(current.editingElementIdRef.current).toBeNull()
    act(() => current.setPresentation((deck) => {
      const next = structuredClone(deck)
      next.pptxSemantic.instances[element.pptxInstanceId].overrides.locked = false
      return next
    }))
    act(() => current.startEditingElement(element.id))
    expect(current.editor.isEditable).toBe(true)
    act(() => current.setPresentation((deck) => {
      const next = structuredClone(deck)
      next.pptxSemantic.instances[element.pptxInstanceId].overrides.locked = true
      return next
    }))
    expect(current.editor.isEditable).toBe(false)
    const before = current.presentation
    act(() => current.editor.view.dispatch(current.editor.state.tr.insertText('Forbidden', 2)))
    expect(current.presentation).toBe(before)
  })
  it.each(['locked', 'paintOnly', 'tombstone', 'wrongSlide'])('rejects direct and bridge commits for %s occurrences', async (guard) => {
    const initial = structuredClone(await imported())
    const element = initial.slides[0].elements.find((item) => item.pptxInstanceId.includes('#shape:2'))
    const instance = initial.pptxSemantic.instances[element.pptxInstanceId]
    const source = resolveSemanticText(initial, element).document
    const edited = structuredClone(source)
    edited.paragraphs[0].runs[0].text = 'Forbidden'
    if (guard === 'locked') instance.overrides.locked = true
    else if (guard === 'wrongSlide') instance.slideId = 'second'
    else instance.lineage = { ...instance.lineage, [guard]: true }
    const before = structuredClone(initial)
    expect(() => applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [{ id: element.id, semanticTextDocument: edited }])).toThrow()
    expect(() => commitSemanticText(initial, element, edited, '<p>Forbidden</p>', mapActive)).toThrow()
    expect(initial).toEqual(before)
  })
})
