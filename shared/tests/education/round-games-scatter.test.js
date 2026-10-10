import { describe, expect, it } from 'vitest'
import { normalizeGameConfig } from '../../src/education/normalize-game-config.js'
import {
  createScattergoriesState,
  reduceScattergories,
} from '../../src/education/games/scattergories.js'
function fixture(overrides = {}) {
  const config = normalizeGameConfig(
    {
      teams: [
        { id: 'a', name: 'Same' },
        { id: 'b', name: 'Same' },
      ],
      categories: [
        { id: 'fruit', label: 'Fruit' },
        { id: 'place', label: 'Place' },
      ],
      letterMode: 'manual',
      letter: 'É',
      timePerRound: 2,
      ...overrides,
    },
    'scattergories'
  )
  let state = { ...createScattergoriesState(config), generation: 0 }
  const send = (type, data = {}, now = 0) =>
    (state = reduceScattergories(
      config,
      state,
      { type, generation: 0, round: state.round, ...data },
      { now: () => now, random: () => 0 }
    ))
  return {
    config,
    send,
    get state() {
      return state
    },
  }
}
describe('Scatter category/team responses', () => {
  it('normalizes trim case and NFC only, scores category-local unique eligible answers once', () => {
    const f = fixture()
    f.send('start')
    f.send('answer', { categoryId: 'fruit', teamId: 'a', text: ' Éclair ' })
    f.send('answer', { categoryId: 'fruit', teamId: 'b', text: 'e\u0301CLAIR' })
    f.send('answer', { categoryId: 'place', teamId: 'a', text: 'Évora' })
    f.send('answer', { categoryId: 'place', teamId: 'b', text: 'Paris' })
    f.send('review')
    expect(f.state.scores).toEqual({ a: 10, b: 0 })
    expect(f.state.results.fruit).toEqual({ a: 0, b: 0 })
    expect(f.state.results.place).toEqual({ a: 10, b: 0 })
    const reviewed = f.state
    expect(f.send('review')).toBe(reviewed)
    expect(f.send('answer', { categoryId: 'place', teamId: 'b', text: 'Évian' })).toBe(reviewed)
  })
  it('all scoring accepts duplicate eligible words and manual letter overrides', () => {
    const f = fixture({ scoring: 'all' })
    f.send('start', { letter: 'a' })
    for (const teamId of ['a', 'b'])
      f.send('answer', { teamId, categoryId: 'fruit', text: 'apple' })
    f.send('review')
    expect(f.state.letter).toBe('A')
    expect(f.state.scores).toEqual({ a: 10, b: 10 })
  })
  it('deadline review accepts no late edit and New Round resets scores, answers, letter', () => {
    const f = fixture()
    f.send('start')
    f.send('answer', { teamId: 'a', categoryId: 'fruit', text: 'Éclair' })
    f.send('answer', { teamId: 'b', categoryId: 'fruit', text: 'Éclair' }, 2000)
    expect(f.state.phase).toBe('review')
    expect(f.state.scores.a).toBe(10)
    const reviewed = f.state
    expect(f.send('deadline', {}, 3000)).toBe(reviewed)
    f.send('new-round')
    expect(f.state.phase).toBe('setup')
    expect(f.state.answers).toEqual({})
    expect(f.state.letter).toBe(null)
    expect(f.state.scores).toEqual({ a: 0, b: 0 })
    f.send('start')
    const active = f.state
    expect(f.send('review', { round: 1 })).toBe(active)
  })
  it('random letters use injected randomness and full replay restores baseline without config mutation', () => {
    const f = fixture({ letterMode: 'random' }),
      before = JSON.stringify(f.config)
    f.send('start', { letter: 'Z' })
    expect(f.state.letter).toBe('A')
    f.send('review')
    const initial = createScattergoriesState(f.config)
    expect(initial.letter).toBe(null)
    expect(initial.scores).toEqual({ a: 0, b: 0 })
    expect(JSON.stringify(f.config)).toBe(before)
  })
  it('recomputes reviewed scores after explicit meaning adjudication without granting a duplicate uniqueness bonus', () => {
    const f = fixture()
    f.send('start')
    f.send('answer', { categoryId: 'fruit', teamId: 'a', text: 'Éclair' })
    f.send('answer', { categoryId: 'fruit', teamId: 'b', text: 'e\u0301clair' })
    f.send('answer', { categoryId: 'place', teamId: 'a', text: 'Évora' })
    const active = f.state
    expect(f.send('adjudicate', { categoryId: 'place', teamId: 'a', valid: false })).toBe(active)
    f.send('review')
    expect(f.state.scores).toEqual({ a: 10, b: 0 })
    f.send('adjudicate', { categoryId: 'place', teamId: 'a', valid: false })
    expect(f.state.scores).toEqual({ a: 0, b: 0 })
    f.send('adjudicate', { categoryId: 'fruit', teamId: 'b', valid: false })
    expect(f.state.scores).toEqual({ a: 0, b: 0 })
    f.send('adjudicate', { categoryId: 'place', teamId: 'a', valid: true })
    expect(f.state.scores).toEqual({ a: 10, b: 0 })
    const reviewed = f.state
    expect(f.send('adjudicate', { categoryId: 'place', teamId: 'a', valid: true })).toBe(reviewed)
    expect(f.send('adjudicate', { categoryId: 'missing', teamId: 'a', valid: false })).toBe(
      reviewed
    )
    expect(f.send('adjudicate', { categoryId: 'place', teamId: 'missing', valid: false })).toBe(
      reviewed
    )
    expect(f.send('adjudicate', { categoryId: 'place', teamId: 'a', valid: 'false' })).toBe(
      reviewed
    )
    f.send('new-round')
    expect(f.state.validity).toEqual({})
  })
  it('rejects invalid identities, letters, text and stale generations without accepting review', () => {
    const f = fixture()
    expect(f.send('start', { letter: 'AB' }).error).toContain('letter')
    f.send('start')
    const active = f.state
    expect(f.send('answer', { teamId: 'missing', categoryId: 'fruit', text: 'Éclair' })).toBe(
      active
    )
    expect(f.send('answer', { teamId: 'a', categoryId: 'missing', text: 'Éclair' })).toBe(active)
    expect(f.send('answer', { teamId: 'a', categoryId: 'fruit', text: 42 })).toBe(active)
    expect(f.send('review', { generation: 9 })).toBe(active)
    expect(fixture({ teams: [] }).state.phase).toBe('no-play')
    expect(() => fixture({ categories: [] })).toThrow(/categories/)
  })
})
