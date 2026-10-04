import { describe, expect, it } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { mountLivePlayer, createGameConnection } from 'revealjs-shared'
function mount(question, extra = {}) {
  const handlers = new Map(),
    sent = []
  const socket = {
    connected: false,
    on: (event, fn) => handlers.set(event, fn),
    off: () => {},
    emit: (event, payload) => sent.push([event, payload]),
    disconnect: () => {},
  }
  const transport = createGameConnection({
    socket,
    gameId: 'g',
    playerName: 'Ada',
    id: (() => {
      let n = 0
      return () => `id-${++n}`
    })(),
  })
  const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
  handlers.get('game-session')({
    ...E,
    playerId: transport.playerId,
    gameType: 'quiz',
    sessionToken: 'token',
  })
  handlers.get('game-round-state')({
    ...E,
    gameType: 'quiz',
    phase: 'active',
    stateVersion: 1,
    question,
    quiz: { attemptLimit: 2, showScore: true, feedbackMode: 'immediate' },
    ...extra,
  })
  const root = document.createElement('div')
  document.body.append(root)
  const presenter = mountLivePlayer(root, { transport })
  return {
    ui: within(root),
    transport,
    answer: () => sent.find(([event]) => event === 'game-answer')?.[1],
    receive: (event, payload) => handlers.get(event)?.(payload),
    E,
    destroy: () => {
      presenter.destroy()
      transport.release()
      root.remove()
    },
  }
}
const options = [
  { id: 'a', text: 'Alpha' },
  { id: 'b', text: 'Beta' },
]
const q = (kind) => ({
  id: 'q',
  kind,
  prompt: 'Choose',
  points: 10,
  timeLimit: null,
  ...(['single-choice', 'multi-choice', 'ordering'].includes(kind) ? { options } : {}),
})
const scenarios = [
  [
    'single-choice',
    q('single-choice'),
    (ui) => fireEvent.click(ui.getByRole('radio', { name: 'Beta' })),
    { optionId: 'b' },
  ],
  [
    'multi-choice',
    q('multi-choice'),
    (ui) => {
      fireEvent.click(ui.getByRole('checkbox', { name: 'Alpha' }))
      fireEvent.click(ui.getByRole('checkbox', { name: 'Beta' }))
    },
    { optionIds: ['a', 'b'] },
  ],
  [
    'true-false',
    q('true-false'),
    (ui) => fireEvent.click(ui.getByRole('radio', { name: 'False' })),
    { value: false },
  ],
  [
    'fill-blank',
    q('fill-blank'),
    (ui) => fireEvent.input(ui.getByRole('textbox'), { target: { value: 'Earth' } }),
    { text: 'Earth' },
  ],
  [
    'ordering',
    q('ordering'),
    (ui) => fireEvent.click(ui.getByRole('button', { name: 'Move Beta up' })),
    { itemIds: ['b', 'a'] },
  ],
  [
    'matching',
    {
      ...q('matching'),
      options: { left: [{ id: 'l', text: 'Left' }], right: [{ id: 'r', text: 'Right' }] },
    },
    (ui) => {
      fireEvent.click(ui.getByRole('button', { name: 'Left' }))
      fireEvent.click(ui.getByRole('button', { name: 'Right' }))
    },
    { pairs: [{ leftId: 'l', rightId: 'r' }] },
  ],
  [
    'image-hotspot',
    {
      ...q('image-hotspot'),
      media: { src: '/uploads/map.png', alt: 'Map' },
      options: [{ id: 'zone', text: 'Zone' }],
    },
    (ui) => fireEvent.change(ui.getByRole('combobox'), { target: { value: 'zone' } }),
    { mode: 'region', regionId: 'zone' },
  ],
]
describe('typed learner controls and authoritative attempts', () => {
  it.each(scenarios)(
    '%s completes native submission with canonical answer and no local points',
    (kind, question, interact, answer) => {
      const h = mount(question)
      try {
        interact(h.ui)
        fireEvent.submit(h.ui.getByRole('button', { name: 'Submit answer' }).closest('form'))
        expect(h.answer().answer).toEqual(answer)
        expect(h.transport.getSnapshot().leaderboard).toEqual([])
        expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
        h.receive('game-command-result', {
          ...h.E,
          stateVersion: 1,
          commandId: h.answer().commandId,
          accepted: true,
          result: { valid: true, correct: false, attemptsUsed: 1, terminal: false },
        })
        expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(false)
        expect(h.transport.getSnapshot().draft.answer).toEqual(answer)
        fireEvent.submit(h.ui.getByRole('button', { name: 'Submit answer' }).closest('form'))
        const pending = h.transport.getSnapshot().pending
        h.receive('game-command-result', {
          ...h.E,
          stateVersion: 1,
          commandId: pending.commandId,
          accepted: true,
          result: { valid: true, correct: false, attemptsUsed: 2, terminal: true },
        })
        expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
        expect(h.ui.getByText('Attempts: 2 / 2')).toBeTruthy()
      } finally {
        h.destroy()
      }
    }
  )
  it('hydrates accepted hotspot point without creating any evaluator or exposing an answer key', () => {
    const question = {
      ...q('image-hotspot'),
      media: { src: '/uploads/map.png', alt: 'Map' },
      options: [{ id: 'zone', text: 'Zone' }],
    }
    const h = mount(question, {
      ownSubmission: {
        answer: { mode: 'point', x: 0.25, y: 0.75 },
        result: { terminal: true, correct: true },
      },
    })
    try {
      expect(h.ui.getByText(/25%.*75%/)).toBeTruthy()
      expect(h.ui.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
      expect(h.transport.getSnapshot().revealed).toBeUndefined()
    } finally {
      h.destroy()
    }
  })
})
