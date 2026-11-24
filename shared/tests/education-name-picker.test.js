import { describe, expect, it } from 'vitest'
import { createDefaultGameConfig } from '../src/education/game-defaults.js'
import { createNamePickerState, reduceNamePicker } from '../src/education/games/name-picker.js'

const config = () => ({
  ...createDefaultGameConfig('name-picker'),
  weighted: true,
  items: [
    { id: 'a', label: 'An', weight: 1 },
    { id: 'b', label: 'Bình', weight: 3 },
  ],
})
const pick = (cfg, state, random = () => 0.3) => {
  const pending = reduceNamePicker(cfg, state, { type: 'pick' }, { random })
  return reduceNamePicker(cfg, pending, { type: 'resolve' })
}

describe('shared name-picker rules', () => {
  it.each(['wheel', 'dice', 'button'])('uses the canonical weighted pool in %s mode', (mode) => {
    const cfg = { ...config(), pickerMode: mode, diceCount: 4 }
    const before = structuredClone(cfg)
    const state = pick(cfg, createNamePickerState(cfg))
    expect(state.lastWinner).toEqual({ id: 'b', label: 'Bình' })
    expect(state.picks).toBe(1)
    if (mode === 'dice') expect(state.diceValues).toEqual([2, 2, 2, 2])
    expect(cfg).toEqual(before)
  })
  it('excludes stable winner IDs, exhausts honestly and starts a fresh replay pool', () => {
    const cfg = config()
    const first = pick(cfg, createNamePickerState(cfg))
    const last = pick(cfg, first)
    expect(last.lastWinner.id).toBe('a')
    expect(last.excludedIds).toEqual(['b', 'a'])
    expect(last.phase).toBe('exhausted')
    expect(reduceNamePicker(cfg, last, { type: 'pick' }, { random: () => 0 })).toBe(last)
    expect(pick(cfg, createNamePickerState(cfg)).lastWinner.id).toBe('b')
  })
  it('does not exclude repeatable pools and cannot resolve or pick twice while pending', () => {
    const cfg = { ...config(), excludeAfterPick: false }
    const initial = createNamePickerState(cfg)
    expect(reduceNamePicker(cfg, initial, { type: 'resolve' })).toBe(initial)
    const pending = reduceNamePicker(cfg, initial, { type: 'pick' }, { random: () => 0 })
    expect(reduceNamePicker(cfg, pending, { type: 'pick' }, { random: () => 0.9 })).toBe(pending)
    const result = reduceNamePicker(cfg, pending, { type: 'resolve' })
    expect(result.excludedIds).toEqual([])
    expect(pick(cfg, result, () => 0).lastWinner.id).toBe('a')
  })
  it('changes the presentation mode without restoring excluded names or changing saved configuration', () => {
    const cfg = config(),
      before = structuredClone(cfg)
    const first = pick(cfg, createNamePickerState(cfg))
    const dice = reduceNamePicker(cfg, first, { type: 'mode', mode: 'dice' })
    expect(dice).toMatchObject({ mode: 'dice', picks: 1, excludedIds: ['b'] })
    expect(pick(cfg, dice, () => 0).lastWinner.id).toBe('a')
    expect(cfg).toEqual(before)
  })
})
