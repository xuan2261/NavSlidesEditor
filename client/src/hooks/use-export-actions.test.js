import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const h = vi.hoisted(() => ({
  exportPDF: vi.fn(),
  downloadHTML: vi.fn(),
  generateRevealHTML: vi.fn(() => '<html></html>'),
  generateOfflineHTML: vi.fn(() => Promise.resolve('<html>offline</html>')),
  exportProject: vi.fn(() => Promise.resolve()),
  exportToPptx: vi.fn(() => Promise.resolve([])),
  downloadPptxOriginal: vi.fn(),
  showNotice: vi.fn(),
  showError: vi.fn(),
}))

vi.mock('../utils/generateHTML', () => ({
  exportPDF: h.exportPDF,
  downloadHTML: h.downloadHTML,
  generateRevealHTML: h.generateRevealHTML,
  presentInWindow: vi.fn(),
}))
vi.mock('../utils/offlineExport', () => ({ generateOfflineHTML: h.generateOfflineHTML }))
vi.mock('../utils/export-project', () => ({ exportProject: h.exportProject }))
vi.mock('../utils/exportPptx', () => ({ exportToPptx: h.exportToPptx }))
vi.mock('../utils/api', () => ({ api: { downloadPptxOriginal: h.downloadPptxOriginal } }))
vi.mock('../utils/app-feedback', () => ({ showNotice: h.showNotice, showError: h.showError }))

import { useExportActions } from './use-export-actions'

const presentation = { id: 'p1', title: 'My Deck', slides: [{ id: 's1', elements: [] }] }

beforeEach(() => {
  Object.values(h).forEach((fn) => fn.mockClear())
  h.generateRevealHTML.mockReturnValue('<html></html>')
  h.generateOfflineHTML.mockResolvedValue('<html>offline</html>')
  h.exportToPptx.mockResolvedValue([])
  h.downloadPptxOriginal.mockResolvedValue(
    new Blob(['original'], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    })
  )
  h.showNotice.mockClear()
  h.showError.mockClear()
  delete globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useExportActions', () => {
  it('onExportPDF delegates to exportPDF(presentation)', () => {
    const { result } = renderHook(() => useExportActions(presentation))
    act(() => result.current.onExportPDF())
    expect(h.exportPDF).toHaveBeenCalledWith(presentation)
  })

  it('onExportHTML delegates to downloadHTML(presentation)', async () => {
    const { result } = renderHook(() => useExportActions(presentation))
    await act(async () => {
      await result.current.onExportHTML()
    })
    expect(h.downloadHTML).toHaveBeenCalledWith(presentation)
  })

  it('onExportPPTX dynamic-imports exportToPptx and surfaces warnings via themed notice', async () => {
    const warnings = ['Unsupported element X']
    Object.defineProperty(warnings, 'exportReport', {
      enumerable: false,
      value: { surface: 'pptx-export', warningCount: 1, warnings: [] },
    })
    h.exportToPptx.mockResolvedValueOnce(warnings)
    const { result } = renderHook(() => useExportActions(presentation))
    await act(async () => {
      await result.current.onExportPPTX()
    })
    expect(h.exportToPptx).toHaveBeenCalledWith(presentation)
    expect(h.showNotice).toHaveBeenCalledWith(expect.stringContaining('Unsupported element X'))
    expect(globalThis.__NAVSLIDES_LAST_PPTX_EXPORT_REPORT__).toEqual(
      expect.objectContaining({ surface: 'pptx-export', warningCount: 1 })
    )
  })

  it('downloads original bytes for an imported presentation that remains locally clean', async () => {
    const imported = {
      ...presentation,
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
    }
    const clickSpy = vi.fn()
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:original')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const origCreateEl = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateEl(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    const { result } = renderHook(() => useExportActions(imported))
    await act(async () => result.current.onExportPPTX())

    expect(h.downloadPptxOriginal).toHaveBeenCalledWith('p1')
    expect(h.exportToPptx).not.toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(document.createElement).toHaveBeenCalledWith('a')

    document.createElement.mockRestore()
    URL.createObjectURL.mockRestore()
    URL.revokeObjectURL.mockRestore()
  })

  it('falls back to reconstructed export when original bytes return 404', async () => {
    const imported = {
      ...presentation,
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
    }
    h.downloadPptxOriginal.mockRejectedValueOnce(Object.assign(new Error('hybrid-export'), { status: 404 }))
    const { result } = renderHook(() => useExportActions(imported))

    await act(async () => result.current.onExportPPTX())

    expect(h.exportToPptx).toHaveBeenCalledWith(imported)
    expect(h.showError).not.toHaveBeenCalled()
  })

  it('never downloads original bytes after a local content edit', async () => {
    const imported = {
      ...presentation,
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
    }
    const { result, rerender } = renderHook(
      ({ deck }) => useExportActions(deck),
      { initialProps: { deck: imported } }
    )
    const edited = { ...imported, slides: [{ id: 's1', elements: [{ id: 'e1', type: 'text' }] }] }
    rerender({ deck: edited })
    await act(async () => result.current.onExportPPTX())

    expect(h.downloadPptxOriginal).not.toHaveBeenCalled()
    expect(h.exportToPptx).toHaveBeenCalledWith(edited)
  })

  it('never downloads original bytes when the server marks the presentation dirty', async () => {
    const serverDirty = {
      ...presentation,
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
      _pptxEdited: true,
    }
    const { result } = renderHook(() => useExportActions(serverDirty))

    await act(async () => result.current.onExportPPTX())

    expect(h.downloadPptxOriginal).not.toHaveBeenCalled()
    expect(h.exportToPptx).toHaveBeenCalledWith(serverDirty)
  })

  it('onExportPPTX does NOT show a notice when there are no warnings', async () => {
    const { result } = renderHook(() => useExportActions(presentation))
    await act(async () => {
      await result.current.onExportPPTX()
    })
    expect(h.exportToPptx).toHaveBeenCalled()
    expect(h.showNotice).not.toHaveBeenCalled()
  })

  it('onExportOffline builds offline HTML and triggers a download', async () => {
    const origCreate = URL.createObjectURL
    const origRevoke = URL.revokeObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const clickSpy = vi.fn()
    const origCreateEl = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreateEl(tag)
      if (tag === 'a') el.click = clickSpy
      return el
    })

    const { result } = renderHook(() => useExportActions(presentation))
    await act(async () => {
      await result.current.onExportOffline()
    })

    expect(h.generateRevealHTML).toHaveBeenCalledWith(presentation)
    expect(h.generateOfflineHTML).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()

    document.createElement.mockRestore()
    URL.createObjectURL = origCreate
    URL.revokeObjectURL = origRevoke
  })

  it('onExportProject delegates to exportProject(presentation)', async () => {
    const { result } = renderHook(() => useExportActions(presentation))
    await act(async () => {
      await result.current.onExportProject()
    })
    expect(h.exportProject).toHaveBeenCalledWith(presentation)
  })

  it('exposes onOpenProject as a function', () => {
    const { result } = renderHook(() => useExportActions(presentation))
    expect(typeof result.current.onOpenProject).toBe('function')
  })
})
