import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiveSocketContext } from '../../contexts/live-socket-context-provider.jsx'
import { useEditorStore } from '../../stores/editor-store'
import { useUIStore } from '../../stores/ui-store'

const h = vi.hoisted(() => ({ seed: null, saved: vi.fn(() => Promise.resolve({})) }))
vi.mock('../../utils/api', () => ({ api: {
  getPresentation: () => Promise.resolve(structuredClone(h.seed)),
  getShareStatus: () => Promise.resolve({ shared: false }),
  updatePresentation: h.saved,
  uploadFile: vi.fn(),
} }))
import EditorPage from '../EditorPage'

const text = (id, content, extra = {}) => ({ id, type: 'text', content: `<p>${content}</p>`, x: 80, y: 100, width: 400, height: 100, ...extra })
const createRange = document.createRange.bind(document)

beforeEach(() => {
  vi.spyOn(document, 'createRange').mockImplementation(() => Object.assign(createRange(), {
    getClientRects: () => [],
    getBoundingClientRect: () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 }),
  }))
  h.seed = { id: 'audit-context', title: 'Audit context', slides: [
    { id: 'parent', elements: [text('parent-text', 'Parent')], children: [{ id: 'child', elements: [text('child-text', 'Child', { fragment: true, fragmentIndex: 1 })] }] },
    { id: 'second', elements: [text('second-text', 'Second')] },
  ], layoutMasters: [{ id: 'custom-master', name: 'Audit master', fixedElements: [text('master-text', 'Master')], placeholders: [] }] }
  h.saved.mockClear()
  useEditorStore.setState({ selectedElementIds: [], editingElementId: null, clipboard: null, showTimeline: false, showFindReplace: false, viewMode: 'normal' })
  useUIStore.setState({ activeTab: 'home', showCommandPalette: false, showTemplateModal: false, leftPanelOpen: true, rightPanelOpen: true, showDesignIdeas: false })
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

async function mount() {
  render(<LiveSocketContext.Provider value={null}><EditorPage presentationId="audit-context" onGoHome={vi.fn()} /></LiveSocketContext.Provider>)
  await screen.findByDisplayValue('Audit context')
}

describe('editor authoring context', () => {
  it('keeps the child, navigator, timeline and saved mutation on the same parent', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Select slide 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select vertical slide 1.1' }))
    expect(screen.getByTestId('slide-element-child-text')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Select slide 1' }).getAttribute('aria-pressed')).toBe('true')
    act(() => useEditorStore.getState().setShowTimeline(true))
    expect(screen.getByTestId('animation-timeline-item-child-text')).toBeTruthy()
    expect(screen.queryByTestId('animation-timeline-item-second-text')).toBeNull()
    act(() => useUIStore.getState().setActiveTab('insert'))
    fireEvent.click(screen.getByRole('button', { name: 'Add text' }))
    await waitFor(() => {
      const saved = h.saved.mock.calls.at(-1)?.[1]
      expect(saved?.slides[0].children[0].elements).toHaveLength(2)
      expect(saved.slides[1].elements).toHaveLength(1)
    }, { timeout: 3500 })
  })

  it('opens and persists master rich text without changing a normal slide', async () => {
    await mount()
    act(() => useUIStore.getState().setActiveTab('design'))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Open Layout Manager' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit master Audit master' }))
    fireEvent.doubleClick(screen.getByTestId('slide-element-master-text'))
    await waitFor(() => expect(document.querySelector('[contenteditable="true"]')).not.toBeNull())
    const editor = document.querySelector('[contenteditable="true"]')
    editor.innerHTML = '<p>Changed master</p>'
    fireEvent.input(editor)
    await waitFor(() => {
      const saved = h.saved.mock.calls.at(-1)?.[1]
      expect(saved?.layoutMasters[0].fixedElements[0].content).toContain('Changed master')
      expect(saved.slides[0].elements[0].content).toBe('<p>Parent</p>')
    }, { timeout: 3500 })
  })

  it('opens notes from Design Ideas and focuses the editable field', async () => {
    await mount()
    act(() => { useUIStore.getState().setShowDesignIdeas(true); useUIStore.getState().setActiveTab('view') })
    fireEvent.click(screen.getByRole('button', { name: 'Speaker Notes', exact: true }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Speaker notes' })))
  })
  it('opens a horizontal sorter selection instead of retaining its vertical child', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Select vertical slide 1.1' }))
    act(() => useEditorStore.getState().setViewMode('sorter'))
    fireEvent.doubleClick(screen.getByTestId('slide-sorter-number-1'))
    expect(screen.getByTestId('slide-element-parent-text')).toBeTruthy()
    expect(screen.queryByTestId('slide-element-child-text')).toBeNull()
  })

  it('navigates Find to a matched vertical child', async () => {
    await mount()
    act(() => useEditorStore.getState().setShowFindReplace(true))
    fireEvent.change(screen.getByPlaceholderText('Find...'), { target: { value: 'Child' } })
    fireEvent.click(screen.getByTitle('Next'))
    expect(screen.getByTestId('slide-element-child-text')).toBeTruthy()
  })

  it('ends rich text editing when another layer becomes selected', async () => {
    h.seed.slides[0].elements.push(text('other-text', 'Other', { name: 'Other layer' }))
    await mount()
    fireEvent.doubleClick(screen.getByTestId('slide-element-parent-text'))
    expect(useEditorStore.getState().editingElementId).toBe('parent-text')
    fireEvent.click(screen.getByRole('button', { name: 'Selection Pane', exact: true }))
    fireEvent.click(screen.getByRole('listitem', { name: 'Other layer, Text' }))
    expect(useEditorStore.getState().selectedElementIds).toEqual(['other-text'])
    expect(useEditorStore.getState().editingElementId).toBeNull()
  })
})
