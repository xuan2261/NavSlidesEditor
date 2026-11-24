import { describe, expect, it } from 'vitest'

import {
  clampSlideIndex,
  deleteSlidesAtIndices,
  duplicateSlidesAtIndices,
} from './slide-operation-helpers'

function createSlide(id, label = id) {
  return {
    id,
    elements: [
      {
        id: `${id}-element`,
        type: 'text',
        content: `<p>${label}</p>`,
      },
    ],
    notes: `${label} notes`,
  }
}

function createIdFactory(ids) {
  let index = 0
  return () => {
    const value = ids[index]
    index += 1
    return value
  }
}

describe('slide operation helpers', () => {
  it('duplicates consecutive slides after each original slide in the selected order', () => {
    const slides = [
      createSlide('slide-a', 'A'),
      createSlide('slide-b', 'B'),
      createSlide('slide-c', 'C'),
      createSlide('slide-d', 'D'),
    ]

    const result = duplicateSlidesAtIndices(
      slides,
      [1, 2],
      createIdFactory([
        'slide-b-copy',
        'slide-b-copy-element',
        'slide-c-copy',
        'slide-c-copy-element',
      ])
    )

    expect(result.slides.map((slide) => slide.id)).toEqual([
      'slide-a',
      'slide-b',
      'slide-b-copy',
      'slide-c',
      'slide-c-copy',
      'slide-d',
    ])
    expect(result.duplicatedIndices).toEqual([2, 4])
    expect(result.slides[2].elements[0].id).toBe('slide-b-copy-element')
    expect(result.slides[4].elements[0].id).toBe('slide-c-copy-element')
  })

  it('deletes a multi-selection and clamps the current index inside the remaining slides', () => {
    const slides = [
      createSlide('slide-a'),
      createSlide('slide-b'),
      createSlide('slide-c'),
      createSlide('slide-d'),
    ]

    const result = deleteSlidesAtIndices(slides, [2, 3], 3)

    expect(result.slides.map((slide) => slide.id)).toEqual(['slide-a', 'slide-b'])
    expect(result.currentSlideIndex).toBe(1)
  })

  it('clamps the current slide index to the valid range', () => {
    expect(clampSlideIndex(4, 2)).toBe(1)
    expect(clampSlideIndex(-1, 2)).toBe(0)
    expect(clampSlideIndex(2, 0)).toBe(0)
  })
  it('copies layout links while remapping only bindings to copied slide-owned elements', () => {
    const source = {
      id: 'slide',
      layoutId: 'layout',
      elements: [
        { id: 'bound', type: 'text' },
        { id: 'unbound', type: 'text' },
      ],
      layoutOverrides: {
        hiddenElementIds: ['fixed'],
        elementPatches: { fixed: { opacity: 0.5 } },
        placeholderBindings: { title: 'bound', stale: 'missing' },
      },
    }
    const result = duplicateSlidesAtIndices(
      [source],
      [0],
      createIdFactory(['copy-slide', 'copy-bound', 'copy-unbound'])
    )
    const copy = result.slides[1]
    expect(copy.layoutId).toBe('layout')
    expect(copy.layoutOverrides).toEqual({
      hiddenElementIds: ['fixed'],
      elementPatches: { fixed: { opacity: 0.5 } },
      placeholderBindings: { title: 'copy-bound' },
    })
    expect(copy.layoutOverrides.elementPatches).not.toBe(source.layoutOverrides.elementPatches)
  })

  it('duplicates parent and child local actions, groups, connectors and owned game IDs without crossing scopes', () => {
    let sequence = 0
    const elements = (prefix) => [
      {
        id: `${prefix}-source`,
        type: 'shape',
        groupId: `${prefix}-group`,
        action: { kind: 'show', targetElementId: `${prefix}-target` },
      },
      {
        id: `${prefix}-target`,
        type: 'game',
        groupId: `${prefix}-group`,
        gameType: 'quiz',
        quiz: {
          questions: [
            {
              id: `${prefix}-q`,
              options: [{ id: `${prefix}-o`, text: 'Choice' }],
              answerKey: { optionId: `${prefix}-o` },
            },
          ],
        },
      },
      {
        id: `${prefix}-wire`,
        type: 'line',
        connections: { start: { targetId: `${prefix}-target`, anchor: 'e' } },
      },
    ]
    const original = {
      id: 'parent',
      elements: elements('parent'),
      children: [{ id: 'child', elements: elements('child') }],
    }
    const copy = duplicateSlidesAtIndices([original], [0], () => `fresh-${++sequence}`).slides[1]
    for (const slide of [copy, copy.children[0]]) {
      const [source, target, connector] = slide.elements
      expect(source.action.targetElementId).toBe(target.id)
      expect(connector.connections.start.targetId).toBe(target.id)
      expect(source.groupId).toBe(target.groupId)
      expect(source.groupId).not.toBe(original.elements[0].groupId)
      expect(target.quiz.questions[0].answerKey.optionId).toBe(
        target.quiz.questions[0].options[0].id
      )
    }
    copy.children[0].elements[1].quiz.questions[0].options[0].text = 'Edited'
    expect(original.children[0].elements[1].quiz.questions[0].options[0].text).toBe('Choice')
  })

  it('clones authored game override identities while retaining their fixed master identity', () => {
    let count = 0
    const quiz = {
      questions: [
        { id: 'q', options: [{ id: 'o', text: 'Choice' }], answerKey: { optionId: 'o' } },
      ],
    }
    const layouts = [
      {
        id: 'layout',
        name: 'Layout',
        placeholders: [],
        fixedElements: [{ id: 'game', type: 'game', gameType: 'quiz', quiz }],
      },
    ]
    const source = {
      id: 'slide',
      layoutId: 'layout',
      elements: [],
      layoutOverrides: { elementPatches: { game: { quiz } } },
    }
    const result = duplicateSlidesAtIndices([source], [0], () => `copy-${++count}`, 0, layouts)
    const config = result.slides[1].layoutOverrides.elementPatches.game.quiz
    expect(config.questions[0].id).not.toBe('q')
    expect(config.questions[0].answerKey.optionId).toBe(config.questions[0].options[0].id)
    expect(layouts[0].fixedElements[0].quiz.questions[0].id).toBe('q')
  })
})
