// Characterization: undo/redo history state and dirty-save affordance.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
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
    getPresentation: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(seed)))),
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
  localStorage.clear()
  h.updatePresentation.mockClear()
  h.updatePresentation.mockImplementation(() => Promise.resolve({}))
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EditorPage history characterization', () => {
  it('undo restores the prior snapshot after an edit', async () => {
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Edited Once' } })
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    title.blur()
    document.body.focus()
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true })
    await waitFor(() => {
      expect(screen.getByDisplayValue('Char Deck')).toBeTruthy()
    })
  })

  it('redo restores an undone edit and keeps the save affordance dirty', async () => {
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Redo Target' } })
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    title.blur()
    document.body.focus()
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true })
    await waitFor(() => {
      expect(screen.getByDisplayValue('Char Deck')).toBeTruthy()
    })
    fireEvent.keyDown(document, { key: 'y', ctrlKey: true })
    await waitFor(() => {
      expect(screen.getByDisplayValue('Redo Target')).toBeTruthy()
    })
    await waitFor(
      () => expect(screen.getByTitle('Save (Ctrl+S)')).toBeTruthy(),
      { timeout: 6000 }
    )
  })
})
