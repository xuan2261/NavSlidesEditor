import { describe, expect, it } from 'vitest'
import { HISTORY_CAP, pushHistory } from './history-stack'

// Reproduces the undo/redo cap parity bug (I-R2.3): redo was capped at 20 while
// undo kept 50. With a shared helper both stacks retain the same depth, so after
// 30 edits + 30 undos all 30 redo states survive (was lost beyond 20).
describe('pushHistory — symmetric history cap', () => {
  it('keeps the most recent HISTORY_CAP entries (default 50)', () => {
    let stack = []
    for (let i = 0; i < 60; i++) stack = pushHistory(stack, i)
    expect(stack.length).toBe(HISTORY_CAP)
    // oldest retained is 60 - 50 = 10; newest is 59
    expect(stack[0]).toBe(60 - HISTORY_CAP)
    expect(stack[stack.length - 1]).toBe(59)
  })

  it('retains all 30 redo states after 30 edits (no 20-cap truncation)', () => {
    // Simulate undo pushing onto the redo stack 30 times.
    let redo = []
    for (let i = 0; i < 30; i++) redo = pushHistory(redo, `state-${i}`)
    expect(redo.length).toBe(30)
    expect(redo[0]).toBe('state-0')
    expect(redo[29]).toBe('state-29')
  })

  it('does not mutate the input stack', () => {
    const input = [1, 2, 3]
    const out = pushHistory(input, 4)
    expect(input).toEqual([1, 2, 3])
    expect(out).toEqual([1, 2, 3, 4])
  })
})
