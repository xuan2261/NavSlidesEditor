import { describe, expect, it } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { mountLivePlayer } from 'revealjs-shared'
describe('borrowed public observer renderer', () => {
  it('shows server picker winner and dice and never offers learner mutations', () => {
    let state = {
      roomInstanceId: 'r',
      generation: 1,
      roundId: 1,
      stateVersion: 1,
      gameType: 'name-picker',
      phase: 'active',
      connected: true,
      hydrated: true,
      readOnly: true,
      picker: { phase: 'result', winner: { id: 'ada', label: 'Ada' }, diceValues: [2, 5] },
      leaderboard: [],
    }
    const listeners = new Set(),
      root = document.createElement('div')
    document.body.append(root)
    const mounted = mountLivePlayer(root, {
      transport: {
        getSnapshot: () => state,
        emit: () => {
          throw new Error('observer mutation')
        },
        subscribe: (fn) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      },
    })
    try {
      expect(within(root).getByText('Selected: Ada')).toBeTruthy()
      expect(root.textContent).toContain('2 + 5')
      state = {
        ...state,
        stateVersion: 2,
        picker: { phase: 'ready', winner: null, diceValues: [] },
      }
      listeners.forEach((fn) => fn(state))
      expect(within(root).queryByText('Selected: Ada')).toBe(null)
      expect(within(root).queryByRole('button')).toBe(null)
    } finally {
      mounted.destroy()
      root.remove()
    }
  })
  it('renders canonical quiz as read-only even when observer transport accidentally implements emit', () => {
    const root = document.createElement('div')
    document.body.append(root)
    let mutations = 0
    const state = {
      gameType: 'quiz',
      generation: 1,
      roundId: 1,
      stateVersion: 1,
      phase: 'active',
      connected: true,
      hydrated: true,
      readOnly: true,
      ownEligible: false,
      leaderboard: [],
      question: { id: 'q', kind: 'fill-blank', prompt: 'Planet', points: 10, timeLimit: null },
    }
    const mounted = mountLivePlayer(root, {
      transport: {
        getSnapshot: () => state,
        emit: () => {
          mutations++
        },
        subscribe: () => () => {},
      },
    })
    try {
      const submit = within(root).getByRole('button', { name: 'Submit answer' })
      fireEvent.submit(submit.closest('form'))
      expect(submit.disabled).toBe(true)
      expect(mutations).toBe(0)
      expect(within(root).queryByText('Waiting for the next playable round.')).toBe(null)
      expect(within(root).getByText('Planet')).toBeTruthy()
    } finally {
      mounted.destroy()
      root.remove()
    }
  })
})
