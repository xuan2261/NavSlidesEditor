// Phase 6 integration: vertical (child) slide editing. The wrong-target guard
// (Red Team #1) — when a child is the active edit target, element writes land
// on the CHILD, not the parent. Drives the real EditorPage; observable sink is
// api.updatePresentation (autosave serializes the whole presentation).
import { render, fireEvent, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'

function makeSeed() {
  return {
    id: 'vdeck',
    title: 'V Deck',
    theme: 'black',
    slides: [
      {
        id: 'p0',
        background: '#101010',
        designTokens: { colors: { accent: '#ff7a18', bg: '#101828' } },
        elements: [{ id: 'pa', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '<p>parent</p>' }],
        children: [
          {
            id: 'c0',
            background: '#202020',
            elements: [{ id: 'ca', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '<p>child</p>' }],
          },
        ],
      },
    ],
  }
}

const h = vi.hoisted(() => ({ updatePresentation: vi.fn(() => Promise.resolve({})), seed: null }))

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
      <EditorPage presentationId="vdeck" onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

function lastSaved() {
  const calls = h.updatePresentation.mock.calls
  return calls.length ? calls[calls.length - 1][1] : null
}

async function selectChild() {
  // SlidePanel renders the child with aria-label "Select vertical slide 1.1".
  const childBtn = await screen.findByLabelText('Select vertical slide 1.1')
  await act(async () => {
    fireEvent.click(childBtn)
  })
}

async function addTextViaRibbon() {
  await act(async () => {
    useUIStore.getState().setActiveTab('insert')
  })
  const btn = await screen.findByTestId('ribbon-insert-text')
  await act(async () => {
    fireEvent.mouseDown(btn)
  })
}

async function addVerticalSlideViaContextMenu() {
  const slideBtn = await screen.findByLabelText('Select slide 1')
  await act(async () => {
    fireEvent.contextMenu(slideBtn)
  })
  const addVertical = await screen.findByRole('menuitem', { name: /Add Vertical Slide/i })
  await act(async () => {
    fireEvent.click(addVertical)
  })
}

beforeEach(() => {
  h.seed = makeSeed()
  h.updatePresentation.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null })
  useUIStore.setState({ activeTab: 'home' })
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }))
})

describe('EditorPage vertical-slide editing', () => {
  it('adding a vertical child slide inherits the parent design tokens', async () => {
    renderPage()
    await screen.findByDisplayValue('V Deck')

    await addVerticalSlideViaContextMenu()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        expect(snap.slides[0].children[1].designTokens).toEqual({
          colors: { accent: '#ff7a18', bg: '#101828' },
        })
      },
      { timeout: 2500 }
    )
  })

  it('adding an element while a child is active lands on the CHILD, not the parent', async () => {
    renderPage()
    await screen.findByDisplayValue('V Deck')

    await selectChild()
    await addTextViaRibbon()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        const parent = snap.slides[0]
        const child = parent.children[0]
        // child gained the new element (2), parent unchanged (1).
        expect(child.elements).toHaveLength(2)
        expect(parent.elements).toHaveLength(1)
      },
      { timeout: 2500 }
    )
  })

  it('z-order (bring-forward) on the active child reads + writes the child, not the parent', async () => {
    // Child carries two stacked elements so bring-forward has a neighbor to
    // cross — proving the write targeted the CHILD slide. (Regression: the
    // handler previously read the PARENT slide, so the child lookup missed and
    // the stack never changed.)
    h.seed = {
      id: 'vdeck',
      title: 'V Deck',
      theme: 'black',
      slides: [
        {
          id: 'p0',
          background: '#101010',
          elements: [{ id: 'pa', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '<p>parent</p>' }],
          children: [
            {
              id: 'c0',
              background: '#202020',
              elements: [
                { id: 'ca', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '<p>child a</p>' },
                { id: 'cb', type: 'text', x: 0, y: 60, width: 100, height: 50, zIndex: 2, content: '<p>child b</p>' },
              ],
            },
          ],
        },
      ],
    }
    renderPage()
    await screen.findByDisplayValue('V Deck')

    await selectChild()
    await act(async () => {
      useEditorStore.getState().setSelectedElementIds(['ca'])
    })
    document.body.focus()
    await act(async () => {
      fireEvent.keyDown(document, { key: ']', ctrlKey: true })
    })

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        // 'ca' started below 'cb'; bring-forward swaps them so 'ca' now sits on
        // top. The write landed on the child, not the parent.
        const child = snap.slides[0].children[0]
        const ca = child.elements.find((e) => e.id === 'ca')
        const cb = child.elements.find((e) => e.id === 'cb')
        expect(ca.zIndex).toBeGreaterThan(cb.zIndex)
        // Parent stack is untouched.
        expect(snap.slides[0].elements.find((e) => e.id === 'pa').zIndex).toBe(1)
      },
      { timeout: 2500 }
    )
  })

  it('deleting the active child element targets the child', async () => {
    renderPage()
    await screen.findByDisplayValue('V Deck')

    await selectChild()
    await act(async () => {
      useEditorStore.getState().setSelectedElementIds(['ca'])
    })
    document.body.focus()
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Delete' })
    })

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        const child = snap.slides[0].children[0]
        expect(child.elements.find((e) => e.id === 'ca')).toBeUndefined()
        // parent element survives
        expect(snap.slides[0].elements.find((e) => e.id === 'pa')).toBeTruthy()
      },
      { timeout: 2500 }
    )
  })

  it('after a child is selected, adding to the parent again (deselect child) targets the parent', async () => {
    renderPage()
    await screen.findByDisplayValue('V Deck')

    await selectChild()
    // Navigate back to the parent slide thumbnail (clears verticalEdit).
    const parentThumb = await screen.findByLabelText(/Go to slide 1$/i).catch(() => null)
    // Fallback: click the top-level slide item (first slide-panel-item).
    if (!parentThumb) {
      const items = await screen.findAllByTestId('slide-panel-item')
      await act(async () => {
        fireEvent.click(items[0])
      })
    } else {
      await act(async () => {
        fireEvent.click(parentThumb)
      })
    }
    await addTextViaRibbon()

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        // parent gained the element (2), child unchanged (1).
        expect(snap.slides[0].elements).toHaveLength(2)
        expect(snap.slides[0].children[0].elements).toHaveLength(1)
      },
      { timeout: 2500 }
    )
  })

  it('migrates legacy children (html, no elements) to elements-based children on load', async () => {
    // Legacy child carries `html` but no `elements` array.
    h.seed = {
      id: 'vdeck',
      title: 'V Deck',
      theme: 'black',
      slides: [
        {
          id: 'p0',
          background: '#101010',
          elements: [{ id: 'pa', type: 'text', x: 0, y: 0, width: 100, height: 50, zIndex: 1, content: '<p>parent</p>' }],
          children: [{ id: 'c0', background: '#202020', html: '<h2>legacy child</h2>' }],
        },
      ],
    }
    renderPage()
    const title = await screen.findByDisplayValue('V Deck')

    // Trigger a save so the migrated state is serialized.
    await act(async () => {
      fireEvent.change(title, { target: { value: 'V Deck 2' } })
    })

    await waitFor(
      () => {
        const snap = lastSaved()
        expect(snap).toBeTruthy()
        const child = snap.slides[0].children[0]
        expect(Array.isArray(child.elements)).toBe(true)
        expect(child.elements).toHaveLength(1)
        expect(child.elements[0].type).toBe('text')
        expect(child.elements[0].content).toContain('legacy child')
      },
      { timeout: 2500 }
    )
  })
})
