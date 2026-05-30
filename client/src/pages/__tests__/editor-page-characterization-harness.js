// Shared harness for EditorPage characterization tests.
// Spike outcome (phase-01): EditorPage renders the REAL tree in jsdom with only
// api + global fetch + LiveSocketContext mocked (+ ResizeObserver polyfill in
// the shared vitest setup). No child stubs. The observable sink for mutations
// is api.updatePresentation — autosave serializes the whole presentation.
import { render } from '@testing-library/react'
import { vi } from 'vitest'
import { LiveSocketContext } from '../../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../../stores/editor-store'

export function makeSeed(overrides = {}) {
  return {
    id: 'char-deck',
    title: 'Char Deck',
    theme: 'black',
    showPageNumbers: false,
    slides: [
      {
        id: 'slide-1',
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
          },
        ],
      },
      {
        id: 'slide-2',
        background: '#202020',
        elements: [],
      },
    ],
    ...overrides,
  }
}

// Build a fresh api mock. Caller passes this to vi.mock factory results via
// the returned object's fields.
export function makeApiMock(seed) {
  const updatePresentation = vi.fn(() => Promise.resolve({}))
  const updateTemplate = vi.fn(() => Promise.resolve({}))
  return {
    getPresentation: vi.fn(() => Promise.resolve(structuredClone(seed))),
    getTemplate: vi.fn(() => Promise.resolve(structuredClone(seed))),
    updatePresentation,
    updateTemplate,
    getShareStatus: vi.fn(() => Promise.resolve({ shared: false, token: null })),
    uploadFile: vi.fn(() => Promise.resolve({ url: '/uploads/x.png' })),
  }
}

export function resetEditorStore() {
  useEditorStore.setState({
    selectedElementIds: [],
    editingElementId: null,
    clipboard: null,
  })
}

export function renderEditorPage(EditorPage, { presentationId = 'char-deck', isTemplate = false } = {}) {
  const onGoHome = vi.fn()
  const utils = render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId={presentationId} isTemplate={isTemplate} onGoHome={onGoHome} />
    </LiveSocketContext.Provider>
  )
  return { ...utils, onGoHome, store: useEditorStore }
}

// The last snapshot persisted to api.updatePresentation (post-normalization).
export function lastSavedSnapshot(updateFn) {
  if (!updateFn.mock.calls.length) return null
  return updateFn.mock.calls[updateFn.mock.calls.length - 1][1]
}
