import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const sockets = vi.hoisted(() => [])
vi.mock('socket.io-client', () => ({
  io: () => {
    const handlers = new Map()
    const socket = {
      connected: true,
      on: (name, fn) => handlers.set(name, fn),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
      receive: (name, payload) => handlers.get(name)?.(payload),
    }
    sockets.push(socket)
    return socket
  },
}))
import GamePlayerPage from './game-player-join-page.jsx'
const E = { gameId: 'g', roomInstanceId: 'room', generation: 1, roundId: 1 }
const question = {
  id: 'q',
  kind: 'single-choice',
  prompt: 'Pick Earth',
  points: 10,
  timeLimit: null,
  media: { src: '/uploads/planets.png', alt: 'Solar system' },
  options: [
    { id: 'mars', text: 'Mars' },
    { id: 'earth', text: 'Earth', media: { src: '/uploads/earth.png', alt: 'Blue planet' } },
  ],
}
function page(path = '/player/slide/g?name=Alice') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/player/:slideId/:elementId" element={<GamePlayerPage />} />
        <Route path="/game/join" element={<GamePlayerPage />} />
      </Routes>
    </MemoryRouter>
  )
}
function hydrate(extra = {}) {
  const socket = sockets.at(-1),
    playerId = socket.emit.mock.calls.find(([name]) => name === 'game-join')[1].playerId
  socket.receive('game-session', { ...E, playerId, gameType: 'quiz', sessionToken: 'token' })
  socket.receive('game-round-state', {
    ...E,
    stateVersion: 1,
    gameType: 'quiz',
    phase: 'active',
    question,
    ...extra,
  })
  return socket
}
describe('learner route and native form', () => {
  beforeEach(() => {
    sockets.length = 0
    localStorage.clear()
    sessionStorage.clear()
  })
  it('requires a nonblank name, trims it and retains direct join room identity', async () => {
    page('/player/slide/g')
    fireEvent.change(screen.getByRole('textbox', { name: 'Your name' }), {
      target: { value: '   ' },
    })
    fireEvent.submit(screen.getByRole('textbox').closest('form'))
    expect(screen.getByRole('alert').textContent).toContain('enter your name')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' Alice ' } })
    await act(async () => fireEvent.submit(screen.getByRole('textbox').closest('form')))
    expect(sockets.at(-1).emit.mock.calls.find(([name]) => name === 'game-join')[1]).toMatchObject({
      gameId: 'g',
      playerName: 'Alice',
    })
  })
  it('accepts the actual generated host join URL with a bounded effective transport identity', async () => {
    page('/game/join?gameId=effective-room&name=Alice')
    await act(async () => {})
    expect(sockets.at(-1).emit.mock.calls.find(([name]) => name === 'game-join')[1]).toMatchObject({
      gameId: 'effective-room',
      playerName: 'Alice',
    })
  })
  it('shows direct-link errors and reconnect restores native question media and stable answer identity', async () => {
    page()
    await act(async () => {})
    act(() => sockets[0].receive('game-error', { message: 'room-expired' }))
    expect(screen.getByText('room-expired')).toBeTruthy()
    act(() => hydrate())
    expect(screen.getByAltText('Solar system')).toBeTruthy()
    expect(screen.getByAltText('Blue planet')).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Earth Blue planet' }))
    fireEvent.submit(screen.getByRole('button', { name: 'Submit answer' }).closest('form'))
    expect(sockets[0].emit.mock.calls.find(([name]) => name === 'game-answer')[1].answer).toEqual({
      optionId: 'earth',
    })
  })
  it('keeps a disconnected submitted learner read-only and hydrates revealed result by stable ID', async () => {
    page()
    await act(async () => {})
    act(() => hydrate())
    fireEvent.click(screen.getByRole('radio', { name: 'Mars' }))
    act(() => sockets[0].receive('disconnect'))
    expect(screen.getByRole('button', { name: 'Submit answer' }).disabled).toBe(true)
    act(() =>
      sockets[0].receive('game-round-state', {
        ...E,
        stateVersion: 2,
        gameType: 'quiz',
        phase: 'revealed',
        question,
        ownSubmission: { answer: { optionId: 'mars' }, result: { correct: false, terminal: true } },
        revealed: { question: { answerKey: { optionId: 'earth' } } },
      })
    )
    expect(screen.getByText('Answer: Earth')).toBeTruthy()
  })
})
