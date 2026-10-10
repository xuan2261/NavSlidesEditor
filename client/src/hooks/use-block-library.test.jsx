import { useCallback } from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createInteractionSlideState,
  executeInteractionAction,
  getEducationPreset,
  resolveEffectiveSlide,
} from 'revealjs-shared'
import { useBlockLibrary } from './use-block-library'
import { useElementCreation } from './use-element-creation'
import {
  authoringSeed,
  useAuthoringSafetyHarness,
} from './editor-controller/editor-authoring-safety-harness'
import { useEditorStore } from '../stores/editor-store'
import ActionControls from '../components/properties/action-controls'

const bundle = {
  id: 'lesson-bundle',
  elements: [
    {
      id: 'source',
      type: 'shape',
      groupId: 'group',
      action: { kind: 'toggle', targetElementId: 'target' },
    },
    { id: 'target', type: 'text', groupId: 'group', content: '<p>Answer</p>' },
  ],
}

function useLibraryHarness(seed) {
  const authoring = useAuthoringSafetyHarness(seed)
  const getActiveSlide = () =>
    authoring.masterEdit
      ? { id: `master:${authoring.masterEdit.id}`, elements: authoring.masterEdit.fixedElements }
      : authoring.verticalEdit
        ? authoring.presentation.slides[0].children[authoring.verticalEdit.child]
        : authoring.presentation.slides[0]
  const { appendElements } = useElementCreation({
    getActiveSlide,
    mapActiveSlide: authoring.mapAuthoringTarget,
    setPresentation: authoring.setPresentation,
    setSelectedElementIds: useEditorStore.getState().setSelectedElementIds,
  })
  const getDestinationElements = useCallback(
    () =>
      resolveEffectiveSlide(getActiveSlide(), authoring.presentation.layoutMasters).slide.elements,
    [authoring.presentation, authoring.masterEdit, authoring.verticalEdit]
  )
  const library = useBlockLibrary({
    getActiveSlide,
    getDestinationElements,
    appendElements,
    commitHistoryTransaction: authoring.commitHistoryTransaction,
  })
  return { ...authoring, ...library }
}

afterEach(() => useEditorStore.getState().setSelectedElementIds([]))

describe('Library authoring integration', () => {
  it.each(['parent', 'vertical', 'master'])(
    'inserts an entire editable bundle into the %s target with atomic undo and redo',
    (target) => {
      const seed = authoringSeed()
      const { result } = renderHook(() => useLibraryHarness(seed))
      if (target === 'vertical')
        act(() => result.current.setVerticalEdit({ parentId: 'parent', child: 0 }))
      if (target === 'master') {
        act(() => result.current.openLayoutManager())
        act(() => result.current.layoutManagerProps.onEditMaster('master'))
      }
      const elements = () =>
        target === 'master'
          ? result.current.presentation.layoutMasters[0].fixedElements
          : target === 'vertical'
            ? result.current.presentation.slides[0].children[0].elements
            : result.current.presentation.slides[0].elements
      const original = elements()
      let inserted
      act(() => {
        inserted = result.current.insertPreset(bundle)
      })
      const [source, answer] = inserted.elements
      expect(elements()).toEqual([...original, source, answer])
      expect(source.action.targetElementId).toBe(answer.id)
      expect(source.groupId).toBe(answer.groupId)
      expect(source.groupId).not.toBe('group')
      expect(result.current.selectedIds).toEqual([source.id, answer.id])
      if (target !== 'parent')
        expect(result.current.presentation.slides[0].elements).toEqual(seed.slides[0].elements)
      expect(result.current.presentation.slides[0].children[1]).toEqual(seed.slides[0].children[1])
      expect(result.current.presentation.layoutMasters[1]).toEqual(seed.layoutMasters[1])
      act(() => result.current.handleUndo())
      expect(elements()).toEqual(original)
      expect(result.current.selectedIds).toEqual([])
      act(() => result.current.handleRedo())
      expect(elements()).toEqual([...original, source, answer])
    }
  )

  it('keeps two rapid inserts in separate undo steps and subsequent edits independent', () => {
    const seed = authoringSeed()
    const { result } = renderHook(() => useLibraryHarness(seed))
    const originalQuestion = structuredClone(
      getEducationPreset('education-quiz').elements[0].quiz.questions[0]
    )
    let first, second
    act(() => {
      first = result.current.insertPreset('education-quiz')
    })
    act(() => {
      second = result.current.insertPreset('education-quiz')
    })
    expect(first.elements[0].id).not.toBe(second.elements[0].id)
    expect(first.elements[0].quiz.questions[0].id).not.toBe(second.elements[0].quiz.questions[0].id)
    act(() => result.current.handleUndo())
    expect(result.current.presentation.slides[0].elements).toEqual([
      ...seed.slides[0].elements,
      ...first.elements,
    ])
    act(() => result.current.handleRedo())
    const editedConfig = structuredClone(first.elements[0].quiz)
    editedConfig.questions[0].prompt = 'Teacher edit'
    act(() => result.current.updateElements([{ id: first.elements[0].id, quiz: editedConfig }]))
    const games = result.current.presentation.slides[0].elements.filter(
      (element) => element.type === 'game'
    )
    expect(games[0].quiz.questions[0].prompt).toBe('Teacher edit')
    expect(games[1].quiz.questions[0].prompt).toBe(originalQuestion.prompt)
    expect(getEducationPreset('education-quiz').elements[0].quiz.questions[0]).toEqual(
      originalQuestion
    )
  })

  it('requires explicit author repair before an external library action can use an effective fixed target', () => {
    const seed = authoringSeed()
    seed.slides[0].layoutId = 'master'
    const { result } = renderHook(() => useLibraryHarness(seed))
    const preset = {
      elements: [
        {
          id: 'fixed-action',
          type: 'shape',
          action: { kind: 'show', targetElementId: 'layout-fixed:master:m-a' },
        },
        {
          id: 'missing-action',
          type: 'shape',
          action: { kind: 'hide', targetElementId: 'absent' },
        },
      ],
    }
    let inserted
    act(() => {
      inserted = result.current.insertPreset(preset)
    })
    expect(inserted.warnings.map((warning) => warning.targetElementId)).toEqual([
      'layout-fixed:master:m-a',
      'absent',
    ])
    const effective = () =>
      resolveEffectiveSlide(
        result.current.presentation.slides[0],
        result.current.presentation.layoutMasters
      ).slide
    const source = () =>
      effective().elements.find((element) => element.id === inserted.elements[0].id)
    const missing = () =>
      effective().elements.find((element) => element.id === inserted.elements[1].id)
    expect(source().action.targetElementId).toBe('layout-fixed:master:m-a')
    expect(missing().action.targetElementId).toBe('absent')
    const initialState = createInteractionSlideState(effective())
    for (const element of [source(), missing()]) {
      const disabled = executeInteractionAction(initialState, element.action)
      expect(disabled.state).toBe(initialState)
      expect(disabled.error).toBe(element.action.referenceError)
    }
    const controls = (element) => (
      <ActionControls
        element={element}
        slide={result.current.presentation.slides[0]}
        presentation={result.current.presentation}
        onUpdate={(changes) => result.current.updateElements([{ id: element.id, ...changes }])}
      />
    )
    const view = render(controls(source()))
    expect(screen.getByRole('alert').textContent).toBe(source().action.referenceError)
    expect(
      [...screen.getByLabelText('Target element').options].map((option) => option.value)
    ).toContain('layout-fixed:master:m-a')
    fireEvent.change(screen.getByLabelText('Target element'), {
      target: { value: 'layout-fixed:master:m-a' },
    })
    view.rerender(controls(source()))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(source().action.referenceError).toBeUndefined()
    const hidden = executeInteractionAction(initialState, {
      kind: 'hide',
      targetElementId: 'layout-fixed:master:m-a',
    }).state
    expect(
      executeInteractionAction(hidden, source().action).state.visibility['layout-fixed:master:m-a']
    ).toBe(true)
    view.rerender(controls(missing()))
    expect(screen.getByRole('alert').textContent).toBe(missing().action.referenceError)
    expect(executeInteractionAction(initialState, missing().action).state).toBe(initialState)
    view.unmount()
  })

  it('leaves locked destinations and selection unchanged, and rejects unknown presets without a write', () => {
    const seed = authoringSeed()
    seed.slides[0].locked = true
    const { result } = renderHook(() => useLibraryHarness(seed))
    act(() => useEditorStore.getState().setSelectedElementIds(['parent-guard']))
    let inserted
    act(() => {
      inserted = result.current.insertPreset('education-quiz')
    })
    expect(inserted).toBeNull()
    expect(result.current.presentation).toEqual(seed)
    expect(result.current.selectedIds).toEqual(['parent-guard'])
    act(() =>
      result.current.setPresentation((previous) => ({
        ...previous,
        slides: previous.slides.map((slide) => ({ ...slide, locked: false })),
      }))
    )
    expect(() => result.current.insertPreset('missing-preset')).toThrow(/Unknown education preset/)
    expect(result.current.presentation.slides[0].elements).toEqual(seed.slides[0].elements)
  })
})
