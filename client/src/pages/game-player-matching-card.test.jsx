import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LivePlayerAdapter } from '../components/education/live-player-adapter.jsx'
import { createLivePlayerState, reduceLivePlayerState } from 'revealjs-shared'
const E = { gameId: 'g', roomInstanceId: 'r', generation: 1, roundId: 1 }
const matching = {
  prompt: 'Match terms',
  prompts: [
    { id: 'http', text: 'HTTP' },
    { id: 'tls', text: 'TLS' },
  ],
  targets: [
    { id: 'security', text: 'Security' },
    { id: 'protocol', text: 'Protocol' },
  ],
}
function connection() {
  let state = reduceLivePlayerState(createLivePlayerState('g'), 'game-session', {
    ...E,
    playerId: 'p',
  })
  state = reduceLivePlayerState(state, 'game-round-state', {
    ...E,
    gameType: 'matching',
    phase: 'active',
    stateVersion: 1,
    matching,
  })
  const listeners = new Set()
  return {
    getSnapshot: () => state,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    setDraft: (draft) => {
      state = { ...state, draft }
      listeners.forEach((fn) => fn(state))
    },
    emit: (event, payload) => {
      state = { ...state, pending: { commandId: 'c' }, draft: payload }
      listeners.forEach((fn) => fn(state))
      return true
    },
    receive: (data) => {
      state = reduceLivePlayerState(state, 'game-round-state', data)
      listeners.forEach((fn) => fn(state))
    },
  }
}
describe('native Matching adapter', () => {
  it('retains stable prompt-target assignments, forbids duplicate pending activation and reveals actual mapping', () => {
    const transport = connection()
    render(<LivePlayerAdapter connection={transport} />)
    fireEvent.click(screen.getByRole('button', { name: 'HTTP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Protocol' }))
    fireEvent.click(screen.getByRole('button', { name: 'TLS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Security' }))
    fireEvent.submit(screen.getByRole('button', { name: 'Submit matches' }).closest('form'))
    expect(transport.getSnapshot().draft.pairs).toEqual([
      { promptId: 'http', targetId: 'protocol' },
      { promptId: 'tls', targetId: 'security' },
    ])
    expect(screen.getByRole('button', { name: 'Submit matches' }).disabled).toBe(true)
    act(() =>
      transport.receive({
        ...E,
        stateVersion: 2,
        phase: 'revealed',
        gameType: 'matching',
        matching,
        ownSubmission: { pairs: transport.getSnapshot().draft.pairs, score: 2, total: 2 },
        revealed: {
          answerKey: [
            { promptId: 'http', targetId: 'protocol' },
            { promptId: 'tls', targetId: 'security' },
          ],
        },
      })
    )
    expect(screen.getByText('HTTP → Protocol')).toBeTruthy()
    expect(screen.getByText('TLS → Security')).toBeTruthy()
  })
  it('requires clearing an occupied target before reassignment through native click and keyboard', () => {
    const transport = connection()
    render(<LivePlayerAdapter connection={transport} />)
    const http = screen.getByRole('button', { name: 'HTTP' })
    fireEvent.click(http)
    fireEvent.click(screen.getByRole('button', { name: 'Protocol' }))
    fireEvent.click(screen.getByRole('button', { name: 'TLS' }))
    expect(screen.getByRole('button', { name: 'Protocol' }).disabled).toBe(true)
    expect(transport.getSnapshot().draft.pairs).toEqual([
      { promptId: 'http', targetId: 'protocol' },
    ])
    fireEvent.click(screen.getByRole('button', { name: 'Clear HTTP' }))
    fireEvent.click(screen.getByRole('button', { name: 'TLS' }))
    fireEvent.click(screen.getByRole('button', { name: 'Protocol' }))
    expect(transport.getSnapshot().draft.pairs).toEqual([{ promptId: 'tls', targetId: 'protocol' }])
    http.focus()
    fireEvent.keyDown(http, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'TLS' }))
  })
})
