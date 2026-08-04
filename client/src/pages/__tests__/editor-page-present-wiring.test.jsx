// Phase 2 guard: locks the present-wiring split.
// (a) WITHOUT a game element, the dead presentation-scope keys (B/W/F5) produce
//     no overlay and don't crash — they are scope-filtered out in editor mode.
// (b) WITH a game element on the slide, activeGameType is truthy so G/L are
//     REACHABLE and open their overlays. Removal must NOT delete this wiring.
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'

function seedNoGame() {
  return {
    id: 'wire-deck',
    title: 'Wire Deck',
    theme: 'black',
    slides: [{ id: 's1', background: '#101010', elements: [] }],
  }
}

function seedWithGame() {
  return {
    id: 'wire-deck',
    title: 'Wire Deck',
    theme: 'black',
    slides: [
      {
        id: 's1',
        background: '#101010',
        elements: [
          {
            id: 'g1',
            type: 'game',
            gameType: 'jeopardy',
            x: 100,
            y: 100,
            width: 400,
            height: 300,
            zIndex: 1,
          },
        ],
      },
    ],
  }
}

const h = vi.hoisted(() => ({
  updatePresentation: vi.fn(() => Promise.resolve({})),
  presentInWindow: vi.fn(),
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

vi.mock('../../utils/generateHTML', () => ({
  presentInWindow: h.presentInWindow,
}))

import EditorPage, { getGameElementForActiveSlide } from '../EditorPage.jsx'

function renderPage() {
  return render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId="wire-deck" onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

async function press(init) {
  document.body.focus()
  await act(async () => {
    fireEvent.keyDown(document, init)
  })
}

beforeEach(() => {
  h.updatePresentation.mockClear()
  h.presentInWindow.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  useUIStore.setState({ activeTab: 'home', formatContext: { hasSelection: false, elementType: null }, showTransitionPreview: false })
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})

describe('EditorPage present-wiring (dead presentation-scope removed)', () => {
  it('without a game element, B/W produce no game overlay and F5 opens presentation', async () => {
    h.seed = seedNoGame()
    renderPage()
    await screen.findByDisplayValue('Wire Deck')

    await press({ key: 'b' })
    await press({ key: 'w' })
    await press({ key: 'F5' })

    expect(screen.queryByTestId('game-hud')).toBeNull()
    expect(screen.queryByTestId('game-leaderboard')).toBeNull()
    expect(h.presentInWindow).toHaveBeenCalledWith(expect.objectContaining({ id: 'wire-deck' }))
    // Page still mounted/usable.
    expect(screen.getByDisplayValue('Wire Deck')).toBeTruthy()
  })

  it('selects game element from the active vertical slide before falling back to the parent', () => {
    const parent = { id: 's1', elements: [{ id: 'parent-game', type: 'game', gameType: 'jeopardy' }] }
    const child = { id: 's1-child', elements: [{ id: 'child-game', type: 'game', gameType: 'name-picker' }] }

    expect(getGameElementForActiveSlide(child, parent)?.id).toBe('child-game')
    expect(getGameElementForActiveSlide(null, parent)?.id).toBe('parent-game')
  })

  it('with a game element, G opens the HUD and L opens the leaderboard (reachable game-scope wiring)', async () => {
    h.seed = seedWithGame()
    renderPage()
    await screen.findByDisplayValue('Wire Deck')

    // game-active indicator confirms currentGameType is truthy.
    expect(screen.getByTestId('game-active-indicator')).toBeTruthy()

    await press({ key: 'g' })
    await waitFor(() => expect(screen.getByTestId('game-hud')).toBeTruthy())

    await press({ key: 'l' })
    await waitFor(() => expect(screen.getByTestId('game-leaderboard')).toBeTruthy())
  })

  it('game shortcut actions publish a typed event instead of being console stubs', async () => {
    h.seed = seedWithGame()
    const events = []
    const handler = (event) => events.push(event.detail)
    window.addEventListener('navslides:game-shortcut', handler)

    try {
      renderPage()
      await screen.findByDisplayValue('Wire Deck')

      await press({ key: 'Enter' })

      expect(events).toContainEqual({
        action: 'next',
        elementId: 'g1',
        gameType: 'jeopardy',
      })
    } finally {
      window.removeEventListener('navslides:game-shortcut', handler)
    }
  })

  it('Escape closes an open game overlay (kept branch)', async () => {
    h.seed = seedWithGame()
    renderPage()
    await screen.findByDisplayValue('Wire Deck')

    await press({ key: 'g' })
    await waitFor(() => expect(screen.getByTestId('game-hud')).toBeTruthy())

    await press({ key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('game-hud')).toBeNull())
  })
})
