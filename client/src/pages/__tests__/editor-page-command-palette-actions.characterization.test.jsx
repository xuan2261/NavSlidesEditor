import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'
import { APP_FEEDBACK_EVENT } from '../../utils/app-feedback'

function makeSeed(grouped = false) {
  return {
    id: 'command-deck',
    title: 'Command Deck',
    theme: 'black',
    slides: [
      {
        id: 's1',
        background: '#101010',
        elements: [
          {
            id: 'el-a',
            type: 'text',
            x: 80,
            y: 100,
            width: 600,
            height: 180,
            zIndex: 1,
            content: '<p>Alpha</p>',
            ...(grouped ? { groupId: 'group-1' } : {}),
          },
          {
            id: 'el-b',
            type: 'shape',
            shape: 'rect',
            x: 300,
            y: 320,
            width: 200,
            height: 150,
            zIndex: 2,
            ...(grouped ? { groupId: 'group-1' } : {}),
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

import EditorPage from '../EditorPage.jsx'

function renderPage() {
  return render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId="command-deck" onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

function lastSaved() {
  const calls = h.updatePresentation.mock.calls
  return calls.length ? calls[calls.length - 1][1] : null
}

async function runCommandAndFlushSave(label) {
  vi.useFakeTimers()
  await act(async () => {
    useUIStore.getState().setShowCommandPalette(true)
  })
  fireEvent.click(screen.getByText(label))
  await act(async () => {
    await vi.runAllTimersAsync()
  })
}

beforeEach(() => {
  h.seed = makeSeed(false)
  h.updatePresentation.mockClear()
  h.presentInWindow.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  useUIStore.setState({ showCommandPalette: false, zoom: 1, userZoomMode: false })
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('EditorPage command palette element actions', () => {
  it('[cap:command.group] groups selected elements through the command palette', async () => {
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await act(async () => {
      useEditorStore.getState().setSelectedElementIds(['el-a', 'el-b'])
    })
    await runCommandAndFlushSave('Group Elements')

    const snap = lastSaved()
    expect(snap).toBeTruthy()
    const [a, b] = snap.slides[0].elements
    expect(a.groupId).toBeTruthy()
    expect(a.groupId).toBe(b.groupId)
  })

  it('[cap:command.ungroup] ungroups selected elements through the command palette', async () => {
    h.seed = makeSeed(true)
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await act(async () => {
      useEditorStore.getState().setSelectedElementIds(['el-a', 'el-b'])
    })
    await runCommandAndFlushSave('Ungroup Elements')

    const snap = lastSaved()
    expect(snap).toBeTruthy()
    const [a, b] = snap.slides[0].elements
    expect(a.groupId).toBeUndefined()
    expect(b.groupId).toBeUndefined()
  })

  it('[cap:command.startSlideshow] starts presentation through the command palette', async () => {
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await act(async () => {
      useUIStore.getState().setShowCommandPalette(true)
    })
    fireEvent.click(screen.getByText('Start Slideshow'))

    expect(h.presentInWindow).toHaveBeenCalledWith(expect.objectContaining({ id: 'command-deck' }))
  })

  it('[cap:command.zoomIn] dispatches Zoom In through the command palette', async () => {
    useUIStore.setState({ zoom: 1, userZoomMode: true })
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await runCommandAndFlushSave('Zoom In')

    expect(useUIStore.getState()).toMatchObject({ zoom: 1.1, userZoomMode: true })
  })

  it('[cap:command.zoomOut] dispatches Zoom Out through the command palette', async () => {
    useUIStore.setState({ zoom: 1, userZoomMode: true })
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await runCommandAndFlushSave('Zoom Out')

    expect(useUIStore.getState()).toMatchObject({ zoom: 0.9, userZoomMode: true })
  })

  it('[cap:command.resetZoom] dispatches Fit to Window through the command palette', async () => {
    useUIStore.setState({ zoom: 1.35, userZoomMode: true })
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await runCommandAndFlushSave('Fit to Window')

    expect(useUIStore.getState().userZoomMode).toBe(false)
  })

  it('[cap:command.insertSlide] opens the slide template picker through the command palette', async () => {
    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await act(async () => {
      useUIStore.getState().setShowCommandPalette(true)
    })
    fireEvent.click(screen.getByText('Insert Slide'))

    expect(screen.getByRole('heading', { name: 'Add Slide' })).toBeTruthy()
  })

  it('[cap:command.insertLink depth:trace] uses the typed rich-text link action through the command palette', async () => {
    const feedback = vi.fn()
    window.addEventListener(APP_FEEDBACK_EVENT, feedback)

    renderPage()
    await screen.findByDisplayValue('Command Deck')

    await act(async () => {
      useUIStore.getState().setShowCommandPalette(true)
    })
    fireEvent.click(screen.getByText('Insert Link'))

    expect(feedback).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          type: 'notice',
          message: 'Enter text edit mode and select a text element before inserting a link.',
        }),
      })
    )
    expect(document.querySelector('[title="Add link"]')).toBeNull()
    expect(useUIStore.getState().showCommandPalette).toBe(false)

    window.removeEventListener(APP_FEEDBACK_EVENT, feedback)
  })
})
