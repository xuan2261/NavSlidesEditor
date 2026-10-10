import { describe, expect, it } from 'vitest'
import { within } from '@testing-library/react'
import { mountLivePlayer } from 'revealjs-shared'
describe('Jeopardy learner public state', () => {
  it('shows used cells and host-owned clue/wager/reveal without answer controls or local adjudication', () => {
    const question = {
      id: 'q',
      kind: 'single-choice',
      prompt: 'Capital?',
      options: [{ id: 'paris', text: 'Paris' }],
      points: 100,
      timeLimit: null,
    }
    let state = {
      connected: true,
      hydrated: true,
      generation: 1,
      roundId: 1,
      stateVersion: 1,
      phase: 'active',
      gameType: 'jeopardy',
      question,
      jeopardy: {
        cells: [{ cellId: 'cell', categoryId: 'Geography', points: 100, used: false }],
        activeCellId: 'cell',
        isDailyDouble: true,
        wager: 200,
      },
      turn: { activeTeamId: 'a' },
      teams: [{ id: 'a', name: 'Red', score: 0 }],
      leaderboard: [],
    }
    const listeners = new Set(),
      root = document.createElement('div')
    document.body.append(root)
    const transport = {
      getSnapshot: () => state,
      emit: () => {
        throw new Error('learner cannot adjudicate')
      },
      subscribe: (fn) => {
        listeners.add(fn)
        return () => listeners.delete(fn)
      },
    }
    const mounted = mountLivePlayer(root, { transport }),
      ui = within(root)
    try {
      expect(ui.getByRole('heading', { name: 'Capital?' })).toBeTruthy()
      expect(root.textContent).toContain('Daily Double wager: 200')
      expect(ui.queryByRole('button', { name: /Submit|Adjudicate/ })).toBe(null)
      state = {
        ...state,
        stateVersion: 2,
        phase: 'revealed',
        revealed: {
          question: { answerKey: { optionId: 'paris' }, explanation: 'Paris is the capital.' },
        },
        jeopardy: { ...state.jeopardy, cells: [{ ...state.jeopardy.cells[0], used: true }] },
        teams: [{ id: 'a', name: 'Red', score: 200 }],
      }
      listeners.forEach((fn) => fn(state))
      expect(ui.getByText('Answer: Paris')).toBeTruthy()
      expect(root.textContent).toContain('used')
      expect(ui.getByText('Red: 200')).toBeTruthy()
    } finally {
      mounted.destroy()
      root.remove()
    }
  })
})
