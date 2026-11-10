// @vitest-environment jsdom
import React, { useRef, useState } from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ShapeProperties from '../../client/src/components/properties/shape-properties.jsx'
import { useSlideOperations } from '../../client/src/hooks/use-slide-operations.js'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller.js'
import {
  applySemanticGeometry,
  withoutSemanticGeometry,
} from '../../client/src/utils/pptx-semantic-geometry-bridge.js'
import { resolveSemanticText } from '../../client/src/utils/pptx-semantic-text-bridge.js'
import semantic from '../../shared/src/pptx-semantic-document.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

const label = (componentId) => ({
  schemaVersion: 1,
  componentId,
  body: { autofit: { mode: 'none' }, insetLeftEmu: 1234 },
  paragraphs: [
    {
      componentId: `${componentId}-paragraph`,
      properties: { alignment: 'r', spaceAfter: { unit: 'points', value: 3.5 } },
      endRunProperties: { fontSizePt: 7 },
      runs: [
        {
          componentId: `${componentId}-run1`,
          kind: 'text',
          text: 'Source ',
          properties: { fontSizePt: 12, fontLatin: { typeface: 'Arial' }, kerningPt: 2 },
        },
        {
          componentId: `${componentId}-run2`,
          kind: 'text',
          text: 'Label',
          properties: { fontSizePt: 24, bold: true, language: 'en-US' },
        },
      ],
    },
  ],
})
function fixture(version = 1) {
  const deck = geometryProjectionFixture()
  if (version === 2) deck.pptxSemantic = inheritedGeometryStyleFixture()
  for (const instance of Object.values(deck.pptxSemantic.instances)) {
    const definition = deck.pptxSemantic.definitions[instance.definitionId]
    if (!definition.content.textDocument) {
      const componentId = `${definition.id}-body`
      definition.components.push({
        id: componentId,
        kind: 'property',
        locator: { path: [0, 0, 2], preconditionHash: definition.source.preconditionHash },
      })
      definition.content.textDocument = label(componentId)
    }
  }
  for (const slide of deck.slides)
    for (const element of slide.elements)
      Object.assign(element, {
        textHtml: '<p>Wrong cache</p>',
        text: 'Wrong cache',
      })
  deck.pptxSemantic = semantic.normalizePptxSemanticDocument(deck.pptxSemantic)
  return deck
}
let current
function mount(initial) {
  function Harness() {
    const [deck, setDeck] = useState(initial)
    const ids = useRef(['i1'])
    const operations = useSlideOperations({
      presentation: deck,
      setPresentation: setDeck,
      currentSlideIndexRef: useRef(0),
      selectedElementIdsRef: ids,
      editingElementIdRef: useRef(null),
    })
    const selection = useEditorSelectionController({
      selectedElementIdsRef: ids,
      activeSlideRef: { current: deck.slides[0] },
      updateElement: (id, patch) => operations.updateElements([{ id, ...patch }]),
      updateElements: operations.updateElements,
      notifyBlockedAction: () => {
        throw new Error('Unexpected blocked label edit')
      },
    })
    current = { deck, setDeck }
    return (
      <ShapeProperties
        element={deck.slides[0].elements[0]}
        elements={deck.slides[0].elements}
        selectedElementIds={ids.current}
        pptxSemantic={deck.pptxSemantic}
        onUpdate={selection.updateSelectedElements}
      />
    )
  }
  render(<Harness />)
  const editor = screen.getByRole('textbox', { name: 'Shape rich label' }).editor
  expect(editor?.isDestroyed).toBe(false)
  return editor
}
afterEach(cleanup)
describe('source-bound path label editing', () => {
  it.each([1, 2])(
    'edits own canonical body independently of geometry and other occurrences (schema %s)',
    (version) => {
      const initial = fixture(version),
        before = structuredClone(initial)
      const editor = mount(initial)
      expect(editor.state.doc.textContent).toBe('Source Label')
      expect(current.deck).toEqual(before)
      act(() => editor.view.dispatch(editor.state.tr.insertText('Revised', 1, 7)))
      const model = current.deck.pptxSemantic
      const source = model.definitions[model.instances.i1.definitionId].content.textDocument
      const override = model.instances.i1.overrides.components[source.componentId].textDocument
      expect(override.paragraphs[0].runs[0]).toEqual({
        ...source.paragraphs[0].runs[0],
        text: 'Revised ',
      })
      expect(override.paragraphs[0].runs[1]).toEqual(source.paragraphs[0].runs[1])
      expect(override.body).toEqual(source.body)
      expect(override.paragraphs[0].properties).toEqual(source.paragraphs[0].properties)
      expect(model.definitions).toEqual(before.pptxSemantic.definitions)
      expect(model.styles).toEqual(before.pptxSemantic.styles)
      expect(model.instances.i2).toEqual(before.pptxSemantic.instances.i2)
      expect(Object.keys(model.instances.i1.overrides.components)).toEqual([source.componentId])
      const element = current.deck.slides[0].elements[0]
      expect(element.text).toBe('Revised Label')
      expect(element.textHtml).toContain('Revised')
      expect(element).not.toHaveProperty('semanticTextDocument')
      expect(element).not.toHaveProperty('pptxTextDocument')
      const saved = JSON.parse(JSON.stringify(current.deck))
      expect(semantic.normalizePptxSemanticDocument(saved.pptxSemantic)).toEqual(model)
      expect(resolveSemanticText(saved, saved.slides[0].elements[0]).document).toEqual(override)
      act(() => current.setDeck(before))
      expect(editor.state.doc.textContent).toBe('Source Label')
      act(() => current.setDeck(saved))
      expect(editor.state.doc.textContent).toBe('Revised Label')
    }
  )
  it.each([1, 2])(
    'rejects legacy cache-only edits and foreign bodies atomically (schema %s)',
    (version) => {
      const deck = fixture(version),
        model = deck.pptxSemantic,
        before = structuredClone(model)
      const source = model.definitions[model.instances.i1.definitionId].content.textDocument
      for (const patch of [
        { textHtml: '<p>Cache only</p>', text: 'Cache only' },
        { semanticTextDocument: { ...label('foreign-body') }, textHtml: '<p>Foreign</p>' },
        { semanticTextDocument: { ...source, schemaVersion: 2 }, textHtml: '<p>Invalid</p>' },
      ]) {
        expect(() =>
          applySemanticGeometry(model, deck.slides[0], [{ id: 'i1', ...patch }])
        ).toThrow()
        expect(model).toEqual(before)
      }
      expect(
        withoutSemanticGeometry(deck.slides[0].elements[0], {
          semanticTextDocument: source,
          textHtml: '<p>Label</p>',
          text: 'Label',
        })
      ).toEqual({ textHtml: '<p>Label</p>', text: 'Label' })
    }
  )
  it('keeps native label source values rather than compatibility size/color controls', () => {
    mount(fixture(2))
    expect(screen.queryByLabelText('Shape label text size')).toBeNull()
    expect(screen.queryByLabelText('Shape label text color')).toBeNull()
  })
  it('retains native styles and identity on composition and selected-run formatting', () => {
    const initial = fixture(2),
      editor = mount(initial)
    act(() => editor.view.dispatch(editor.state.tr.insertText('語', 3).setMeta('composition', 1)))
    const componentId = initial.pptxSemantic.definitions.local1.content.textDocument.componentId
    const composed =
      current.deck.pptxSemantic.instances.i1.overrides.components[componentId].textDocument
    expect(composed.paragraphs[0].runs[0].text).toBe('So語urce ')
    expect(composed.paragraphs[0].runs[1]).toEqual(
      initial.pptxSemantic.definitions.local1.content.textDocument.paragraphs[0].runs[1]
    )
    act(() => editor.chain().setTextSelection({ from: 1, to: 3 }).setFontSize('6pt').run())
    const edited =
      current.deck.pptxSemantic.instances.i1.overrides.components[componentId].textDocument
    expect(edited.paragraphs[0].runs[0]).toMatchObject({
      text: 'So',
      properties: { fontSizePt: 6 },
    })
    expect(current.deck.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
    expect(current.deck.pptxSemantic.instances.i2).toEqual(initial.pptxSemantic.instances.i2)
    const before = current.deck
    act(() => editor.chain().setTextSelection({ from: 1, to: 3 }).setFontSize('calc(1px)').run())
    expect(current.deck).toBe(before)
  })
  it('inserts and reloads an empty native label using its genuine end-run size', () => {
    const initial = structuredClone(fixture(2))
    const source = initial.pptxSemantic.definitions.local1.content.textDocument
    source.paragraphs[0].runs = []
    initial.slides[0].elements[0].textHtml = ''
    initial.slides[0].elements[0].text = ''
    const editor = mount(initial)
    expect(editor.state.doc.textContent).toBe('')
    act(() => editor.commands.insertContent('X'))
    const edited =
      current.deck.pptxSemantic.instances.i1.overrides.components[source.componentId].textDocument
    expect(edited.paragraphs[0].runs[0]).toMatchObject({
      text: 'X',
      properties: { fontSizePt: 7 },
    })
    const saved = JSON.parse(JSON.stringify(current.deck))
    act(() => current.setDeck(initial))
    expect(editor.state.doc.textContent).toBe('')
    act(() => current.setDeck(saved))
    expect(editor.state.doc.textContent).toBe('X')
  })
  it.each(['locked', 'tombstone', 'paintOnly'])(
    'blocks canonical native label writes for an inactive or readonly occurrence (%s)',
    (guard) => {
      const initial = structuredClone(fixture(2))
      const instance = initial.pptxSemantic.instances.i1
      if (guard === 'locked') instance.overrides.locked = true
      else instance.lineage = { [guard]: true }
      const editor = mount(initial)
      expect(
        screen.getByRole('textbox', { name: 'Shape rich label' }).getAttribute('aria-readonly')
      ).toBe('true')
      const before = current.deck
      act(() => editor.view.dispatch(editor.state.tr.insertText('Forbidden', 1)))
      expect(current.deck).toBe(before)
      const source = initial.pptxSemantic.definitions.local1.content.textDocument
      expect(() =>
        applySemanticGeometry(initial.pptxSemantic, initial.slides[0], [
          {
            id: 'i1',
            semanticTextDocument: source,
            textHtml: '<p>Forbidden</p>',
            text: 'Forbidden',
          },
        ])
      ).toThrow()
    }
  )
})
