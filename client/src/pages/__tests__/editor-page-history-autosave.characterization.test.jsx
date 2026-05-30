// Characterization: undo/redo, debounced autosave, async save-queue dedup.
// Locks CURRENT EditorPage behavior before the refactor. Observable sink:
// api.updatePresentation (autosave serializes the whole presentation).
// Red Team #10: assertions MUST flush microtasks (runAllTimersAsync), not just
// advance timers, or the async processSaveQueue re-drain is missed.
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'

const seed = {
  id: 'char-deck',
  title: 'Char Deck',
  theme: 'black',
  showPageNumbers: false,
  slides: [
    { id: 's1', background: '#101010', elements: [] },
    { id: 's2', background: '#202020', elements: [] },
  ],
}

const h = vi.hoisted(() => {
  const updatePresentation = vi.fn(() => Promise.resolve({}))
  return { updatePresentation }
})

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(() =>
      Promise.resolve(JSON.parse(JSON.stringify(seed)))
    ),
    getTemplate: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(seed)))),
    updatePresentation: h.updatePresentation,
    updateTemplate: vi.fn(() => Promise.resolve({})),
    getShareStatus: vi.fn(() => Promise.resolve({ shared: false, token: null })),
    uploadFile: vi.fn(() => Promise.resolve({ url: '/x.png' })),
  },
}))

import EditorPage from '../EditorPage.jsx'

function renderPage() {
  return render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId="char-deck" onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

beforeEach(() => {
  h.updatePresentation.mockClear()
  h.updatePresentation.mockImplementation(() => Promise.resolve({}))
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

async function loadAndGetTitle() {
  const title = await screen.findByDisplayValue('Char Deck')
  return title
}

describe('EditorPage autosave characterization', () => {
  it('debounced save fires once with normalized snapshot after a mutation', async () => {
    renderPage()
    const title = await loadAndGetTitle()

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Renamed Deck' } })
    // Bare timer advance is insufficient — flush microtasks too (#10).
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    const [, snapshot] = h.updatePresentation.mock.calls[0]
    expect(snapshot.title).toBe('Renamed Deck')
    expect(snapshot.slides).toHaveLength(2)
  })

  it('two mutations within the debounce window coalesce to a single save', async () => {
    renderPage()
    const title = await loadAndGetTitle()

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'First' } })
    vi.advanceTimersByTime(500) // still inside the 1500ms debounce
    fireEvent.change(title, { target: { value: 'Second' } })
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    expect(h.updatePresentation.mock.calls[0][1].title).toBe('Second')
  })

  it('a mutation arriving while a save is in-flight coalesces via the queue (exactly one more save, not N)', async () => {
    renderPage()
    const title = await loadAndGetTitle()

    // Hold the first save in-flight with a deferred promise.
    let releaseFirst
    const firstInFlight = new Promise((res) => {
      releaseFirst = res
    })
    h.updatePresentation.mockImplementationOnce(() => firstInFlight)

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'InFlight-1' } })
    await vi.runAllTimersAsync() // fire debounce -> save 1 starts, now awaiting

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)

    // Second mutation while save 1 is in-flight -> queued, not started.
    fireEvent.change(title, { target: { value: 'Queued-2' } })
    await vi.runAllTimersAsync()
    expect(h.updatePresentation).toHaveBeenCalledTimes(1)

    // Release save 1 -> finally{} re-drains the queue exactly once more.
    releaseFirst({})
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(2)
    expect(h.updatePresentation.mock.calls[1][1].title).toBe('Queued-2')
  })

  it('undo restores the prior snapshot after an edit', async () => {
    renderPage()
    const title = await loadAndGetTitle()

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Edited Once' } })
    // history push is debounced 500ms; advance past it + flush.
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    // Ctrl+Z on document (focus not in the title input).
    document.body.focus()
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByDisplayValue('Char Deck')).toBeTruthy()
    })
  })
})
