import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { describe, expect, it } from 'vitest'
import {
  createCopyOperation,
  createPasteOperation,
  createDuplicateOperation,
  useClipboard,
} from './use-clipboard'

const source = () => [
  { id: 'button', type: 'shape', action: { kind: 'show', targetElementId: 'answer' } },
  { id: 'answer', type: 'text', initialVisibility: 'hidden', content: 'Answer' },
]

describe('clipboard interaction ownership', () => {
  it('copies source and target with an independent action and fresh target reference', () => {
    const original = source()
    const clipboardElements = createCopyOperation({
      slideElements: original,
      selectedElementIds: ['button', 'answer'],
    })
    const pasted = createPasteOperation({ clipboardElements })
    expect(pasted.elements[0].action.targetElementId).toBe(pasted.elements[1].id)
    pasted.elements[0].action.kind = 'hide'
    expect(original[0].action.kind).toBe('show')
  })

  it('retains a missing target with actionable diagnostics and never adopts a destination collision', () => {
    const original = source()
    const clipboardElements = createCopyOperation({
      slideElements: original,
      selectedElementIds: ['button'],
    })
    const pasted = createPasteOperation({
      clipboardElements,
      destinationElements: [{ id: 'answer', type: 'text', content: 'Unrelated' }],
    })
    expect(pasted.elements[0].action.targetElementId).toBe('answer')
    expect(pasted.elements[0].action.referenceError).toBeTruthy()
    expect(pasted.warnings).toContainEqual(
      expect.objectContaining({
        sourceElementId: pasted.elements[0].id,
        targetElementId: 'answer',
        error: expect.stringMatching(/target|choose/i),
      })
    )
  })

  it('allows same-slide partial duplicates to retain an existing target', () => {
    const duplicated = createDuplicateOperation({
      slideElements: source(),
      selectedElementIds: ['button'],
    })
    expect(duplicated.toAdd[0].action).toEqual({ kind: 'show', targetElementId: 'answer' })
    expect(duplicated.warnings).toEqual([])
  })

  it('retains partial targets only within the authored deck and slide scope, including after target edits', () => {
    const clipboardElements = createCopyOperation({
      slideElements: source(),
      selectedElementIds: ['button'],
      sourceScopeId: 'deck-a/slide',
    })
    const destinationElements = [{ id: 'answer', type: 'text', content: 'Edited answer' }]
    const same = createPasteOperation({
      clipboardElements,
      destinationElements,
      destinationScopeId: 'deck-a/slide',
    })
    expect(same.elements[0].action).toEqual({ kind: 'show', targetElementId: 'answer' })
    expect(same.warnings).toEqual([])
    const external = createPasteOperation({
      clipboardElements,
      destinationElements,
      destinationScopeId: 'deck-b/slide',
    })
    expect(external.elements[0].action.referenceError).toBeTruthy()
  })

  it('clones owned question and option IDs while keeping answer keys attached to their options', () => {
    const element = {
      id: 'game',
      type: 'game',
      gameType: 'quiz',
      quiz: {
        questions: [
          {
            id: 'q',
            prompt: 'Question',
            options: [{ id: 'o', text: 'Choice' }],
            answerKey: { optionId: 'o' },
          },
        ],
      },
    }
    const result = createDuplicateOperation({
      slideElements: [element],
      selectedElementIds: ['game'],
    }).toAdd[0]
    expect(result.quiz.questions[0].id).not.toBe('q')
    expect(result.quiz.questions[0].options[0].id).not.toBe('o')
    expect(result.quiz.questions[0].answerKey.optionId).toBe(result.quiz.questions[0].options[0].id)
    expect(element.quiz.questions[0].answerKey.optionId).toBe('o')
  })

  it('persists unresolved provenance and selects new copies with the real React state updater', () => {
    const clipboardElements = createCopyOperation({
      slideElements: source(),
      selectedElementIds: ['button'],
      sourceScopeId: 'source',
    })
    const { result } = renderHook(() => {
      const [presentation, setPresentation] = useState({
        slides: [{ id: 'destination', elements: [{ id: 'answer', type: 'text' }] }],
      })
      const clipboard = useClipboard({
        setPresentation,
        mapActiveSlide: (previous, transform) => ({
          ...previous,
          slides: [transform(previous.slides[0])],
        }),
        getActiveSlide: () => presentation.slides[0],
      })
      return { presentation, ...clipboard }
    })
    let pasted
    act(() => {
      pasted = result.current.performPaste(clipboardElements)
    })
    const copy = result.current.presentation.slides[0].elements[1]
    expect(copy.action.targetElementId).toBe('answer')
    expect(copy.action.referenceError).toBeTruthy()
    expect(pasted.warnings[0].sourceElementId).toBe(copy.id)
    expect(useEditorStore.getState().selectedElementIds).toEqual([copy.id])
  })
})
