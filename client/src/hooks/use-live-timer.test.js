import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLiveTimer } from './use-live-timer.js'

describe('useLiveTimer', () => {
  it('returns default state when no timer state exists', () => {
    const ref = { current: {} }
    const { result } = renderHook(() => useLiveTimer('game-1', ref))
    expect(result.current.running).toBe(false)
    expect(result.current.remaining).toBe(0)
    expect(result.current.duration).toBe(30)
    expect(result.current.endedAt).toBeNull()
  })

  it('returns server-provided state for the matching elementId', () => {
    const now = Date.now()
    const ref = {
      current: {
        'game-1': {
          elementId: 'game-1',
          remaining: 25,
          duration: 30,
          running: true,
          endedAt: now + 25000,
        },
      },
    }
    const { result } = renderHook(() => useLiveTimer('game-1', ref))
    expect(result.current.remaining).toBe(25)
    expect(result.current.duration).toBe(30)
    expect(result.current.running).toBe(true)
  })

  it('returns default for non-matching elementId', () => {
    const ref = {
      current: {
        'game-2': {
          elementId: 'game-2',
          remaining: 15,
          duration: 20,
          running: false,
          endedAt: null,
        },
      },
    }
    const { result } = renderHook(() => useLiveTimer('game-1', ref))
    expect(result.current.remaining).toBe(0)
    expect(result.current.running).toBe(false)
  })

  it('updates when ref.current changes', async () => {
    const ref = { current: {} }
    const { result } = renderHook(() => useLiveTimer('game-1', ref))

    // Manually update the ref to simulate timer:sync
    ref.current['game-1'] = {
      elementId: 'game-1',
      remaining: 10,
      duration: 30,
      running: true,
      endedAt: Date.now() + 10000,
    }

    // Wait for the interval to fire
    await act(async () => {
      await new Promise(r => setTimeout(r, 150))
    })

    // The hook should pick up the new state
    expect(result.current.remaining).toBe(10)
    expect(result.current.running).toBe(true)
  })
})
