import { describe, expect, it, vi } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { mountLivePlayer, createGameConnection } from 'revealjs-shared'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
const question = {
  id: 'q',
  kind: 'single-choice',
  prompt: 'Choose Earth',
  options: [
    { id: 'earth', text: 'Earth' },
    { id: 'mars', text: 'Mars' },
  ],
  points: 10,
  timeLimit: 30,
}
function open(gameType, fields = {}) {
  const handlers = new Map(),
    emit = vi.fn(),
    socket = {
      connected: false,
      on: (event, fn) => handlers.set(event, fn),
      off: () => {},
      emit,
      disconnect: () => {},
    }
  const transport = createGameConnection({ socket, gameId: 'g', playerName: 'Ada' })
  const receive = (event, data) => handlers.get(event)?.(data)
  receive('game-session', { ...E, gameType, playerId: transport.playerId })
  const phase = { 'four-corners': 'guessing', scattergories: 'playing' }[gameType] || 'active'
  const snapshot = {
    ...E,
    stateVersion: 1,
    phase,
    gameType,
    question,
    teams: [
      { id: 'a', name: 'Red', score: 0 },
      { id: 'b', name: 'Blue', score: 0 },
    ],
    ...fields,
  }
  receive('game-round-state', snapshot)
  const root = document.createElement('div')
  document.body.append(root)
  const mounted = mountLivePlayer(root, { transport })
  return {
    ui: within(root),
    transport,
    emit,
    update: (fields) =>
      receive('game-round-state', {
        ...snapshot,
        stateVersion: transport.getSnapshot().stateVersion + 1,
        ...fields,
      }),
    destroy: () => {
      mounted.destroy()
      transport.release()
      root.remove()
    },
  }
}
describe('four live learner games use server consensus', () => {
  it('locks accepted corner choice and shows elimination only after reveal', () => {
    const h = open('four-corners', { corners: { eliminated: [] } })
    try {
      expect(h.ui.getByRole('radio', { name: 'Mars' }).matches(':disabled')).toBe(false)
      fireEvent.click(h.ui.getByRole('radio', { name: 'Mars' }))
      fireEvent.submit(h.ui.getByRole('button', { name: 'Choose corner' }).closest('form'))
      expect(h.transport.getSnapshot().leaderboard).toEqual([])
      h.update({
        ownSubmission: { cornerId: 'mars', commandId: h.transport.getSnapshot().pending.commandId },
        corners: { eliminated: [] },
      })
      expect(h.ui.getByRole('button', { name: 'Choose corner' }).disabled).toBe(true)
      expect(h.ui.queryByText(/Correct corner/)).toBe(null)
      h.update({
        phase: 'revealed',
        ownSubmission: { cornerId: 'mars' },
        corners: { eliminated: [h.transport.playerId] },
        revealed: { question: { answerKey: { optionId: 'earth' } } },
      })
      expect(h.ui.getByText(/Eliminated/)).toBeTruthy()
    } finally {
      h.destroy()
    }
  })
  it('awards no local buzz points and unlocks typed answer for only the server winner', () => {
    const h = open('trivia-champ', {
      trivia: { mode: 'buzzer', roundConfigId: 'r1', bonus: 'lightning' },
      buzz: null,
    })
    try {
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
      fireEvent.click(h.ui.getByRole('button', { name: 'Buzz in' }))
      expect(h.transport.getSnapshot().teams[0].score).toBe(0)
      const commandId = h.transport.getSnapshot().pending.commandId
      h.update({
        buzz: { playerId: h.transport.playerId, teamId: 'a' },
        teams: [{ id: 'a', name: 'Red', score: 10 }],
        ownSubmission: { commandId },
      })
      expect(h.ui.getByRole('button', { name: 'Buzz in' }).disabled).toBe(true)
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(false)
      expect(h.ui.getByText('Red: 10')).toBeTruthy()
      h.update({ buzz: { playerId: 'other', teamId: 'b' }, ownSubmission: null })
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
    } finally {
      h.destroy()
    }
  })
  it('keeps category drafts on wrong-letter rejection and shows adjudicated public rows and absolute scores', () => {
    const h = open('scattergories', {
      question: null,
      scatter: {
        letter: 'B',
        categories: [{ id: 'animal', label: 'Animal' }],
        submitterPlayerId: null,
      },
    })
    try {
      h.update({
        scatter: {
          letter: 'B',
          categories: [{ id: 'animal', label: 'Animal' }],
          submitterPlayerId: h.transport.playerId,
        },
      })
      const input = h.ui.getByRole('textbox', { name: /Animal/ })
      expect(input.matches(':disabled')).toBe(false)
      fireEvent.input(input, { target: { value: 'Bear' } })
      fireEvent.submit(h.ui.getByRole('button', { name: 'Submit categories' }).closest('form'))
      expect(h.ui.getByRole('button', { name: 'Submit categories' }).disabled).toBe(true)
      expect(h.transport.getSnapshot().teams[0].score).toBe(0)
      h.update({
        phase: 'revealed',
        teams: [{ id: 'a', name: 'Red', score: 10 }],
        ownSubmission: { entries: [{ categoryId: 'animal', text: 'Bear' }] },
        revealed: {
          rows: [
            {
              teamId: 'a',
              categoryId: 'animal',
              text: 'Bear',
              valid: true,
              unique: false,
              points: 10,
            },
          ],
        },
      })
      expect(input.value).toBe('Bear')
      expect(h.ui.getByText(/Animal.*Bear.*duplicate.*10 points/)).toBeTruthy()
      expect(h.ui.getByText('Red: 10')).toBeTruthy()
    } finally {
      h.destroy()
    }
  })
  it.each([
    ['four-corners', 'Choose corner'],
    ['relay-race', 'Submit answer'],
    ['trivia-champ', 'Submit answer'],
    ['scattergories', 'Submit categories'],
  ])(
    'keeps late %s learner read-only until the server admits the next playable round',
    (type, label) => {
      const scatter = {
        letter: 'B',
        categories: [{ id: 'animal', label: 'Animal' }],
        submitterPlayerId: null,
      }
      const h = open(type, {
        ownEligible: false,
        scatter,
        trivia: { mode: 'buzzer' },
        turn: { turnPlayerId: null },
        buzz: null,
      })
      try {
        const submit = h.ui.getByRole('button', { name: label })
        expect(submit.disabled).toBe(true)
        fireEvent.submit(submit.closest('form'))
        expect(h.transport.getSnapshot().pending).toBe(null)
        expect(h.ui.getByText('Waiting for the next playable round.')).toBeTruthy()
        h.update({
          ownEligible: true,
          turn: { turnPlayerId: h.transport.playerId },
          buzz: { playerId: h.transport.playerId },
          scatter: { ...scatter, submitterPlayerId: h.transport.playerId },
        })
        expect(h.ui.getByRole('button', { name: label }).disabled).toBe(false)
      } finally {
        h.destroy()
      }
    }
  )
})
