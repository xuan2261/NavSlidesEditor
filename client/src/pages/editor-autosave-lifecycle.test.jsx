// Lifecycle guarantees for the editor's autosave + undo history:
//  - a still-debounced edit is persisted on unmount and on tab-close (PUT,
//    keepalive) instead of being silently dropped;
//  - switching presentations drains the outgoing deck's pending save first;
//  - a freshly loaded deck leaves Undo disabled (no phantom history entry),
//    while the first real edit does enable it;
//  - a rejected save does not hot-loop and resends on the next edit;
//  - the undo history never grows past its cap.
import { act, render, fireEvent, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LiveSocketContext } from '../contexts/live-socket-context-provider.jsx'
import { api } from '../utils/api'

function deck(id, title) {
  return {
    id,
    title,
    theme: 'black',
    showPageNumbers: false,
    slides: [
      { id: 's1', background: '#101010', elements: [] },
      { id: 's2', background: '#202020', elements: [] },
    ],
  }
}

const h = vi.hoisted(() => ({ updatePresentation: vi.fn(() => Promise.resolve({})) }))

vi.mock('../utils/api', () => ({
  api: {
    // Echo the requested id so A->B navigation returns distinct decks.
    getPresentation: vi.fn((id) => Promise.resolve(deck(id, `Deck ${id}`))),
    getTemplate: vi.fn((id) => Promise.resolve(deck(id, `Deck ${id}`))),
    updatePresentation: h.updatePresentation,
    updateTemplate: vi.fn(() => Promise.resolve({})),
    getShareStatus: vi.fn(() => Promise.resolve({ shared: false, token: null })),
    uploadFile: vi.fn(() => Promise.resolve({ url: '/uploads/x.png' })),
  },
}))

import EditorPage from './EditorPage.jsx'

function renderPage(presentationId = 'deck-a') {
  return render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId={presentationId} onGoHome={() => {}} />
    </LiveSocketContext.Provider>,
    { wrapper: undefined }
  )
}

let fetchMock

beforeEach(() => {
  localStorage.clear()
  h.updatePresentation.mockClear()
  h.updatePresentation.mockImplementation(() => Promise.resolve({}))
  fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
  globalThis.fetch = fetchMock
  // Expose the live history length so undo state is observable in jsdom.
  window.__E2E__ = true
  window.__NAVSLIDES_E2E_HISTORY_LENGTH = undefined
})

afterEach(() => {
  vi.useRealTimers()
  delete window.__E2E__
  delete window.__NAVSLIDES_E2E_HISTORY_LENGTH
})

// PUT save requests issued by the teardown flush (excludes unrelated fetches).
function teardownSaveCalls() {
  return fetchMock.mock.calls.filter(([, opts]) => opts?.method === 'PUT')
}

describe('editor teardown persistence', () => {
  it('flushes a still-debounced edit on unmount via a keepalive PUT', async () => {
    const { unmount } = renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    // Edit, then leave BEFORE the 1.5s autosave debounce elapses.
    fireEvent.change(title, { target: { value: 'Unsaved Edit' } })
    act(() => unmount())

    const puts = teardownSaveCalls()
    expect(puts).toHaveLength(1)
    const [url, opts] = puts[0]
    expect(url).toBe('/api/presentations/deck-a')
    expect(opts.keepalive).toBe(true)
    expect(JSON.parse(opts.body).title).toBe('Unsaved Edit')
  })

  it('flushes a still-debounced edit when the tab is closing', async () => {
    renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    fireEvent.change(title, { target: { value: 'Closing Edit' } })
    act(() => {
      window.dispatchEvent(new Event('beforeunload'))
    })

    const puts = teardownSaveCalls()
    expect(puts.length).toBeGreaterThanOrEqual(1)
    expect(puts[0][0]).toBe('/api/presentations/deck-a')
    expect(JSON.parse(puts[0][1].body).title).toBe('Closing Edit')
  })

  it('drains the outgoing presentation save before loading another', async () => {
    const { rerender } = renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    fireEvent.change(title, { target: { value: 'A Pending' } })

    // Switch presentations (same component instance, route param change).
    await act(async () => {
      rerender(
        <LiveSocketContext.Provider value={null}>
          <EditorPage presentationId="deck-b" onGoHome={() => {}} />
        </LiveSocketContext.Provider>
      )
    })

    const puts = teardownSaveCalls()
    expect(puts).toHaveLength(1)
    expect(puts[0][0]).toBe('/api/presentations/deck-a')
    expect(JSON.parse(puts[0][1].body).title).toBe('A Pending')
  })

  it('blocks editing the outgoing deck while the next route is loading', async () => {
    let resolveB
    api.getPresentation
      .mockImplementationOnce((id) => Promise.resolve(deck(id, `Deck ${id}`)))
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          })
      )

    const { rerender } = renderPage('deck-a')
    await screen.findByDisplayValue('Deck deck-a')

    await act(async () => {
      rerender(
        <LiveSocketContext.Provider value={null}>
          <EditorPage presentationId="deck-b" onGoHome={() => {}} />
        </LiveSocketContext.Provider>
      )
      await Promise.resolve()
    })

    expect(screen.getByText('Loading...')).toBeTruthy()
    expect(screen.queryByDisplayValue('Deck deck-a')).toBeNull()

    await act(async () => {
      resolveB(deck('deck-b', 'Deck deck-b'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(await screen.findByDisplayValue('Deck deck-b')).toBeTruthy()
  })
})

describe('editor undo history seeding', () => {
  it('leaves history at one entry on a fresh load (Undo disabled, no edits)', async () => {
    renderPage('deck-a')
    await screen.findByDisplayValue('Deck deck-a')
    // Advance well past the 500ms history-push debounce: a fresh load must NOT
    // schedule a duplicate snapshot of the just-seeded state.
    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(1000)
    expect(window.__NAVSLIDES_E2E_HISTORY_LENGTH).toBe(1)
  })

  it('records the first edit so Undo becomes available (no swallowed first undo)', async () => {
    renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'First Real Edit' } })
    await vi.runAllTimersAsync()

    expect(window.__NAVSLIDES_E2E_HISTORY_LENGTH).toBe(2)
  })
})

describe('editor save failure recovery', () => {
  it('does not hot-loop a rejected save and retries it before the next edit', async () => {
    const { unmount } = renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    h.updatePresentation.mockRejectedValueOnce(new Error('validation rejected'))

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.change(title, { target: { value: 'Will Fail' } })
      await vi.runAllTimersAsync()
    })

    // Exactly one attempt; the rejection must not re-fire on its own.
    expect(h.updatePresentation).toHaveBeenCalledTimes(1)

    // Idle time passes — still no extra attempts (no backoff hot-loop).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(h.updatePresentation).toHaveBeenCalledTimes(1)

    const failedBody = h.updatePresentation.mock.calls[0][1]

    // A new edit retries the uncertain write with the same idempotency key,
    // then saves the successor against the generation accepted by the retry.
    await act(async () => {
      fireEvent.change(title, { target: { value: 'Second Try' } })
      await vi.runAllTimersAsync()
    })
    expect(h.updatePresentation).toHaveBeenCalledTimes(3)
    expect(h.updatePresentation.mock.calls[1][1].title).toBe('Will Fail')
    expect(h.updatePresentation.mock.calls[1][1].idempotencyKey).toBe(
      failedBody.idempotencyKey,
    )
    expect(h.updatePresentation.mock.calls[2][1].title).toBe('Second Try')

    vi.useRealTimers()
    act(() => unmount())
    // The queue is clean after both writes succeed, so teardown emits no PUT.
    expect(teardownSaveCalls()).toHaveLength(0)
  })

  it('retains a rejected snapshot so teardown still persists it', async () => {
    const { unmount } = renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    h.updatePresentation.mockRejectedValue(new Error('validation rejected'))

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.change(title, { target: { value: 'Lost If Discarded' } })
      await vi.runAllTimersAsync()
    })
    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    vi.useRealTimers()

    // Leaving after a failed save must NOT drop the edit — the dirty snapshot
    // is flushed on teardown.
    act(() => unmount())
    const puts = teardownSaveCalls()
    expect(puts).toHaveLength(1)
    expect(JSON.parse(puts[0][1].body).title).toBe('Lost If Discarded')
  })
})

describe('editor undo history cap', () => {
  it('never grows past fifty entries', async () => {
    renderPage('deck-a')
    const title = await screen.findByDisplayValue('Deck deck-a')

    vi.useFakeTimers()
    // Each edit is spaced past the 500ms history debounce to force a push.
    for (let i = 0; i < 55; i += 1) {
      fireEvent.change(title, { target: { value: `edit-${i}` } })
      await vi.advanceTimersByTimeAsync(600)
      expect(window.__NAVSLIDES_E2E_HISTORY_LENGTH).toBeLessThanOrEqual(50)
    }
    expect(window.__NAVSLIDES_E2E_HISTORY_LENGTH).toBe(50)
  })
})
