// Characterization: element CRUD, selection/group, z-order. Locks CURRENT
// behavior of the element write paths Phase 6 will reroute through
// mapActiveSlide. Observable sink: api.updatePresentation (autosave snapshot).
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'

function makeSeed() {
  return {
    id: 'char-deck',
    title: 'Char Deck',
    theme: 'black',
    showPageNumbers: false,
    slides: [
      {
        id: 's1',
        background: '#101010',
        elements: [
          { id: 'el-a', type: 'text', x: 80, y: 100, width: 600, height: 180, zIndex: 1, content: '<p>Alpha</p>' },
          { id: 'el-b', type: 'shape', shape: 'rect', x: 300, y: 320, width: 200, height: 150, zIndex: 2 },
        ],
      },
      { id: 's2', background: '#202020', elements: [] },
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

import EditorPage, {
  getElementForActiveSlideEdit,
  getSelectionIdsForActiveSlideElement,
} from '../EditorPage.jsx'

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

async function selectElements(ids) {
  await act(async () => {
    useEditorStore.getState().setSelectedElementIds(ids)
  })
}

async function pressKey(init) {
  document.body.focus()
  await act(async () => {
    fireEvent.keyDown(document, init)
  })
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

describe('EditorPage element-ops characterization', () => {
  it('resolves editable text elements from the active vertical child slide', () => {
    const activeChild = {
      id: 'child-1',
      elements: [
        { id: 'child-text', type: 'text', content: '<p>Child</p>' },
      ],
    }
    const parent = {
      id: 'parent-1',
      elements: [
        { id: 'parent-text', type: 'text', content: '<p>Parent</p>' },
      ],
    }

    expect(getElementForActiveSlideEdit(activeChild, parent, 'child-text')).toEqual(
      activeChild.elements[0]
    )
    expect(getElementForActiveSlideEdit(activeChild, parent, 'parent-text')).toBeNull()
  })

  it('resolves grouped selection ids from the active vertical child slide', () => {
    const activeChild = {
      id: 'child-1',
      elements: [
        { id: 'child-a', type: 'shape', groupId: 'child-group' },
        { id: 'child-b', type: 'shape', groupId: 'child-group' },
      ],
    }
    const parent = {
      id: 'parent-1',
      elements: [
        { id: 'parent-a', type: 'shape', groupId: 'parent-group' },
        { id: 'parent-b', type: 'shape', groupId: 'parent-group' },
      ],
    }

    expect(getSelectionIdsForActiveSlideElement(activeChild, parent, 'child-a')).toEqual([
      'child-a',
      'child-b',
    ])
    expect(getSelectionIdsForActiveSlideElement(activeChild, parent, 'parent-a')).toEqual([
      'parent-a',
    ])
  })

  it('deletes the selected element via Delete key', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await selectElements(['el-a'])
    await pressKey({ key: 'Delete' })

    await waitFor(() => {
      const snap = lastSaved()
      expect(snap).toBeTruthy()
      const ids = snap.slides[0].elements.map((e) => e.id)
      expect(ids).not.toContain('el-a')
      expect(ids).toContain('el-b')
    }, { timeout: 2500 })
  })

  it('does NOT delete a locked element', async () => {
    h.seed.slides[0].elements[0].locked = true
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await selectElements(['el-a'])
    await pressKey({ key: 'Delete' })
    // Give autosave a chance; if nothing saved, the locked element survived.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1700))
    })

    const snap = lastSaved()
    const ids = (snap?.slides?.[0]?.elements ?? h.seed.slides[0].elements).map((e) => e.id)
    expect(ids).toContain('el-a')
  })

  it('[cap:shortcut.group] groups two selected elements with a shared groupId (Ctrl+G)', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await selectElements(['el-a', 'el-b'])
    await pressKey({ key: 'g', ctrlKey: true })

    await waitFor(() => {
      const snap = lastSaved()
      expect(snap).toBeTruthy()
      const [a, b] = snap.slides[0].elements
      expect(a.groupId).toBeTruthy()
      expect(a.groupId).toBe(b.groupId)
    }, { timeout: 2500 })
  })

  it('[cap:shortcut.ungroup] ungroups grouped elements with Ctrl+Shift+G', async () => {
    h.seed.slides[0].elements[0].groupId = 'group-1'
    h.seed.slides[0].elements[1].groupId = 'group-1'
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await selectElements(['el-a', 'el-b'])
    await pressKey({ key: 'g', ctrlKey: true, shiftKey: true })

    await waitFor(() => {
      const snap = lastSaved()
      expect(snap).toBeTruthy()
      const [a, b] = snap.slides[0].elements
      expect(a.groupId).toBeUndefined()
      expect(b.groupId).toBeUndefined()
    }, { timeout: 2500 })
  })

  it('[cap:canvas.zorder tier:deep] [cap:shortcut.bringForward] bring-forward increments the selected element zIndex (Ctrl+])', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await selectElements(['el-a']) // zIndex 1
    await pressKey({ key: ']', ctrlKey: true })

    await waitFor(() => {
      const snap = lastSaved()
      expect(snap).toBeTruthy()
      const a = snap.slides[0].elements.find((e) => e.id === 'el-a')
      expect(a.zIndex).toBe(2)
    }, { timeout: 2500 })
  })

  it('[cap:canvas.zorder tier:deep] [cap:shortcut.sendBackward] send-backward decrements the selected element zIndex (Ctrl+[)', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await selectElements(['el-b']) // zIndex 2
    await pressKey({ key: '[', ctrlKey: true })

    await waitFor(() => {
      const snap = lastSaved()
      expect(snap).toBeTruthy()
      const b = snap.slides[0].elements.find((e) => e.id === 'el-b')
      expect(b.zIndex).toBe(1)
    }, { timeout: 2500 })
  })

  it('Ctrl+D leaves the copy clipboard intact so the next paste still pastes the copied element', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    // Copy el-a, then duplicate el-b. Duplicate must NOT overwrite the clipboard.
    await selectElements(['el-a'])
    await pressKey({ key: 'c', ctrlKey: true })
    await selectElements(['el-b'])
    await pressKey({ key: 'd', ctrlKey: true })

    const clip = useEditorStore.getState().clipboard
    expect(clip).toHaveLength(1)
    // Clipboard still holds the text element copied first (Alpha), not the shape.
    expect(clip[0].type).toBe('text')
    expect(clip[0].content).toBe('<p>Alpha</p>')
  })

  it('adds a text element with defaults via the Insert ribbon', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')

    await act(async () => {
      useUIStore.getState().setActiveTab('insert')
    })
    const addTextBtn = await screen.findByTestId('ribbon-insert-text')
    await act(async () => {
      fireEvent.mouseDown(addTextBtn)
    })

    await waitFor(() => {
      const snap = lastSaved()
      expect(snap).toBeTruthy()
      const els = snap.slides[0].elements
      expect(els).toHaveLength(3)
      const added = els[els.length - 1]
      expect(added.type).toBe('text')
      expect(added.width).toBe(600)
      expect(added.height).toBe(180)
    }, { timeout: 2500 })
  })
})
