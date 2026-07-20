// Characterization: debounced autosave and async save-queue recovery.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'

const seed = {
  id: 'char-deck',
  title: 'Char Deck',
  theme: 'black',
  showPageNumbers: false,
  aggregateGeneration: 0,
  slides: [
    { id: 's1', background: '#101010', elements: [] },
    { id: 's2', background: '#202020', elements: [] },
  ],
}

const h = vi.hoisted(() => ({
  updatePresentation: vi.fn(() => Promise.resolve({})),
}))

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(() => Promise.resolve(structuredClone(seed))),
    getTemplate: vi.fn(() => Promise.resolve(structuredClone(seed))),
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

async function loadAndGetTitle() {
  return screen.findByDisplayValue('Char Deck')
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

describe('EditorPage autosave characterization', () => {
  it('debounced save fires once with normalized snapshot after a mutation', async () => {
    renderPage()
    const title = await loadAndGetTitle()
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Renamed Deck' } })
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    const [, snapshot] = h.updatePresentation.mock.calls[0]
    expect(snapshot.title).toBe('Renamed Deck')
    expect(snapshot.slides).toHaveLength(2)
  })

  it('coalesces two mutations within the debounce window', async () => {
    renderPage()
    const title = await loadAndGetTitle()
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'First' } })
    vi.advanceTimersByTime(500)
    fireEvent.change(title, { target: { value: 'Second' } })
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    expect(h.updatePresentation.mock.calls[0][1].title).toBe('Second')
  })

  it('coalesces a mutation arriving while a save is in-flight', async () => {
    renderPage()
    const title = await loadAndGetTitle()
    let releaseFirst
    const firstInFlight = new Promise((resolve) => {
      releaseFirst = resolve
    })
    h.updatePresentation.mockImplementationOnce(() => firstInFlight)

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'InFlight-1' } })
    await vi.runAllTimersAsync()
    expect(h.updatePresentation).toHaveBeenCalledTimes(1)

    fireEvent.change(title, { target: { value: 'Queued-2' } })
    await vi.runAllTimersAsync()
    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    releaseFirst({ aggregateGeneration: 1 })
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(2)
    expect(h.updatePresentation.mock.calls[1][1]).toMatchObject({
      title: 'Queued-2',
      aggregateGeneration: 1,
    })
  })

  it('shows failure state and retry persists the failed snapshot', async () => {
    renderPage()
    const title = await loadAndGetTitle()
    h.updatePresentation
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({})

    vi.useFakeTimers()
    await act(async () => {
      fireEvent.change(title, { target: { value: 'Needs Retry' } })
      await vi.runAllTimersAsync()
    })

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    expect(h.updatePresentation.mock.calls[0][1].title).toBe('Needs Retry')
    expect(screen.getByText('Save failed')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Retry'))
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(h.updatePresentation).toHaveBeenCalledTimes(2)
    expect(h.updatePresentation.mock.calls[1][1].title).toBe('Needs Retry')
    expect(h.updatePresentation.mock.calls[1][1].idempotencyKey).toBe(
      h.updatePresentation.mock.calls[0][1].idempotencyKey
    )
    expect(screen.getAllByLabelText('Saved').length).toBeGreaterThan(0)
  })

  it('retries a lost response before processing its queued successor', async () => {
    renderPage()
    const title = await loadAndGetTitle()
    let rejectFirst
    const firstInFlight = new Promise((_, reject) => {
      rejectFirst = reject
    })
    h.updatePresentation
      .mockImplementationOnce(() => firstInFlight)
      .mockResolvedValueOnce({ aggregateGeneration: 1 })
      .mockResolvedValueOnce({ aggregateGeneration: 2 })

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Committed, response lost' } })
    await vi.runAllTimersAsync()
    const firstBody = h.updatePresentation.mock.calls[0][1]
    fireEvent.change(title, { target: { value: 'Queued successor' } })
    await vi.runAllTimersAsync()
    rejectFirst(new Error('response lost'))
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Save failed')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Retry'))
    await vi.runAllTimersAsync()

    expect(h.updatePresentation).toHaveBeenCalledTimes(3)
    expect(h.updatePresentation.mock.calls[1][1]).toMatchObject({
      title: 'Committed, response lost',
      idempotencyKey: firstBody.idempotencyKey,
    })
    expect(h.updatePresentation.mock.calls[2][1]).toMatchObject({
      title: 'Queued successor',
      aggregateGeneration: 1,
    })
  })
})
