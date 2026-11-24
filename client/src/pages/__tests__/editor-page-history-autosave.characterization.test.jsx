// Characterization: undo/redo history state and dirty-save affordance.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { api } from '../../utils/api'
import { readEditorDraft } from '../../utils/editor-draft-store'
import { useEditorStore } from '../../stores/editor-store'
import { usePresentationStore } from '../../stores/presentation-store'

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
  historyBoundaryOnly: false,
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

vi.mock('../../components/editor/editor-workspace', async (importOriginal) => {
  const original = await importOriginal()
  const EditorWorkspace = original.default
  return {
    ...original,
    default: (props) => h.historyBoundaryOnly ? null : <EditorWorkspace {...props} />,
  }
})

import EditorPage from '../EditorPage.jsx'

function renderPage(presentationId = 'char-deck') {
  return render(
    <LiveSocketContext.Provider value={null}>
      <EditorPage presentationId={presentationId} onGoHome={() => {}} />
    </LiveSocketContext.Provider>
  )
}

beforeEach(() => {
  h.historyBoundaryOnly = false
  vi.stubGlobal('indexedDB', undefined)
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, viewMode: 'normal' })
  usePresentationStore.setState({ presentation: null, saveConflict: null })
  api.getPresentation.mockReset().mockResolvedValue(structuredClone(seed))
  localStorage.clear()
  h.updatePresentation.mockClear()
  h.updatePresentation.mockImplementation(() => Promise.resolve({}))
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllTimers()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('EditorPage history characterization', () => {
  it('[cap:flow.undo-redo tier:deep] undo restores the prior snapshot after an edit', async () => {
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

  it('[cap:flow.undo-redo tier:deep] redo restores an undone edit and keeps the save affordance dirty', async () => {
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

  it('preserves the current snapshot after two undos and two redos', async () => {
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    for (const value of ['Snapshot B', 'Snapshot C']) {
      fireEvent.change(title, { target: { value } })
      await act(() => vi.advanceTimersByTimeAsync(600))
    }
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Snapshot B')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Char Deck')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(title.value).toBe('Snapshot B')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(title.value).toBe('Snapshot C')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Snapshot B')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(title.value).toBe('Snapshot C')
  })

  it('keeps the first loaded document clean without autosaving after its timers elapse', async () => {
    renderPage()
    await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(h.updatePresentation).not.toHaveBeenCalled()
    expect(await readEditorDraft('char-deck')).toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Redo' }).disabled).toBe(true)
    expect(screen.queryByTitle('Save (Ctrl+S)')).toBeNull()
    expect(screen.getByDisplayValue('Char Deck')).toBeTruthy()
  })

  it('undoes an edit immediately and invalidates redo before the debounce expires', async () => {
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Pending edit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Char Deck')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(title.value).toBe('Pending edit')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.change(title, { target: { value: 'New branch' } })
    expect(screen.getByRole('button', { name: 'Redo' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Char Deck')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(title.value).toBe('New branch')
  })

  it('reflects undo and redo availability in the quick-access controls', async () => {
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    const undo = screen.getByRole('button', { name: 'Undo' })
    const redo = screen.getByRole('button', { name: 'Redo' })

    expect(undo.disabled).toBe(true)
    expect(redo.disabled).toBe(true)

    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Availability Target' } })
    await vi.runAllTimersAsync()
    vi.useRealTimers()

    await waitFor(() => expect(undo.disabled).toBe(false))
    fireEvent.click(undo)
    await waitFor(() => expect(redo.disabled).toBe(false))
  })
  it('keeps the newer edit recoverable when an older save completes, then persists retry and reload', async () => {
    let resolveA
    let rejectB
    let committed = structuredClone(seed)
    h.updatePresentation
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve }))
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectB = reject }))
      .mockImplementationOnce((_id, body) => {
        committed = JSON.parse(JSON.stringify(body))
        return Promise.resolve({ aggregateGeneration: 2 })
      })
    const mounted = renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Save A' } })
    await act(() => vi.advanceTimersByTimeAsync(1500))
    fireEvent.change(title, { target: { value: 'Newer B' } })
    await act(() => vi.advanceTimersByTimeAsync(500))
    expect((await readEditorDraft('char-deck')).snapshot.title).toBe('Newer B')
    await act(async () => { resolveA({ aggregateGeneration: 1 }); await Promise.resolve() })
    expect(title.value).toBe('Newer B')
    expect((await readEditorDraft('char-deck')).snapshot.title).toBe('Newer B')
    expect(screen.queryByLabelText('Saved')).toBeNull()
    await act(async () => { rejectB(new Error('offline B')); await Promise.resolve() })
    expect(screen.getByLabelText('Retry')).toBeTruthy()
    expect((await readEditorDraft('char-deck')).snapshot.title).toBe('Newer B')
    fireEvent.click(screen.getByLabelText('Retry'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(committed.title).toBe('Newer B')
    expect(await readEditorDraft('char-deck')).toBeNull()
    mounted.unmount()
    vi.useRealTimers()
    api.getPresentation.mockResolvedValueOnce(committed)
    renderPage()
    expect(await screen.findByDisplayValue('Newer B')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)
  })

  it('does not let a late route load replace the new deck or seed its undo predecessor', async () => {
    let resolveA
    api.getPresentation
      .mockImplementationOnce(() => new Promise((resolve) => { resolveA = resolve }))
      .mockResolvedValueOnce({ ...structuredClone(seed), id: 'deck-b', title: 'Loaded B' })
    const mounted = renderPage('deck-a')
    mounted.rerender(
      <LiveSocketContext.Provider value={null}>
        <EditorPage presentationId="deck-b" onGoHome={() => {}} />
      </LiveSocketContext.Provider>
    )
    const title = await screen.findByDisplayValue('Loaded B')
    vi.useFakeTimers()
    await act(async () => {
      resolveA({ ...structuredClone(seed), id: 'deck-a', title: 'Late A' })
      await Promise.resolve()
    })
    expect(title.value).toBe('Loaded B')
    expect(screen.getByRole('button', { name: 'Undo' }).disabled).toBe(true)
    fireEvent.change(title, { target: { value: 'Edited B' } })
    await act(() => vi.advanceTimersByTimeAsync(500))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Loaded B')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    await act(() => vi.advanceTimersByTimeAsync(1500))
    expect((await readEditorDraft('deck-a'))).toBeNull()
    expect(h.updatePresentation.mock.calls.map(([id, body]) => [id, body.title]))
      .toEqual([['deck-b', 'Edited B']])
  })

  it('[P06-04] coalesces rapid edits within debounce window into a single undo boundary', async () => {
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    vi.useFakeTimers()
    fireEvent.change(title, { target: { value: 'Rapid 1' } })
    await act(() => vi.advanceTimersByTimeAsync(100))
    fireEvent.change(title, { target: { value: 'Rapid 12' } })
    await act(() => vi.advanceTimersByTimeAsync(100))
    fireEvent.change(title, { target: { value: 'Rapid 123' } })
    await act(() => vi.advanceTimersByTimeAsync(600))

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(title.value).toBe('Char Deck')
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(title.value).toBe('Rapid 123')
  })

  it('[P06-06] enforces history cap and retains valid oldest boundary across deep undo sequence', async () => {
    // This capacity oracle drives the real page, header, history and persistence;
    // it does not assert ribbon, navigator, canvas or inspector behavior. Avoid
    // rerendering those unrelated workspace trees across all 153 transitions.
    // Every other case in this file keeps the full workspace mounted.
    h.historyBoundaryOnly = true
    renderPage()
    const title = await screen.findByDisplayValue('Char Deck')
    const undoButton = screen.getByRole('button', { name: 'Undo' })
    const redoButton = screen.getByRole('button', { name: 'Redo' })
    vi.useFakeTimers()
    for (let i = 1; i <= 55; i++) {
      fireEvent.change(title, { target: { value: `Edit ${i}` } })
      await act(() => vi.advanceTimersByTimeAsync(600))
      expect(title.value).toBe(`Edit ${i}`)
      expect(undoButton.disabled).toBe(false)
      expect(redoButton.disabled).toBe(true)
    }
    expect(title.value).toBe('Edit 55')
    let undoCount = 0
    while (!undoButton.disabled && undoCount < 60) {
      fireEvent.click(undoButton)
      undoCount++
      expect(title.value).toBe(`Edit ${55 - undoCount}`)
      expect(undoButton.disabled).toBe(undoCount === 49)
      expect(redoButton.disabled).toBe(false)
    }
    expect(undoCount).toBe(49)
    expect(title.value).toBe('Edit 6')
    expect(undoButton.disabled).toBe(true)

    let redoCount = 0
    while (!redoButton.disabled && redoCount < 60) {
      fireEvent.click(redoButton)
      redoCount++
      expect(title.value).toBe(`Edit ${6 + redoCount}`)
      expect(undoButton.disabled).toBe(false)
      expect(redoButton.disabled).toBe(redoCount === 49)
    }
    expect(redoCount).toBe(49)
    expect(title.value).toBe('Edit 55')
    expect(redoButton.disabled).toBe(true)
  })
})
