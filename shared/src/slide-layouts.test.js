import { describe, expect, it } from 'vitest'
import layouts from './slide-layouts.js'
import interactions from './education/interaction-actions.js'
import defaults from './education/game-defaults.js'

const { createInteractionSlideState, executeInteractionAction } = interactions
const geometry = { x: 0, y: 0, width: 120, height: 60, zIndex: 0 }

const { applyLayout, changeLayout, detachLayout, fixedId, resolveEffectiveSlide } = layouts
const master = {
  id: 'master',
  name: 'Master',
  tokens: { colors: { accent: '#123456' } },
  fixedElements: [{ id: 'band', type: 'shape', x: 0, y: 0, width: 960, height: 40, zIndex: 0 }],
  placeholders: [
    {
      id: 'title',
      type: 'text',
      role: 'title',
      x: 80,
      y: 80,
      width: 800,
      height: 100,
      zIndex: 1,
      contentPolicy: { elementDefaults: { content: '<h1>Title</h1>' } },
    },
  ],
}
const ids = (...values) => {
  let i = 0
  return () => values[i++]
}

describe('slide layouts', () => {
  it('[cap:layout.master-resolution] resolves namespaced fixed elements, bound placeholders, patches, and tokens without mutation', () => {
    const slide = {
      id: 'slide',
      layoutId: 'master',
      elements: [
        { id: 'owned', type: 'text', x: 1, y: 2, width: 3, height: 4, content: '<h1>Owned</h1>' },
      ],
      layoutOverrides: {
        placeholderBindings: { title: 'owned' },
        elementPatches: { band: { opacity: 0.5, id: 'nope', type: 'text' } },
      },
    }
    const { slide: effective } = resolveEffectiveSlide(slide, [master])
    expect(effective.elements.map((element) => element.id)).toEqual([
      fixedId('master', 'band'),
      'owned',
    ])
    expect(effective.elements[0]).toMatchObject({ type: 'shape', opacity: 0.5, locked: true })
    expect(effective.elements[1]).toMatchObject({ x: 80, width: 800, content: '<h1>Owned</h1>' })
    expect(effective.designTokens.colors.accent).toBe('#123456')
    expect(slide.layoutOverrides.elementPatches.band.id).toBe('nope')
  })

  it('degrades missing layouts to untouched slide-owned elements and a warning', () => {
    const slide = { layoutId: 'gone', elements: [{ id: 'owned', type: 'text' }] }
    const result = resolveEffectiveSlide(slide, [master])
    expect(result.warnings).toHaveLength(1)
    expect(result.slide.elements).toEqual(slide.elements)
  })

  it('applies, changes, and detaches layouts without discarding unmatched content', () => {
    const slide = { id: 'slide', elements: [{ id: 'body', type: 'text', content: '<p>Keep</p>' }] }
    const applied = applyLayout(slide, [master], 'master', ids('title-owned'))
    expect(applied.slide.layoutOverrides.placeholderBindings).toEqual({ title: 'title-owned' })
    expect(applied.slide.elements).toHaveLength(2)
    const changed = changeLayout(applied.slide, [master], 'master', ids('replacement'))
    expect(changed.slide.elements.some((element) => element.content === '<p>Keep</p>')).toBe(true)
    const detached = detachLayout(applied.slide, [master], ids('fixed-copy'))
    expect(detached.slide.layoutId).toBeUndefined()
    expect(detached.slide.elements.map((element) => element.id)).toContain('fixed-copy')
  })

  it('resolves inherited raw targets to fixed effective IDs even when an owned ID collides', () => {
    const layout = {
      ...master,
      fixedElements: [
        {
          ...geometry,
          id: 'button',
          type: 'shape',
          action: { kind: 'show', targetElementId: 'answer' },
        },
        {
          ...geometry,
          zIndex: 1,
          id: 'answer',
          type: 'text',
          initialVisibility: 'hidden',
          content: 'Master answer',
        },
      ],
    }
    const slide = {
      id: 'slide',
      layoutId: 'master',
      elements: [
        { id: 'answer', type: 'text', initialVisibility: 'hidden', content: 'Owned answer' },
      ],
    }
    const effective = resolveEffectiveSlide(slide, [layout]).slide
    expect(effective.elements[0].action.targetElementId).toBe(fixedId('master', 'answer'))
    const executed = executeInteractionAction(
      createInteractionSlideState(effective),
      effective.elements[0].action
    )
    expect(executed.state.visibility[fixedId('master', 'answer')]).toBe(true)
    expect(executed.state.visibility.answer).toBe(false)
    expect(layout.fixedElements[0].action.targetElementId).toBe('answer')
  })

  it('detaches fixed source and target together and remaps owned actions pointing to fixed IDs', () => {
    const layout = {
      ...master,
      fixedElements: [
        {
          ...geometry,
          id: 'button',
          type: 'shape',
          action: { kind: 'show', targetElementId: 'answer' },
        },
        {
          ...geometry,
          zIndex: 1,
          id: 'answer',
          type: 'text',
          initialVisibility: 'hidden',
          content: 'Master answer',
        },
      ],
    }
    const slide = {
      id: 'slide',
      layoutId: 'master',
      elements: [
        {
          id: 'owned',
          type: 'shape',
          action: { kind: 'toggle', targetElementId: fixedId('master', 'answer') },
        },
      ],
    }
    const detached = detachLayout(slide, [layout], ids('new-button', 'new-answer')).slide
    expect(detached.elements[0].action.targetElementId).toBe('new-answer')
    expect(detached.elements[2].action.targetElementId).toBe('new-answer')
    expect(detached.elements[0].locked).toBe(false)
    expect(detached.elements[1].locked).toBe(false)
    const shown = executeInteractionAction(
      createInteractionSlideState(detached),
      detached.elements[0].action
    )
    const toggled = executeInteractionAction(shown.state, detached.elements[2].action)
    expect(shown.state.visibility['new-answer']).toBe(true)
    expect(toggled.state.visibility['new-answer']).toBe(false)
    expect(detached.elements.some((element) => element.id === fixedId('master', 'answer'))).toBe(
      false
    )
    expect(layout.fixedElements[0].action.targetElementId).toBe('answer')
    expect(detached.layoutId).toBeUndefined()
    expect(slide.elements[0].action.targetElementId).toBe(fixedId('master', 'answer'))
  })

  it('maps inherited placeholder references to their owned binding without retargeting an unbound name collision', () => {
    const layout = {
      ...master,
      fixedElements: [
        {
          ...geometry,
          id: 'source',
          type: 'shape',
          action: { kind: 'show', targetElementId: 'title' },
        },
      ],
    }
    const slide = {
      id: 'slide',
      layoutId: 'master',
      elements: [
        { id: 'bound-title', type: 'text', initialVisibility: 'hidden' },
        { id: 'title', type: 'text', initialVisibility: 'hidden' },
      ],
      layoutOverrides: { placeholderBindings: { title: 'bound-title' } },
    }
    const bound = resolveEffectiveSlide(slide, [layout]).slide
    expect(bound.elements[0].action.targetElementId).toBe('bound-title')
    expect(
      executeInteractionAction(createInteractionSlideState(bound), bound.elements[0].action).state
        .visibility['bound-title']
    ).toBe(true)
    delete slide.layoutOverrides
    const unresolved = resolveEffectiveSlide(slide, [layout])
    expect(unresolved.slide.elements[0].action.targetElementId).toBe(fixedId('master', 'title'))
    expect(unresolved.slide.elements[0].action.referenceError).toBeTruthy()
    const state = createInteractionSlideState(unresolved.slide)
    const disabled = executeInteractionAction(state, unresolved.slide.elements[0].action)
    expect(disabled.state).toBe(state)
    expect(disabled.error).toBe(unresolved.slide.elements[0].action.referenceError)
    expect(disabled.state.visibility.title).toBe(false)
  })

  it('respects an explicit inherited action override choosing an owned target with a raw-name collision', () => {
    const layout = {
      ...master,
      fixedElements: [
        {
          ...geometry,
          id: 'button',
          type: 'shape',
          action: { kind: 'show', targetElementId: 'answer' },
        },
        { ...geometry, zIndex: 1, id: 'answer', type: 'text' },
      ],
    }
    const slide = {
      id: 'slide',
      layoutId: 'master',
      elements: [{ id: 'answer', type: 'text' }],
      layoutOverrides: {
        elementPatches: { button: { action: { kind: 'hide', targetElementId: 'answer' } } },
      },
    }
    const resolved = resolveEffectiveSlide(slide, [layout])
    expect(resolved.slide.elements[0].action.targetElementId).toBe('answer')
    expect(resolved.warnings).toEqual([])
    const executed = executeInteractionAction(
      createInteractionSlideState(resolved.slide),
      resolved.slide.elements[0].action
    )
    expect(executed.state.visibility.answer).toBe(false)
    expect(executed.state.visibility[fixedId('master', 'answer')]).toBe(true)
  })

  it('does not reinterpret authored game identities as element links during effective layout resolution', () => {
    const quiz = defaults.createDefaultGameConfig('quiz')
    const question = quiz.questions[0]
    question.id = 'answer'
    const layout = {
      ...master,
      fixedElements: [
        { ...geometry, id: 'game', type: 'game', gameType: 'quiz', quiz },
        { ...geometry, zIndex: 1, id: 'answer', type: 'text' },
      ],
    }
    const effective = resolveEffectiveSlide({ id: 'slide', layoutId: 'master', elements: [] }, [
      layout,
    ]).slide
    expect(effective.elements[0].quiz.questions[0].id).toBe('answer')
    expect(effective.elements[0].id).toBe(fixedId('master', 'game'))
    expect(effective.elements[0].quiz).toEqual(quiz)
    expect(effective.elements[0].quiz.questions[0].answerKey.optionId).toBe(question.options[0].id)
    expect(layout.fixedElements[0].id).toBe('game')
    expect(layout.fixedElements[0].quiz.questions[0].id).toBe('answer')
  })
})
