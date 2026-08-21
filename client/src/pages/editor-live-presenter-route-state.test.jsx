import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveSocketContext } from '../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../stores/editor-store'
import { useUIStore } from '../stores/ui-store'

function deck(id) {
  return {
    id,
    title: `Deck ${id}`,
    theme: 'black',
    slides: [{ id: `${id}-slide`, background: '#101010', elements: [] }],
  }
}

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function liveRoomResponse(roomCode = 'ROOM-A') {
  return {
    ok: true,
    json: async () => ({
      roomCode,
      presenterToken: 'presenter-token-a',
      remoteToken: 'remote-token-a',
      speakerToken: 'speaker-token-a',
    }),
  }
}

const h = vi.hoisted(() => ({
  bridge: {
    clear: vi.fn(),
    handleMessage: vi.fn(() => false),
    isActiveFor: vi.fn(() => false),
    post: vi.fn(() => false),
    register: vi.fn(() => true),
  },
  createPresenterPopupBridge: vi.fn(),
  getPresentation: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('../utils/api', () => ({
  api: {
    getPresentation: h.getPresentation,
    getTemplate: vi.fn(),
    updatePresentation: vi.fn(() => Promise.resolve({})),
    updateTemplate: vi.fn(() => Promise.resolve({})),
    getShareStatus: vi.fn(() => Promise.resolve({ shared: false, token: null })),
    uploadFile: vi.fn(() => Promise.resolve({ url: '/uploads/x.png' })),
  },
}))

vi.mock('../utils/generateHTML', () => ({
  presentInWindow: vi.fn(),
}))

vi.mock('../utils/app-feedback', () => ({
  showError: h.showError,
  showNotice: vi.fn(),
}))

vi.mock('../utils/presenter-popup-bridge', () => ({
  createPresenterPopupBridge: h.createPresenterPopupBridge,
}))

import EditorPage from './EditorPage.jsx'

function page(presentationId) {
  return (
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId={presentationId} onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

function renderPage(presentationId = 'deck-a') {
  return render(page(presentationId))
}

async function rerenderPage(rerender, presentationId) {
  rerender(page(presentationId))
  await screen.findByDisplayValue(`Deck ${presentationId}`)
}

async function requestLiveRoom() {
  fireEvent.mouseDown(screen.getByRole('button', { name: 'Share' }))
  fireEvent.mouseDown(await screen.findByRole('menuitem', { name: 'Present Live' }))
}

let originalFetch

beforeEach(() => {
  originalFetch = globalThis.fetch
  h.getPresentation.mockImplementation((id) => Promise.resolve(deck(id)))
  h.createPresenterPopupBridge.mockImplementation(() => h.bridge)
  Object.values(h.bridge).forEach((mock) => mock.mockClear())
  h.showError.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  useUIStore.setState({
    activeTab: 'home',
    formatContext: { hasSelection: false, elementType: null },
    showLiveModal: false,
  })
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('EditorPage live presenter route state', () => {
  it('closes deck A live state and clears its popup bridge when rerendered for deck B', async () => {
    globalThis.fetch = vi.fn((url) =>
      Promise.resolve(url === '/api/live/room' ? liveRoomResponse() : { ok: true, json: async () => ({}) })
    )
    const { rerender } = renderPage()

    await screen.findByDisplayValue('Deck deck-a')
    await requestLiveRoom()
    expect(await screen.findByText('ROOM-A')).toBeTruthy()
    expect(useUIStore.getState().showLiveModal).toBe(true)

    await rerenderPage(rerender, 'deck-b')
    await waitFor(() => {
      expect(screen.queryByText('ROOM-A')).toBeNull()
      expect(useUIStore.getState().showLiveModal).toBe(false)
      expect(h.bridge.clear).toHaveBeenCalled()
    })
  })

  it('ignores an outgoing deck live-room response after a route change', async () => {
    const pendingLiveRoom = deferred()
    globalThis.fetch = vi.fn((url) =>
      url === '/api/live/room' ? pendingLiveRoom.promise : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    const { rerender } = renderPage()

    await screen.findByDisplayValue('Deck deck-a')
    await requestLiveRoom()
    await rerenderPage(rerender, 'deck-b')

    await act(async () => {
      pendingLiveRoom.resolve(liveRoomResponse())
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.queryByText('ROOM-A')).toBeNull()
      expect(useUIStore.getState().showLiveModal).toBe(false)
    })
  })

  it('rejects a stale request when the route returns to the same deck', async () => {
    const pendingLiveRoom = deferred()
    globalThis.fetch = vi.fn((url) =>
      url === '/api/live/room' ? pendingLiveRoom.promise : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    const { rerender } = renderPage()

    await screen.findByDisplayValue('Deck deck-a')
    await requestLiveRoom()
    await rerenderPage(rerender, 'deck-b')
    await rerenderPage(rerender, 'deck-a')

    await act(async () => {
      pendingLiveRoom.resolve(liveRoomResponse())
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.queryByText('ROOM-A')).toBeNull()
    expect(useUIStore.getState().showLiveModal).toBe(false)
  })

  it('does not report a failed room request after leaving its deck', async () => {
    const pendingLiveRoom = deferred()
    globalThis.fetch = vi.fn((url) =>
      url === '/api/live/room' ? pendingLiveRoom.promise : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    const { rerender } = renderPage()

    await screen.findByDisplayValue('Deck deck-a')
    await requestLiveRoom()
    await rerenderPage(rerender, 'deck-b')

    await act(async () => {
      pendingLiveRoom.resolve({ ok: false, json: async () => ({}) })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(h.showError).not.toHaveBeenCalled()
  })
})
