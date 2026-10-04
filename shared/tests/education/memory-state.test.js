import { describe, expect, it } from 'vitest'
import {
  createMemoryConfig,
  composeMemoryCards,
  memoryCardId,
} from '../../src/education/memory-config.js'
import { createMemoryState, memoryReducer } from '../../src/education/memory-state.js'
import { cloneCardContent } from '../../src/education/card-content.js'

const text = (value) => ({ type: 'text', text: value })
const fixture = (overrides) =>
  createMemoryConfig({
    shuffleOnStart: false,
    mismatchDelayMs: 1000,
    matchPoints: 7,
    pairs: [
      { id: 'a', first: text('France'), second: text('Paris') },
      { id: 'b', first: text('Italy'), second: text('Rome') },
    ],
    ...overrides,
  })
const flip = (state, config, pair, side = 'first') =>
  memoryReducer(state, { type: 'flip', cardId: memoryCardId(pair, side) }, config)
const expire = (state, config, pending = state.pendingMismatch) =>
  memoryReducer(
    state,
    { type: 'mismatch-expired', generation: pending.generation, token: pending.token },
    config
  )
const mismatch = (config) => flip(flip(createMemoryState(config), config, 'a'), config, 'b')

describe('memory reducer', () => {
  it('accepts each pair and scores only once without mutating earlier state or authored content', () => {
    const config = fixture(),
      before = structuredClone(config),
      initial = createMemoryState(config)
    const first = flip(initial, config, 'a')
    expect(flip(first, config, 'a')).toBe(first)
    const match = flip(first, config, 'a', 'second')
    expect(match).toMatchObject({
      faceUp: [],
      matchedPairIds: ['a'],
      attempts: 1,
      score: 7,
      pendingMismatch: null,
    })
    expect(flip(match, config, 'a')).toBe(match)
    const complete = flip(flip(match, config, 'b'), config, 'b', 'second')
    expect(complete).toMatchObject({ matchedPairIds: ['a', 'b'], attempts: 2, score: 14 })
    expect(initial).toMatchObject({ faceUp: [], attempts: 0, score: 0, matchedPairIds: [] })
    expect(config).toEqual(before)
  })

  it('locks a mismatched pair until the matching generation and token expire', () => {
    const config = fixture(),
      state = mismatch(config)
    expect(state.pendingMismatch).toEqual({
      cardIds: ['a:first', 'b:first'],
      remainingMs: 1000,
      generation: 0,
      token: 1,
    })
    expect(state).toMatchObject({ faceUp: ['a:first', 'b:first'], attempts: 1, score: 0 })
    expect(flip(state, config, 'a', 'second')).toBe(state)
    expect(
      memoryReducer(state, { type: 'mismatch-expired', generation: 0, token: 99 }, config)
    ).toBe(state)
    expect(memoryReducer(state, { type: 'mismatch-expired', token: 1 }, config)).toBe(state)
    expect(expire(state, config)).toMatchObject({
      faceUp: [],
      pendingMismatch: null,
      attempts: 1,
      score: 0,
    })
    const later = flip(flip(expire(state, config), config, 'a'), config, 'b')
    expect(expire(later, config, state.pendingMismatch)).toBe(later)
  })

  it('pauses remaining mismatch time and ignores callbacks and input until resume', () => {
    const config = fixture(),
      pending = mismatch(config)
    const paused = memoryReducer(pending, { type: 'pause', remainingMs: 620 }, config)
    expect(paused).toMatchObject({ paused: true, pendingMismatch: { remainingMs: 620 } })
    expect(expire(paused, config)).toBe(paused)
    expect(flip(paused, config, 'b', 'second')).toBe(paused)
    expect(memoryReducer(paused, { type: 'pause', remainingMs: 0 }, config)).toBe(paused)
    const resumed = memoryReducer(paused, { type: 'resume' }, config)
    expect(resumed.pendingMismatch.remainingMs).toBe(620)
    expect(expire(resumed, config)).toMatchObject({
      faceUp: [],
      pendingMismatch: null,
      paused: false,
    })
    expect(memoryReducer(pending, { type: 'pause', remainingMs: -1 }, config)).toBe(pending)
    expect(memoryReducer(pending, { type: 'pause', remainingMs: 1001 }, config)).toBe(pending)
  })

  it('preserves an accepted pair through a later mismatch', () => {
    const config = fixture({
      pairs: [...fixture().pairs, { id: 'c', first: text('Japan'), second: text('Tokyo') }],
    })
    const matched = flip(flip(createMemoryState(config), config, 'a'), config, 'a', 'second')
    const pending = flip(flip(matched, config, 'b'), config, 'c')
    expect(expire(pending, config)).toMatchObject({
      matchedPairIds: ['a'],
      score: 7,
      attempts: 2,
      faceUp: [],
    })
  })

  it('commits a zero-delay mismatch atomically without allowing a stale callback', () => {
    const config = fixture({ mismatchDelayMs: 0 }),
      state = mismatch(config)
    expect(state).toMatchObject({ faceUp: [], pendingMismatch: null, attempts: 1, score: 0 })
    expect(
      memoryReducer(state, { type: 'mismatch-expired', generation: 0, token: 1 }, config)
    ).toBe(state)
    expect(flip(state, config, 'a').faceUp).toEqual(['a:first'])
  })

  it('reveals as practice without credit or solving and cancels the pending mismatch', () => {
    const config = fixture(),
      pending = mismatch(config)
    const reveal = memoryReducer(pending, { type: 'reveal' }, config)
    expect(reveal).toMatchObject({
      revealMode: true,
      matchedPairIds: [],
      score: 0,
      attempts: 1,
      pendingMismatch: null,
    })
    expect(flip(reveal, config, 'a', 'second')).toBe(reveal)
    expect(expire(reveal, config, pending.pendingMismatch)).toBe(reveal)
    expect(memoryReducer(reveal, { type: 'reveal' }, config)).toBe(reveal)
    expect(memoryReducer(reveal, { type: 'reset' }, config)).toMatchObject({
      revealMode: false,
      attempts: 0,
      score: 0,
    })
  })

  it.each(['first', 'pending', 'matched', 'complete'])(
    'resets %s progress and rejects old generation actions',
    (stage) => {
      const config = fixture()
      let state = flip(createMemoryState(config), config, 'a')
      if (stage === 'pending') state = flip(state, config, 'b')
      if (stage === 'matched' || stage === 'complete') state = flip(state, config, 'a', 'second')
      if (stage === 'complete') state = flip(flip(state, config, 'b'), config, 'b', 'second')
      const reset = memoryReducer(state, { type: 'reset' }, config)
      expect(reset).toMatchObject({
        generation: 1,
        faceUp: [],
        matchedPairIds: [],
        score: 0,
        attempts: 0,
        pendingMismatch: null,
      })
      expect(memoryReducer(reset, { type: 'flip', cardId: 'a:first', generation: 0 }, config)).toBe(
        reset
      )
      const nextMismatch = flip(flip(reset, config, 'a'), config, 'b')
      expect(
        memoryReducer(nextMismatch, { type: 'mismatch-expired', generation: 0, token: 1 }, config)
      ).toBe(nextMismatch)
    }
  )

  it('keeps independent instances and reshuffles only IDs on reset', () => {
    const config = fixture({ shuffleOnStart: true }),
      saved = structuredClone(config)
    const first = createMemoryState(config, { random: () => 0 }),
      second = createMemoryState(config, { random: () => 0.999 })
    expect(first.order).toEqual(['a:second', 'b:first', 'b:second', 'a:first'])
    expect(second.order).toEqual(['a:first', 'a:second', 'b:first', 'b:second'])
    const reset = memoryReducer(flip(first, config, 'a'), { type: 'reset' }, config, {
      random: () => 0.999,
    })
    expect(reset.order).toEqual(second.order)
    expect(second.faceUp).toEqual([])
    expect(config).toEqual(saved)
  })
})

describe('memory composition and card safety', () => {
  it('retains plain text and safe image alt without retaining unknown HTML attributes', () => {
    expect(
      cloneCardContent({ type: 'text', text: '<script>plain text</script>', onclick: 'run()' })
    ).toEqual(text('<script>plain text</script>'))
    expect(
      cloneCardContent({
        type: 'image',
        src: '/uploads/card.png',
        alt: 'Paris skyline',
        onerror: 'run()',
      })
    ).toEqual({ type: 'image', src: '/uploads/card.png', alt: 'Paris skyline' })
    const config = fixture(),
      cards = composeMemoryCards(config)
    cards[0].content.text = 'changed locally'
    expect(config.pairs[0].first.text).toBe('France')
    expect(
      composeMemoryCards(
        fixture({
          pairs: [
            { id: 'a:first', first: text('one'), second: text('two') },
            { id: 'a', first: text('three'), second: text('four') },
          ],
        })
      ).map((card) => card.id)
    ).toEqual(['a:first:first', 'a:first:second', 'a:first', 'a:second'])
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html;base64,AAAA',
    'data:audio/mp3;base64,AAAA',
    '/x"onerror=run()',
  ])('rejects unsafe or nonimage source %s', (src) => {
    expect(() => cloneCardContent({ type: 'image', src, alt: 'Description' })).toThrow()
  })

  it('requires image descriptions and refuses unsupported content instead of dropping it', () => {
    expect(() => cloneCardContent({ type: 'image', src: '/safe.png', alt: ' ' })).toThrow(/alt/)
    expect(() => cloneCardContent({ type: 'html', html: '<b>answer</b>' })).toThrow(/type/)
  })

  it.each([
    { mismatchDelayMs: -1 },
    { mismatchDelayMs: 5001 },
    { mismatchDelayMs: 1.5 },
    { matchPoints: 0 },
    { matchPoints: 1001 },
    { matchPoints: NaN },
    { shuffleOnStart: 'yes' },
    { pairs: [] },
    {
      pairs: Array.from({ length: 25 }, (_, i) => ({
        id: `p${i}`,
        first: text('a'),
        second: text('b'),
      })),
    },
    { pairs: [fixture().pairs[0], fixture().pairs[0]] },
  ])('rejects invalid bounds or duplicate IDs %j', (overrides) => {
    expect(() => fixture(overrides)).toThrow()
  })
})
