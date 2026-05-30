// Characterization: slide CRUD (add/delete/duplicate). Locks CURRENT behavior.
// Observable sink: api.updatePresentation (autosave snapshot).
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'

function makeSeed() {
  return {
    id: 'char-deck',
    title: 'Char Deck',
    theme: 'black',
    showPageNumbers: false,
    slides: [
      { id: 's1', background: { type: 'color', color: '#123456' }, elements: [] },
      { id: 's2', background: { type: 'color', color: '#202020' }, elements: [] },
    ],
  }
}

const h = vi.hoisted(() => ({
  updatePresentation: vi.fn(() => Promise.resolve({})),
  seed: null,
}))

vi.mock('../../utils/api', () => ({
  api: {
    getPresentation: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(h.seed)))),
    getTemplate: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(h.seed)))),
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

function lastSaved() {
  const calls = h.updatePresentation.mock.calls
  return calls.length ? calls[calls.length - 1][1] : null
}

beforeEach(() => {
  h.seed = makeSeed()
  h.updatePresentation.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})

afterEach(() => {
  vi.useRealTimers()
})

async function addSlideViaModal() {
  // "Add Slide" opens the template picker; pick "Blank" to add.
  const addBtn = await screen.findByRole('button', { name: /Add Slide/i })
  await act(async () => {
    fireEvent.click(addBtn)
  })
  const blankTile = await screen.findByText('Blank')
  await act(async () => {
    fireEvent.click(blankTile)
  })
}

describe('EditorPage slide-ops characterization', () => {
  it('adds a slide inheriting the current background', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await addSlideViaModal()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        expect(snap.slides).toHaveLength(3)
        // addSlide(key) with no afterIndex appends at the end; the new slide
        // inherits the current (first) slide's background object.
        expect(snap.slides[2].background).toEqual({ type: 'color', color: '#123456' })
      },
      { timeout: 2500 }
    )
  })

  it('keeps slide ids unique after adding', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await addSlideViaModal()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        const ids = snap.slides.map((s) => s.id)
        expect(new Set(ids).size).toBe(ids.length)
      },
      { timeout: 2500 }
    )
  })
})
