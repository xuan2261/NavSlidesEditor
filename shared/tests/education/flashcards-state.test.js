import { describe, expect, it } from 'vitest'
import { createFlashcardsConfig } from '../../src/education/flashcards-config.js'
import {
  createFlashcardsState,
  flashcardsReducer,
  getFlashcardsProgress,
} from '../../src/education/flashcards-state.js'

const text = (value) => ({ type: 'text', text: value })
const fixture = (overrides) =>
  createFlashcardsConfig({
    cards: ['a', 'b', 'c'].map((id) => ({
      id,
      front: text(`Question ${id}`),
      back: text(`Answer ${id}`),
    })),
    ...overrides,
  })
const reduce = (state, config, type, options) => flashcardsReducer(state, { type }, config, options)

describe('flashcards reducer', () => {
  it('navigates without wrapping and returns newly selected cards to their front', () => {
    const config = fixture(),
      initial = createFlashcardsState(config)
    expect(reduce(initial, config, 'previous')).toBe(initial)
    const back = reduce(initial, config, 'flip')
    const second = reduce(back, config, 'next')
    expect(second).toMatchObject({ currentIndex: 1, side: 'front', studiedIds: ['a'] })
    const last = reduce(second, config, 'next')
    expect(getFlashcardsProgress(last)).toEqual({ position: 3, total: 3, studied: 1 })
    const lastBack = reduce(last, config, 'flip')
    expect(reduce(lastBack, config, 'next')).toBe(lastBack)
    expect(reduce(lastBack, config, 'previous')).toMatchObject({
      currentIndex: 1,
      side: 'front',
      studiedIds: ['a', 'c'],
    })
    expect(initial).toMatchObject({ currentIndex: 0, side: 'front', studiedIds: [] })
  })

  it('counts each first revealed back once even after repeated flips and revisits', () => {
    const config = fixture()
    let state = createFlashcardsState(config)
    state = reduce(state, config, 'flip')
    state = reduce(state, config, 'flip')
    state = reduce(state, config, 'flip')
    expect(state.studiedIds).toEqual(['a'])
    state = reduce(reduce(state, config, 'next'), config, 'flip')
    state = reduce(reduce(state, config, 'previous'), config, 'flip')
    expect(state.studiedIds).toEqual(['a', 'b'])
    expect(getFlashcardsProgress(state)).toEqual({ position: 1, total: 3, studied: 2 })
    state = reduce(reduce(reduce(state, config, 'next'), config, 'next'), config, 'flip')
    expect(getFlashcardsProgress(state)).toEqual({ position: 3, total: 3, studied: 3 })
  })

  it('shuffles a permutation while preserving the current identity, side, content and studied IDs', () => {
    const config = fixture(),
      saved = structuredClone(config)
    const back = reduce(reduce(createFlashcardsState(config), config, 'next'), config, 'flip')
    const state = reduce(back, config, 'shuffle', { random: () => 0 })
    expect(state.order).toEqual(['b', 'c', 'a'])
    expect(state.order[state.currentIndex]).toBe('b')
    expect(state).toMatchObject({ currentIndex: 0, side: 'back', studiedIds: ['b'] })
    expect([...state.order].sort()).toEqual(['a', 'b', 'c'])
    expect(state.cards).toEqual(back.cards)
    expect(back.order).toEqual(['a', 'b', 'c'])
    expect(config).toEqual(saved)
    expect(reduce(state, config, 'shuffle', { random: () => 0.999 })).toBe(state)
  })

  it('supports a single card without navigation or pretend shuffle changes', () => {
    const config = fixture({ cards: [fixture().cards[0]], shuffleOnStart: true })
    const initial = createFlashcardsState(config, {
      random: () => {
        throw new Error('Must not draw for one card')
      },
    })
    const back = reduce(initial, config, 'flip')
    expect(back.side).toBe('back')
    expect(back.studiedIds).toEqual(['a'])
    expect(reduce(back, config, 'previous')).toBe(back)
    expect(reduce(back, config, 'next')).toBe(back)
    expect(reduce(back, config, 'shuffle')).toBe(back)
    expect(getFlashcardsProgress(back)).toEqual({ position: 1, total: 1, studied: 1 })
  })

  it('resets order and study progress, increments generation and rejects stale commands', () => {
    const config = fixture()
    const studied = reduce(
      reduce(createFlashcardsState(config, { generation: 4 }), config, 'next'),
      config,
      'flip'
    )
    const shuffled = reduce(studied, config, 'shuffle', { random: () => 0 })
    const reset = reduce(shuffled, config, 'reset')
    expect(reset).toMatchObject({
      order: ['a', 'b', 'c'],
      currentIndex: 0,
      side: 'front',
      studiedIds: [],
      generation: 5,
    })
    expect(flashcardsReducer(reset, { type: 'flip', generation: 4 }, config)).toBe(reset)
    expect(flashcardsReducer(reset, { type: 'reset', generation: 4 }, config)).toBe(reset)
    expect(flashcardsReducer(reset, { type: 'flip', generation: 5 }, config).studiedIds).toEqual([
      'a',
    ])
  })

  it('creates a fresh start permutation on reset without affecting another block', () => {
    const config = fixture({ shuffleOnStart: true }),
      before = structuredClone(config)
    const first = createFlashcardsState(config, { random: () => 0 })
    const second = createFlashcardsState(config, { random: () => 0.999 })
    expect(first.order).toEqual(['b', 'c', 'a'])
    const reset = reduce(reduce(first, config, 'flip'), config, 'reset', { random: () => 0.999 })
    expect(reset).toMatchObject({
      order: ['a', 'b', 'c'],
      currentIndex: 0,
      side: 'front',
      studiedIds: [],
    })
    expect(second.studiedIds).toEqual([])
    expect(config).toEqual(before)
  })

  it.each([NaN, Infinity, -0.1, 1, '0.5'])(
    'rejects random draw %s without mutating progress',
    (draw) => {
      const config = fixture(),
        state = reduce(createFlashcardsState(config), config, 'flip')
      expect(() => reduce(state, config, 'shuffle', { random: () => draw })).toThrow(/random/)
      expect(state).toMatchObject({ order: ['a', 'b', 'c'], side: 'back', studiedIds: ['a'] })
    }
  )
})

describe('flashcards composition', () => {
  it('clones both sides with stable IDs and preserves safe image descriptions', () => {
    const source = {
      cards: [
        {
          id: 'picture',
          front: { type: 'image', src: 'data:image/png;base64,AAAA', alt: 'Map of France' },
          back: text('France'),
        },
      ],
    }
    const config = createFlashcardsConfig(source),
      state = createFlashcardsState(config)
    source.cards[0].front.alt = 'Changed source'
    expect(config.cards[0].front.alt).toBe('Map of France')
    config.cards[0].back.text = 'Changed config'
    expect(state.cards[0]).toEqual({
      id: 'picture',
      front: { type: 'image', src: 'data:image/png;base64,AAAA', alt: 'Map of France' },
      back: text('France'),
    })
    expect(state.order).toEqual(['picture'])
  })

  it.each([
    { cards: [] },
    {
      cards: Array.from({ length: 101 }, (_, i) => ({
        id: `c${i}`,
        front: text('a'),
        back: text('b'),
      })),
    },
    { cards: [fixture().cards[0], fixture().cards[0]] },
    { shuffleOnStart: 'true' },
    { cards: [{ id: 'a', front: text(' '), back: text('Answer') }] },
    {
      cards: [
        {
          id: 'a',
          front: text('Question'),
          back: { type: 'image', src: 'javascript:alert(1)', alt: 'Answer' },
        },
      ],
    },
  ])('rejects invalid counts, duplicate IDs or unsafe side content %j', (overrides) => {
    expect(() => fixture(overrides)).toThrow()
  })
})
