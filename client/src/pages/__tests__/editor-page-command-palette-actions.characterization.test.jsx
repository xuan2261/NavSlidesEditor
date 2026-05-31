import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'

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
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  useUIStore.setState({ showCommandPalette: false })
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
})
