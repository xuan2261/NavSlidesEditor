import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useClipboard } from './use-clipboard'
import { usePresentationState } from './use-presentation-state'
import { useEditorStore } from '../stores/editor-store'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import styles from 'revealjs-shared/src/pptx-geometry-style-resolution.js'
import { geometryGroupFillFixture } from '../../../tests/pptx-semantic/geometry-group-fill-fixture.js'
import { semanticInstance, semanticInstances, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
beforeEach(() => {
  let sequence = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `semantic-copy-${++sequence}`)
  useEditorStore.setState({ selectedElementIds: ['g1'], clipboard: null, pasteCount: 0 })
})
function mount() {
  const initial = semantic.normalizeSemanticPresentation({
    ...geometryGroupFillFixture(),
    id: 'semantic-clipboard-deck',
  })
  const before = structuredClone(initial)
  const { result } = renderHook(() => {
    const [deck, setPresentation, commitPresentationTransaction] = usePresentationState(initial)
    const clipboard = useClipboard({
      getPresentation: () => deck,
      getActiveSlide: () => deck.slides[0],
      getDestinationElements: () => deck.slides.flatMap((slide) => slide.elements),
      getScopeId: () => JSON.stringify([deck.id, deck.slides[0].id]),
      setPresentation,
      commitPresentationTransaction,
      mapActiveSlide: (previous, update) => ({
        ...previous,
        slides: previous.slides.map((slide, index) => (index === 0 ? update(slide) : slide)),
      }),
    })
    return { deck, ...clipboard }
  })
  return { result, before, current: () => result.current.deck }
}
describe('semantic group clipboard through the actual hook', () => {
  it('duplicates the source subtree without changing an existing clipboard or cascade count', () => {
    const harness = mount()
    const previousClipboard = [{ type: 'text', content: 'Previous copy' }]
    useEditorStore.setState({ clipboard: previousClipboard, pasteCount: 3 })
    act(() => harness.result.current.performDuplicate())
    expect(Array.from(semanticInstances(harness.current().pptxSemantic))).toHaveLength(6)
    expect(harness.current().slides[0].elements).toHaveLength(2)
    expect(useEditorStore.getState().selectedElementIds).toHaveLength(1)
    expect(useEditorStore.getState().selectedElementIds[0]).not.toBe('g1')
    expect(useEditorStore.getState().clipboard).toBe(previousClipboard)
    expect(useEditorStore.getState().pasteCount).toBe(3)
  })
  it('copies a source group without a fake leaf and pastes its linked descendants atomically', () => {
    const harness = mount()
    act(() => harness.result.current.performCopy(harness.current().slides[0].elements))
    const clipboard = useEditorStore.getState().clipboard
    expect(clipboard?.kind).toBe('pptx-semantic-selection')
    expect(clipboard.rootInstanceIds).toEqual(['g1'])
    expect(harness.current()).toEqual(harness.before)
    act(() => harness.result.current.performPaste(clipboard))
    const next = harness.current()
    const copiedGroupId = useEditorStore.getState().selectedElementIds[0]
    const group = semanticInstance(next.pptxSemantic, copiedGroupId)
    expect(group.definitionId).toBe('group')
    expect(group.id).not.toBe('g1')
    const copiedLeaf = Array.from(semanticInstances(next.pptxSemantic), ([, instance]) => instance).find(
      (instance) => instance.parentInstanceId === group.id
    )
    expect(
      styles.materializeGeometry(next.pptxSemantic, copiedLeaf.id).style.fill.color.value
    ).toBe('FF0000')
    expect(
      next.slides[0].elements.some((element) => element.pptxInstanceId === copiedLeaf.id)
    ).toBe(true)
    expect(next.slides[0].elements.some((element) => element.pptxInstanceId === group.id)).toBe(
      false
    )
    expect(next.pptxSemantic.styles).toEqual(harness.before.pptxSemantic.styles)
    expect(next.pptxSemantic.definitions).toEqual(harness.before.pptxSemantic.definitions)
    expect(useEditorStore.getState().pasteCount).toBe(1)
    expect(useEditorStore.getState().clipboard).toBe(clipboard)
  })
  it('cuts the complete semantic subtree while retaining a bounded source snapshot for paste', () => {
    const harness = mount()
    act(() => harness.result.current.performCut(harness.current().slides[0].elements, ['g1']))
    expect(useEditorStore.getState().clipboard?.kind).toBe('pptx-semantic-selection')
    const model = harness.current().pptxSemantic
    expect(semanticInstance(model, 'g1').lineage).toMatchObject({ tombstone: true, deleted: true })
    expect(semanticInstance(model, 'i1').lineage).toMatchObject({ tombstone: true, deleted: true })
    expect(harness.current().slides[0].elements).toEqual([])
    expect(model.styles).toEqual(harness.before.pptxSemantic.styles)
    expect(model.definitions).toEqual(harness.before.pptxSemantic.definitions)
    expect(semanticInstance(model, 'g2')).toEqual(semanticInstance(harness.before.pptxSemantic, 'g2'))
    expect(useEditorStore.getState().selectedElementIds).toEqual([])
    act(() => harness.result.current.performPaste(useEditorStore.getState().clipboard))
    expect(harness.current().slides[0].elements).toHaveLength(1)
    expect(semanticInstance(harness.current().pptxSemantic, 'g1').lineage.tombstone).toBe(true)
  })
  it('does not mutate the clipboard or document when cutting a locked semantic descendant', () => {
    const harness = mount()
    const currentI1 = semanticInstance(harness.current().pptxSemantic, 'i1')
    harness.current().pptxSemantic = replaceSemanticRecords(harness.current().pptxSemantic, {
      instances: {
        i1: {
          ...currentI1,
          overrides: { ...currentI1.overrides, locked: true },
        },
      },
    })
    const before = structuredClone(harness.current())
    expect(() =>
      act(() => harness.result.current.performCut(harness.current().slides[0].elements, ['g1']))
    ).toThrow()
    expect(harness.current()).toEqual(before)
    expect(useEditorStore.getState().clipboard).toBeNull()
  })
})
