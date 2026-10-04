import { describe, expect, it, vi } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { mountLivePlayer } from 'revealjs-shared'
function harness(extra) {
  let state = {
    gameId: 'g',
    roomInstanceId: 'r',
    generation: 1,
    roundId: 1,
    stateVersion: 1,
    phase: 'active',
    connected: true,
    hydrated: true,
    playerId: 'p',
    leaderboard: [],
    ...extra,
  }
  const listeners = new Set(),
    emit = vi.fn(() => true)
  const transport = {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    emit,
    setDraft: (value) => {
      state = { ...state, draft: value }
    },
  }
  const root = document.createElement('div')
  document.body.append(root)
  const presenter = mountLivePlayer(root, { transport })
  return {
    root,
    ui: within(root),
    emit,
    update: (data) => {
      state = { ...state, ...data }
      listeners.forEach((fn) => fn(state))
    },
    destroy: () => {
      presenter.destroy()
      root.remove()
    },
  }
}
const question = {
  id: 'q',
  kind: 'fill-blank',
  prompt: 'Name a planet',
  timeLimit: null,
  points: 10,
}
describe('native learner controls', () => {
  it('retains draft and focus through pending, invalid and disconnect without duplicate native submission', () => {
    const h = harness({ gameType: 'quiz', question })
    const input = h.ui.getByRole('textbox')
    input.focus()
    fireEvent.input(input, { target: { value: 'Earth' } })
    fireEvent.submit(input.closest('form'))
    h.update({ pending: { commandId: 'c' } })
    fireEvent.submit(input.closest('form'))
    expect(h.emit).toHaveBeenCalledTimes(1)
    h.update({ connected: false })
    expect(input.value).toBe('Earth')
    h.update({
      connected: true,
      pending: null,
      receipt: { accepted: false, error: 'invalid-answer' },
    })
    expect(input.disabled).toBe(false)
    expect(input.value).toBe('Earth')
    expect(document.activeElement).toBe(input)
    h.destroy()
  })
  it('clears draft on generation replacement and ignores private keys before reveal', () => {
    const h = harness({ gameType: 'quiz', question })
    fireEvent.input(h.ui.getByRole('textbox'), { target: { value: 'Earth' } })
    h.update({
      generation: 2,
      roundId: 0,
      question: { ...question, id: 'next' },
      ownSubmission: null,
      draft: null,
    })
    expect(h.ui.getByRole('textbox').value).toBe('')
    expect(h.root.textContent).not.toContain('Earth')
    h.destroy()
  })
  it('prevents relay nonholders from submitting and reflects only server positions', () => {
    const h = harness({
      gameType: 'relay-race',
      question,
      turn: { turnPlayerId: 'other', activeTeamId: 'team' },
      relay: { positions: { team: 2 }, goal: 5 },
    })
    expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
    h.update({ turn: { turnPlayerId: 'p', activeTeamId: 'team' } })
    expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(false)
    fireEvent.submit(h.ui.getByRole('textbox').closest('form'))
    expect(h.root.textContent).toContain('2 / 5')
    h.destroy()
  })
  it('hydrates cloud quota and restores editable text after rejection', () => {
    const h = harness({
      gameType: 'word-cloud',
      wordCloud: { prompt: 'Ideas', words: [], maxPhraseLength: 40, maxSubmissionsPerPlayer: 2 },
      ownSubmission: { count: 2 },
    })
    expect(h.ui.getByRole('button', { name: 'Submit word' }).disabled).toBe(true)
    h.update({ ownSubmission: { count: 1 }, receipt: { error: 'invalid-text' } })
    expect(h.ui.getByRole('button', { name: 'Submit word' }).disabled).toBe(false)
    h.destroy()
  })
  it('keeps after-question acceptance neutral then shows the authoritative revealed grade over its old pending receipt', () => {
    const pending = {
      accepted: true,
      valid: true,
      attemptsUsed: 1,
      terminal: false,
      questionId: 'q',
      attemptId: 'a',
    }
    const h = harness({
      gameType: 'quiz',
      question,
      quiz: { feedbackMode: 'after-question', attemptLimit: 2, showScore: false },
      receipt: { commandId: 'c', result: pending },
      ownSubmission: { commandId: 'c', attemptId: 'a', answer: { text: 'Mars' }, result: pending },
    })
    try {
      expect(h.ui.getByText('Answer received.')).toBeTruthy()
      expect(h.ui.queryByText(/Incorrect/)).toBe(null)
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(false)
      h.update({
        phase: 'revealed',
        stateVersion: 2,
        ownSubmission: {
          commandId: 'c',
          attemptId: 'a',
          answer: { text: 'Mars' },
          result: { ...pending, correct: false },
        },
      })
      expect(h.ui.getByText('Incorrect.', { exact: true })).toBeTruthy()
      expect(h.ui.queryByText('Answer received.')).toBe(null)
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
    } finally {
      h.destroy()
    }
  })
  it('keeps a newer invalid retry observable while an accepted terminal submission remains locked', () => {
    const h = harness({
      gameType: 'quiz',
      question,
      quiz: { feedbackMode: 'immediate', attemptLimit: 2, showScore: true },
      ownSubmission: {
        commandId: 'old',
        attemptId: 'a1',
        result: { valid: true, correct: true, terminal: true, attemptsUsed: 1 },
      },
      receipt: {
        commandId: 'new',
        result: { valid: false, terminal: false, attemptsUsed: 1, attemptId: 'a2' },
      },
    })
    try {
      expect(h.ui.getByText('Invalid answer. Please edit and try again.')).toBeTruthy()
      expect(h.ui.queryByText('Correct.', { exact: true })).toBe(null)
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
    } finally {
      h.destroy()
    }
  })
})
