// @vitest-environment jsdom
// Actual controller/history contract, not real browser or dashboard qualification.
import React, { useLayoutEffect, useRef, useState } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorElementController } from '../../client/src/hooks/editor-controller/use-editor-element-controller'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
import { useEditorSelectionController } from '../../client/src/hooks/editor-controller/use-editor-selection-controller'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
afterEach(cleanup)
const edit = (instanceId = 'g1') => ({
  pptxProjectionOperation: {
    type: 'group.fill.edit',
    instanceId,
    componentId: 'group:group-properties',
    command: { type: 'fill-paint', color: { kind: 'srgb', value: 'ABCDEF' } },
  },
})
function mount(selectedIds = ['i1']) {
  const initial = semantic.normalizeSemanticPresentation(geometryGroupFillFixture())
  let current, controller, history, update, selection
  function Harness() {
    const [deck, setDeck] = useState(initial)
    const editingElementIdRef = useRef(null)
    const selectedElementIdsRef = useRef(selectedIds)
    const activeSlideRef = useRef(deck.slides[0])
    activeSlideRef.current = deck.slides[0]
    const commands = useEditorElementController({
      presentation: deck,
      setPresentation: setDeck,
      activeSlide: deck.slides[0],
      editingElementIdRef,
      setEditingElementId: vi.fn(),
      setSelectedElementIds: vi.fn(),
      mapActive: (previous, fn) => ({
        ...previous,
        slides: previous.slides.map((slide, index) => (index === 0 ? fn(slide) : slide)),
      }),
    })
    const selected = useEditorSelectionController({
      presentation: deck,
      activeSlideRef,
      editingElementIdRef,
      selectedElementIdsRef,
      updateElement: commands.updateElement,
      notifyBlockedAction: vi.fn(),
    })
    const snapshots = useEditorHistoryController({
      presentation: deck,
      setPresentation: setDeck,
      setCurrentSlideIndex: vi.fn(),
      setVerticalEdit: vi.fn(),
      currentSlideIndexRef: useRef(0),
      verticalEditRef: useRef(null),
      selectedElementIdsRef,
      editingElementIdRef,
      setSelectedElementIds: vi.fn(),
      setEditingElementId: vi.fn(),
      resetContent: vi.fn(),
    })
    useLayoutEffect(() => {
      current = deck
      controller = commands
      selection = selected
      update = setDeck
      history = {
        ...snapshots,
        seed: () => {
          snapshots.seedHistory(deck)
          setDeck({ ...deck })
        },
      }
    }, [deck, commands, snapshots, selected])
    return null
  }
  render(<Harness />)
  return {
    initial,
    current: () => current,
    controller: () => controller,
    selection: () => selection,
    history: () => history,
    update: (...args) => update(...args),
  }
}
describe('explicit group fill from an active inheriting leaf', () => {
  it.each([
    { type: 'fill-paint', color: { kind: 'srgb', value: 'ABCDEF' } },
    {
      type: 'fill-pattern',
      pattern: {
        preset: 'diagCross',
        foreground: {
          kind: 'srgb',
          value: '445566',
          transforms: [{ kind: 'alpha', value: 50000 }],
        },
        background: { kind: 'preset', value: 'cornflowerBlue' },
      },
    },
  ])(
    'routes an inline owner $type through the actual selection controller and history',
    (command) => {
      const harness = mount()
      const updates = edit()
      updates.pptxProjectionOperation.command = command
      act(() => harness.history().seed())
      act(() => harness.selection().updateSelectedElements(updates))
      const changed = harness.current()
      expect(styles.materializeGeometry(changed.pptxSemantic, 'i1').style.fill).toEqual(
        command.pattern ? { pattern: command.pattern } : { color: command.color }
      )
      expect(changed.pptxSemantic.instances.i1).toEqual(harness.initial.pptxSemantic.instances.i1)
      expect(changed.pptxSemantic.instances.g2).toEqual(harness.initial.pptxSemantic.instances.g2)
      expect(changed.pptxSemantic.definitions).toEqual(harness.initial.pptxSemantic.definitions)
      expect(changed.pptxSemantic.styles).toEqual(harness.initial.pptxSemantic.styles)
      act(() => harness.history().handleUndo())
      expect(harness.current().pptxSemantic).toEqual(harness.initial.pptxSemantic)
      act(() => harness.history().handleRedo())
      expect(harness.current().pptxSemantic).toEqual(changed.pptxSemantic)
    }
  )
  it.each(['foreign-owner', 'foreign-component', 'multiple-selection'])(
    'rejects inline owner delegation with %s without edits',
    (mismatch) => {
      const harness = mount(mismatch === 'multiple-selection' ? ['i1', 'i2'] : ['i1'])
      const updates = edit(mismatch === 'foreign-owner' ? 'g2' : 'g1')
      if (mismatch === 'foreign-component')
        updates.pptxProjectionOperation.componentId = 'group:foreign-component'
      expect(() => act(() => harness.selection().updateSelectedElements(updates))).toThrow()
      expect(harness.current()).toEqual(harness.initial)
    }
  )
  it('rechecks inline owner authority after a queued leaf detach', () => {
    const harness = mount()
    const selected = harness.selection()
    act(() => {
      harness.update((previous) => {
        const detached = structuredClone(previous)
        detached.pptxSemantic.instances.i1.parentInstanceId = null
        detached.pptxSemantic.instances.i1.overrides = {
          components: {
            geometry: {
              geometryStyle: { fill: { color: { kind: 'srgb', value: '112233' } } },
            },
          },
        }
        return semantic.normalizeSemanticPresentation(detached)
      })
      selected.updateSelectedElements(edit())
    })
    expect(harness.current().pptxSemantic.instances.g1.overrides).toEqual({})
    expect(
      styles.materializeGeometry(harness.current().pptxSemantic, 'i1').style.fill.color.value
    ).toBe('112233')
  })
  it('uses actual editor history for only the explicitly identified owner occurrence', () => {
    const harness = mount()
    act(() => harness.history().seed())
    act(() => harness.controller().updateElement('i1', edit()))
    const changed = harness.current()
    expect(styles.materializeGeometry(changed.pptxSemantic, 'i1').style.fill.color.value).toBe(
      'ABCDEF'
    )
    expect(changed.pptxSemantic.instances.i1).toEqual(harness.initial.pptxSemantic.instances.i1)
    expect(changed.pptxSemantic.instances.g2).toEqual(harness.initial.pptxSemantic.instances.g2)
    expect(changed.pptxSemantic.styles).toEqual(harness.initial.pptxSemantic.styles)
    expect(changed.pptxSemantic.definitions).toEqual(harness.initial.pptxSemantic.definitions)
    act(() => harness.history().handleUndo())
    expect(harness.current().pptxSemantic).toEqual(harness.initial.pptxSemantic)
    act(() => harness.history().handleRedo())
    expect(harness.current().pptxSemantic).toEqual(changed.pptxSemantic)
  })
  it('rejects a different owner on another slide without edits', () => {
    const harness = mount()
    expect(() => act(() => harness.controller().updateElement('i1', edit('g2')))).toThrow()
    expect(harness.current()).toEqual(harness.initial)
  })
  it('rechecks owner scope after a queued leaf detachment', () => {
    const harness = mount()
    const commands = harness.controller()
    act(() => {
      harness.update((previous) => {
        const detached = structuredClone(previous)
        detached.pptxSemantic.instances.i1.parentInstanceId = null
        detached.pptxSemantic.instances.i1.overrides = {
          components: {
            geometry: {
              geometryStyle: { fill: { color: { kind: 'srgb', value: '112233' } } },
            },
          },
        }
        return semantic.normalizeSemanticPresentation(detached)
      })
      commands.updateElement('i1', edit())
    })
    expect(harness.current().pptxSemantic.instances.g1.overrides).toEqual({})
    expect(
      styles.materializeGeometry(harness.current().pptxSemantic, 'i1').style.fill.color.value
    ).toBe('112233')
  })
})
