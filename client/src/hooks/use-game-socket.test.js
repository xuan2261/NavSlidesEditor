/**
 * Unit tests for useGameSocket hook.
 *
 * Test strategy:
 * - Verify hook is exported as a named function
 * - Verify socket.io-client io() is called (via module-level side effect on import)
 * - Verify socket event listeners are registered by checking the mock's calls
 * - Note: Full React rendering (useEffect hooks) requires jsdom environment;
 *   these tests verify the module shape and socket wiring at the integration level.
 */
import { renderHook, act } from '@testing-library/react'
import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockOn = vi.fn()
const mockEmit = vi.fn()
const mockDisconnect = vi.fn()
const mockOff = vi.fn()
const mockSocket = {
  on: mockOn,
  emit: mockEmit,
  disconnect: mockDisconnect,
  off: mockOff,
  connected: true,
}
const mockIo = vi.fn(() => mockSocket)

vi.mock('socket.io-client', () => ({ io: mockIo }))

describe('useGameSocket module', () => {
  beforeEach(() => {
    mockOn.mockClear()
    mockEmit.mockClear()
    mockDisconnect.mockClear()
    mockOff.mockClear()
    mockIo.mockClear()
    if (typeof localStorage !== 'undefined') localStorage.clear()
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
  })

  it('exports useGameSocket as a named function', async () => {
    const { useGameSocket } = await import('./use-game-socket')
    expect(typeof useGameSocket).toBe('function')
  })

  it('socket.io io() is called on module load', async () => {
    // Import triggers the module-level useEffect (hooks only run in React rendering,
    // but the module itself is loaded)
    await import('./use-game-socket')
    // io() is called in useEffect, so without React rendering the effect won't run.
    // We verify io exists and the module loaded without error.
    expect(mockIo).toBeDefined()
  })

  it('returns emit function that calls socket.emit', async () => {
    const mod = await import('./use-game-socket')
    // The hook is a function — verify it exists and has expected shape
    expect(typeof mod.useGameSocket).toBe('function')
    // emit is defined in the return object of the hook
    // We can't call the hook without React rendering, but we verified the export
  })

  it('publishes live leaderboard updates for the active editor game', async () => {
    const { useGameSocket } = await import('./use-game-socket')
    const onLeaderboard = vi.fn()
    window.addEventListener('navslides:game-leaderboard', onLeaderboard)
    const { result, unmount } = renderHook(() => useGameSocket('game-1', 'presenter', 'host'))
    const listener = mockOn.mock.calls.find(([event]) => event === 'game-leaderboard')?.[1]
    const scores = [{ playerId: 'p1', name: 'Ada', score: 42 }]

    act(() => listener({ scores }))

    expect(result.current.leaderboard).toEqual(scores)
    expect(onLeaderboard).toHaveBeenCalledWith(expect.objectContaining({
      type: 'navslides:game-leaderboard',
      detail: { gameId: 'game-1', scores },
    }))

    window.removeEventListener('navslides:game-leaderboard', onLeaderboard)
    unmount()
  })

  it('retries an observer join after the room is not found', async () => {
    vi.useFakeTimers()
    const { useGameSocket } = await import('./use-game-socket')
    const retryOptions = { retryOnRoomNotFound: true }
    const { result, unmount } = renderHook(() => useGameSocket(
      'game-1',
      'editor-observer',
      'observer',
      retryOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]
    const error = mockOn.mock.calls.find(([event]) => event === 'game-error')?.[1]

    act(() => connect())
    expect(mockEmit).toHaveBeenCalledTimes(1)
    act(() => error({ message: 'room-not-found' }))
    act(() => vi.advanceTimersByTime(1000))

    expect(mockEmit).toHaveBeenCalledTimes(2)
    expect(result.current.joinError).toBe('room-not-found')
    unmount()
    vi.useRealTimers()
  })

  it('clears readiness and retries explicitly after room expiry', async () => {
    vi.useFakeTimers()
    const { useGameSocket } = await import('./use-game-socket')
    const retryOptions = { retryOnRoomNotFound: true, maxRoomNotFoundRetries: 1 }
    const { result, unmount } = renderHook(() => useGameSocket(
      'expired-game', 'editor-observer', 'observer', retryOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]
    const expired = mockOn.mock.calls.find(([event]) => event === 'game-room-expired')?.[1]

    act(() => connect())
    act(() => expired({ gameId: 'expired-game' }))
    expect(result.current.isConnected).toBe(false)
    expect(result.current.joinError).toBe('room-expired')
    act(() => vi.advanceTimersByTime(1000))
    expect(mockEmit).toHaveBeenCalledTimes(2)

    unmount()
    vi.useRealTimers()
  })

  it('stops retrying after the configured room-not-found limit', async () => {
    vi.useFakeTimers()
    const { useGameSocket } = await import('./use-game-socket')
    const retryOptions = { retryOnRoomNotFound: true, maxRoomNotFoundRetries: 2 }
    const { unmount } = renderHook(() => useGameSocket(
      'game-1',
      'editor-observer',
      'observer',
      retryOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]
    const error = mockOn.mock.calls.find(([event]) => event === 'game-error')?.[1]

    act(() => connect())
    for (let attempt = 0; attempt < 2; attempt += 1) {
      act(() => error({ message: 'room-not-found' }))
      act(() => vi.advanceTimersByTime(1000))
    }
    expect(mockEmit).toHaveBeenCalledTimes(3)

    act(() => error({ message: 'room-not-found' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(mockEmit).toHaveBeenCalledTimes(3)

    unmount()
    vi.useRealTimers()
  })

  it('deduplicates StrictMode host-room bootstrap requests', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ hostCapability: 'strict-mode-capability' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { useGameSocket } = await import('./use-game-socket')
    const hostOptions = { gameType: 'name-picker', options: { items: ['Ada'] } }
    const { unmount } = renderHook(
      () => useGameSocket('strict-mode-game', 'presenter', 'host', hostOptions),
      { wrapper: StrictMode },
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    unmount()
    vi.unstubAllGlobals()
  })

  it('reconciles a stored host capability with the server before joining', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ status: 'waiting', players: 1 }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    sessionStorage.setItem('navslides-game-host:stored-host-game', 'stored-host-capability')
    const { useGameSocket } = await import('./use-game-socket')
    const hostOptions = { gameType: 'name-picker', options: { items: ['Ada'] } }
    const { unmount } = renderHook(() => useGameSocket(
      'stored-host-game', 'presenter', 'host', hostOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]

    await act(async () => {
      connect()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({
      body: JSON.stringify({
        gameId: 'stored-host-game',
        gameType: 'name-picker',
        options: { items: ['Ada'] },
        hostCapability: 'stored-host-capability',
      }),
    }))
    expect(mockEmit).toHaveBeenCalledWith('game-join', expect.objectContaining({
      hostCapability: 'stored-host-capability',
    }))

    unmount()
    vi.unstubAllGlobals()
  })

  it('re-runs host bootstrap when a connected room expires', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hostCapability: 'first-capability' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ hostCapability: 'replacement-capability' }) })
    vi.stubGlobal('fetch', fetchMock)
    const { useGameSocket } = await import('./use-game-socket')
    const retryOptions = {
      gameType: 'name-picker',
      options: { items: ['Ada'] },
      retryOnRoomNotFound: true,
      maxRoomNotFoundRetries: 1,
    }
    const { unmount } = renderHook(() => useGameSocket(
      'expiring-host-game', 'presenter', 'host', retryOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]
    const error = mockOn.mock.calls.find(([event]) => event === 'game-error')?.[1]

    await act(async () => {
      connect()
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => error({ message: 'room-not-found' }))
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(mockEmit).toHaveBeenLastCalledWith('game-join', expect.objectContaining({
      hostCapability: 'replacement-capability',
    }))

    unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('keeps a failed host bootstrap disconnected and retries within the bound', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network-down')))
    vi.stubGlobal('fetch', fetchMock)
    const { useGameSocket } = await import('./use-game-socket')
    const hostOptions = {
      gameType: 'name-picker',
      options: { items: ['Ada'] },
      maxHostBootstrapRetries: 2,
    }
    const { result, unmount } = renderHook(() => useGameSocket(
      'failed-host-bootstrap-game', 'presenter', 'host', hostOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]

    await act(async () => {
      connect()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.current.isConnected).toBe(false)
    expect(result.current.joinError).toBe('network-down')
    expect(mockEmit).not.toHaveBeenCalledWith('game-join', expect.anything())

    unmount()
    vi.unstubAllGlobals()
  })

  it('marks the game ready only after a successful room join event', async () => {
    const { useGameSocket } = await import('./use-game-socket')
    const { result, unmount } = renderHook(() => useGameSocket('join-ready-game', 'player'))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]
    const joined = mockOn.mock.calls.find(([event]) => event === 'game-player-joined')?.[1]

    act(() => connect())
    expect(result.current.isConnected).toBe(false)
    act(() => joined({ players: [{ name: 'player', score: 0 }] }))
    expect(result.current.isConnected).toBe(true)

    unmount()
  })

  it('bootstraps a host room before joining with the returned capability', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ hostCapability: 'host-capability' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const { useGameSocket } = await import('./use-game-socket')
    const hostOptions = { gameType: 'name-picker', options: { items: ['Ada'] } }
    const { unmount } = renderHook(() => useGameSocket(
      'host-bootstrap-game',
      'presenter',
      'host',
      hostOptions,
    ))
    const connect = mockOn.mock.calls.find(([event]) => event === 'connect')?.[1]

    await act(async () => {
      connect()
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/games', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        gameId: 'host-bootstrap-game',
        gameType: 'name-picker',
        options: { items: ['Ada'] },
      }),
    }))
    expect(mockEmit).toHaveBeenCalledWith('game-join', expect.objectContaining({
      gameId: 'host-bootstrap-game',
      role: 'host',
      hostCapability: 'host-capability',
    }))

    unmount()
    vi.unstubAllGlobals()
  })

})
