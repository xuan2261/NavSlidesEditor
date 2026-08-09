import React from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RemoteControlPage from './RemoteControlPage.jsx'

const mocks = vi.hoisted(() => {
  const createSocket = () => {
    const handlers = {}
    return {
      on: vi.fn((event, handler) => { handlers[event] = handler }),
      emit: vi.fn(),
      disconnect: vi.fn(),
      handlers,
    }
  }
  const socket = createSocket()
  return { createSocket, socket, socketQueue: [], roomCode: 'ROOM1' }
})

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mocks.socketQueue.shift() || mocks.socket),
}))
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ roomCode: mocks.roomCode }),
}))

describe('RemoteControlPage room lifecycle', () => {
  beforeEach(() => {
    mocks.roomCode = 'ROOM1'
    Object.keys(mocks.socket.handlers).forEach((event) => delete mocks.socket.handlers[event])
    mocks.socket.on.mockClear()
    mocks.socket.emit.mockClear()
    mocks.socket.disconnect.mockClear()
    mocks.socketQueue.length = 0
  })

  it('ignores retained callbacks from a previous room socket', async () => {
    const firstSocket = mocks.createSocket()
    const secondSocket = mocks.createSocket()
    mocks.socketQueue.push(firstSocket, secondSocket)

    const view = render(<RemoteControlPage />)
    act(() => firstSocket.handlers.connect())
    await waitFor(() => expect(view.getByText('Waiting for presenter...')).toBeTruthy())

    mocks.roomCode = 'ROOM2'
    view.rerender(<RemoteControlPage />)
    act(() => secondSocket.handlers.connect())
    await waitFor(() => expect(view.getByText('Waiting for presenter...')).toBeTruthy())

    act(() => {
      firstSocket.handlers['presentation-meta']({
        slideCount: 1,
        slides: [{ slideIndex: 0, verticalIndex: 0, label: 'stale', title: 'Stale' }],
      })
      firstSocket.handlers.navigate({ slideIndex: 8 })
      firstSocket.handlers['presenter-left']()
      firstSocket.handlers['room-ended']()
      firstSocket.handlers['viewer-count']({ count: 99 })
    })

    expect(view.queryByText(/^Slide stale$/)).toBeNull()
    expect(view.queryByText(/^Slide 9$/)).toBeNull()
    expect(view.getByText('Waiting for presenter...')).toBeTruthy()
    expect(view.queryByText('Presenter has left')).toBeNull()
    expect(view.queryByText('Session ended')).toBeNull()
    expect(view.getByTestId('remote-viewer-count').textContent).toContain('0')
  })
})
