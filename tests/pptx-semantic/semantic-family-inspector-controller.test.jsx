// @vitest-environment jsdom
import React, { useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import PropertiesPanel from '../../client/src/components/PropertiesPanel'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
import semantic from '../../shared/src/pptx-semantic-presentation'
import { familyDocumentsFixture } from './family-documents-fixture'

afterEach(cleanup)
const noop = () => {}
async function mount({ locked = false, multiple = false, sourceLocked = false } = {}) {
  const document = (await familyDocumentsFixture()).table
  document.instances.sibling = { ...document.instances.occurrence, id: 'sibling' }
  if (sourceLocked)
    Object.values(document.definitions)[0].content.frameProperties = { locks: { noSelect: true } }
  const table = Object.values(document.definitions)[0].content.tableDocument
  const initial = semantic.normalizeSemanticPresentation({
    pptxSemantic: document,
    slides: [
      {
        id: 's1',
        locked,
        elements: ['occurrence', 'sibling'].map((id) => ({
          id,
          type: 'table',
          pptxInstanceId: id,
          x: 0,
          y: 0,
          width: table.columns.reduce((sum, column) => sum + column.widthEmu, 0) / 9525,
          height: table.rows.reduce((sum, row) => sum + row.heightEmu, 0) / 9525,
          rotation: 0,
          opacity: 1,
          data: [],
        })),
      },
    ],
  })
  let current, history
  function Harness() {
    const [deck, setDeck] = useState(initial)
    const editingElementIdRef = useRef(null)
    const selectedElementIdsRef = useRef(multiple ? ['occurrence', 'sibling'] : ['occurrence'])
    const controller = useEditorElementController({
      presentation: deck,
      setPresentation: setDeck,
      activeSlide: deck.slides[0],
      editingElementIdRef,
      setEditingElementId: noop,
      setSelectedElementIds: noop,
      mapActive: (previous, apply) => ({
        ...previous,
        slides: previous.slides.map((slide, index) => (index === 0 ? apply(slide) : slide)),
      }),
    })
    const snapshots = useEditorHistoryController({
      presentation: deck,
      setPresentation: setDeck,
      setCurrentSlideIndex: noop,
      setVerticalEdit: noop,
      currentSlideIndexRef: useRef(0),
      verticalEditRef: useRef(null),
      selectedElementIdsRef,
      editingElementIdRef,
      setSelectedElementIds: noop,
      setEditingElementId: noop,
      resetContent: noop,
    })
    useLayoutEffect(() => {
      current = deck
      history = {
        ...snapshots,
        seed: () => {
          snapshots.seedHistory(deck)
          setDeck({ ...deck })
        },
      }
    }, [deck, snapshots])
    return (
      <PropertiesPanel
        slide={deck.slides[0]}
        selectedElement={deck.slides[0].elements[0]}
        selectedElementIds={selectedElementIdsRef.current}
        presentation={deck}
        onUpdateElement={controller.updateElement}
      />
    )
  }
  render(<Harness />)
  return { initial, current: () => current, history: () => history }
}

describe('native family inspector through actual editor controllers', () => {
  it('edits a rich table run with source/sibling preservation and actual Undo/Redo', async () => {
    const state = await mount()
    act(() => state.history().seed())
    const input = screen.getByLabelText('Cell 1,1 paragraph 1 run 1')
    expect(input.disabled).toBe(false)
    const beforeText = input.value
    fireEvent.change(input, { target: { value: 'Typed journal edit' } })
    const changed = state.current()
    expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').value).toBe('Typed journal edit')
    expect(changed.pptxSemantic.definitions).toEqual(state.initial.pptxSemantic.definitions)
    expect(changed.pptxSemantic.instances.sibling).toEqual(
      state.initial.pptxSemantic.instances.sibling
    )
    expect(changed.slides[0].elements[1]).toEqual(state.initial.slides[0].elements[1])
    act(() => state.history().handleUndo())
    expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').value).toBe(beforeText)
    act(() => state.history().handleRedo())
    expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').value).toBe('Typed journal edit')
  })

  it.each([{ locked: true }, { multiple: true }, { sourceLocked: true }])(
    'blocks guarded selection %j',
    async (options) => {
      const state = await mount(options)
      expect(screen.getByLabelText('Cell 1,1 paragraph 1 run 1').disabled).toBe(true)
      expect(state.current()).toEqual(state.initial)
    }
  )
})
