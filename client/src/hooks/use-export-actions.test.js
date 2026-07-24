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
  getPptxFidelity: vi.fn(),
  downloadValidatedEditedPptx: vi.fn(),
  flushPendingSave: vi.fn(),
  beginExport: vi.fn(),
  endExport: vi.fn(),
  adoptAggregateGeneration: vi.fn(),
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
vi.mock('../utils/api', () => ({ api: {
  downloadPptxOriginal: h.downloadPptxOriginal,
  getPptxFidelity: h.getPptxFidelity,
  downloadValidatedEditedPptx: h.downloadValidatedEditedPptx,
} }))
vi.mock('../stores/presentation-store', () => ({
  usePresentationStore: {
    getState: () => ({ adoptAggregateGeneration: h.adoptAggregateGeneration }),
  },
}))
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
  h.getPptxFidelity.mockResolvedValue({
    aggregateGeneration: 2, exports: { validatedEdited: { available: true } },
  })
  h.flushPendingSave.mockResolvedValue(true)
  h.beginExport.mockReturnValue(1)
  const edited = new Blob(['edited'])
  Object.defineProperty(edited, 'aggregateGeneration', { value: 3 })
  h.downloadValidatedEditedPptx.mockResolvedValue(edited)
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

  it('downloads authoritative source bytes for a current package-backed presentation', async () => {
    const packageBacked = {
      ...presentation,
      pptxSourceAvailable: true,
      aggregateGeneration: 1,
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:package')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const clickSpy = vi.fn()
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = original(tag)
      if (tag === 'a') element.click = clickSpy
      return element
    })

    const { result } = renderHook(() => useExportActions(packageBacked))
    await act(async () => result.current.onExportPPTX())

    expect(h.downloadPptxOriginal).toHaveBeenCalledWith('p1', 1)
    expect(h.exportToPptx).not.toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()

    document.createElement.mockRestore()
    URL.createObjectURL.mockRestore()
    URL.revokeObjectURL.mockRestore()
  })

  it('fails closed when an original download generation fence is stale', async () => {
    const packageBacked = {
      ...presentation,
      pptxSourceAvailable: true,
      aggregateGeneration: 1,
    }
    h.downloadPptxOriginal.mockRejectedValueOnce(
      Object.assign(new Error('Package generation is stale'), { status: 409, code: 'STALE_GENERATION' })
    )
    const { result } = renderHook(() => useExportActions(packageBacked))

    await act(async () => result.current.onExportPPTX())

    expect(h.downloadPptxOriginal).toHaveBeenCalledWith('p1', 1)
    expect(h.exportToPptx).not.toHaveBeenCalled()
    expect(h.showError).toHaveBeenCalledWith('PPTX export failed: Package generation is stale')
  })

  it('does not download original bytes after package-backed generation advances', async () => {
    const packageBacked = {
      ...presentation,
      pptxSourceAvailable: true,
      aggregateGeneration: 2,
    }
    const { result } = renderHook(() => useExportActions(packageBacked))

    await act(async () => result.current.onExportPPTX())

    expect(h.downloadPptxOriginal).not.toHaveBeenCalled()
    expect(h.exportToPptx).toHaveBeenCalledWith(packageBacked)
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

  it('keeps reconstructed generation explicit even when original bytes exist', async () => {
    const imported = {
      ...presentation,
      pptxOriginal: { id: 'original-1', sha256: 'a'.repeat(64) },
    }
    const { result } = renderHook(() => useExportActions(imported))
    await act(async () => result.current.onGenerateReconstructedPPTX())
    expect(h.downloadPptxOriginal).not.toHaveBeenCalled()
    expect(h.exportToPptx).toHaveBeenCalledWith(imported)
  })

  it('exports a validated edited revision only after current capability validation', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:edited')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = original(tag)
      if (tag === 'a') element.click = click
      return element
    })
    const onAggregateGeneration = vi.fn()
    const { result } = renderHook(() => useExportActions(presentation, {
      flushPendingSave: h.flushPendingSave,
      onAggregateGeneration,
    }))
    await act(async () => result.current.onExportValidatedEditedRevision())
    expect(h.flushPendingSave).toHaveBeenCalledTimes(1)
    expect(h.getPptxFidelity).toHaveBeenCalledWith('p1')
    expect(h.downloadValidatedEditedPptx).toHaveBeenCalledWith('p1', 2, expect.any(String))
    expect(h.adoptAggregateGeneration).toHaveBeenCalledWith(3)
    expect(onAggregateGeneration).toHaveBeenCalledWith(3, 'p1')
    expect(click).toHaveBeenCalled()
  })

  it('allows no-op reconciliation when validated editing is unavailable', async () => {
    h.getPptxFidelity.mockResolvedValueOnce({
      aggregateGeneration: 2,
      exports: { validatedEdited: { available: false, reconciliationAvailable: true } },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:no-op')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = original(tag)
      if (tag === 'a') element.click = click
      return element
    })

    const { result } = renderHook(() => useExportActions(presentation, {
      flushPendingSave: h.flushPendingSave,
    }))
    await act(async () => result.current.onExportValidatedEditedRevision())

    expect(h.downloadValidatedEditedPptx).toHaveBeenCalledWith('p1', 2, expect.any(String))
    expect(click).toHaveBeenCalled()
  })

  it('brackets a slow validated export with the save barrier token', async () => {
    const events = []
    h.flushPendingSave.mockImplementationOnce(async () => {
      events.push('flush')
      return true
    })
    h.beginExport.mockImplementationOnce(() => {
      events.push('begin')
      return 7
    })
    h.getPptxFidelity.mockImplementationOnce(async () => {
      events.push('fidelity')
      return { aggregateGeneration: 2, exports: { validatedEdited: { available: true } } }
    })
    h.downloadValidatedEditedPptx.mockImplementationOnce(async () => {
      events.push('download')
      return Object.assign(new Blob(['edited']), { aggregateGeneration: 3 })
    })
    h.endExport.mockImplementationOnce((token) => events.push(`end:${token}`))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:edited')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.fn()
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = original(tag)
      if (tag === 'a') element.click = click
      return element
    })

    const { result } = renderHook(() => useExportActions(presentation, {
      beginExport: h.beginExport,
      endExport: h.endExport,
      flushPendingSave: h.flushPendingSave,
    }))
    await act(async () => result.current.onExportValidatedEditedRevision())

    expect(events).toEqual(['flush', 'begin', 'fidelity', 'download', 'end:7'])
    expect(click).toHaveBeenCalled()
  })

  it('releases the validated export token when capability validation fails', async () => {
    h.getPptxFidelity.mockRejectedValueOnce(new Error('validator unavailable'))
    h.beginExport.mockReturnValueOnce(8)
    const { result } = renderHook(() => useExportActions(presentation, {
      beginExport: h.beginExport,
      endExport: h.endExport,
      flushPendingSave: h.flushPendingSave,
    }))

    await act(async () => result.current.onExportValidatedEditedRevision())

    expect(h.endExport).toHaveBeenCalledWith(8)
    expect(h.showError).toHaveBeenCalledWith(
      'Validated edited PPTX export failed: validator unavailable'
    )
  })

  it('does not start a second validated export while the first is slow', async () => {
    let resolveFidelity
    h.beginExport
      .mockReturnValueOnce(1)
      .mockReturnValueOnce(null)
    h.getPptxFidelity.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFidelity = resolve
    }))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:edited')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const original = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = original(tag)
      if (tag === 'a') element.click = vi.fn()
      return element
    })

    const { result } = renderHook(() => useExportActions(presentation, {
      beginExport: h.beginExport,
      endExport: h.endExport,
      flushPendingSave: h.flushPendingSave,
    }))
    let firstExport
    await act(async () => {
      firstExport = result.current.onExportValidatedEditedRevision()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(h.beginExport).toHaveBeenCalledTimes(1)
    expect(h.getPptxFidelity).toHaveBeenCalledTimes(1)

    await act(async () => result.current.onExportValidatedEditedRevision())
    expect(h.beginExport).toHaveBeenCalledTimes(2)
    expect(h.getPptxFidelity).toHaveBeenCalledTimes(1)
    expect(h.downloadValidatedEditedPptx).not.toHaveBeenCalled()

    resolveFidelity({ aggregateGeneration: 2, exports: { validatedEdited: { available: true } } })
    await act(async () => firstExport)
    expect(h.endExport).toHaveBeenCalledWith(1)
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
