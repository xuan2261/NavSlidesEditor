import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({
  pdf: vi.fn(),
  generate: vi.fn(() => '<html>semantic</html>'),
  prepare: vi.fn(),
  validate: vi.fn(),
  reserve: vi.fn(),
  offline: vi.fn(),
  get: vi.fn(),
  error: vi.fn(),
  state: { saveConflict: false },
  project: vi.fn(),
}))
vi.mock('../utils/generateHTML', () => ({
  exportPDF: h.pdf,
  generateRevealHTML: h.generate,
  prepareSemanticOutputResources: h.prepare,
  validateSemanticOutputHTML: h.validate,
  reserveOutputWindow: h.reserve,
}))
vi.mock('../utils/offlineExport', () => ({ generateOfflineHTML: h.offline }))
vi.mock('../utils/export-project', () => ({ exportProject: h.project }))
vi.mock('./use-project-import', () => ({ useProjectImport: () => vi.fn() }))
vi.mock('../utils/api', () => ({ api: { getPresentation: h.get } }))
vi.mock('../stores/presentation-store', () => ({
  usePresentationStore: { getState: () => h.state },
}))
vi.mock('../utils/app-feedback', () => ({ showError: h.error, showNotice: vi.fn() }))
import { useExportActions } from './use-export-actions'
const semantic = { schemaVersion: 1 }
const current = { id: 'deck', title: 'current', pptxSemantic: semantic }
const saved = { ...current, title: 'saved' }
function deferred() {
  let resolve
  const promise = new Promise((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.clearAllMocks()
  h.state.saveConflict = false
  h.get.mockResolvedValue(saved)
  h.prepare.mockResolvedValue({ schemaVersion: 1, sourceIdentity: 'saved-identity' })
  h.offline.mockResolvedValue('<html>portable</html>')
  h.validate.mockResolvedValue()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:artifact')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())
describe('saved semantic output snapshots', () => {
  it('waits for save ACK, uses matching saved snapshot, and validates closure before download', async () => {
    const ack = deferred(),
      paint = deferred(),
      entered = deferred()
    const flushPendingSave = vi.fn(() => ack.promise)
    h.validate.mockImplementation(() => {
      entered.resolve()
      return paint.promise
    })
    const beginExport = vi.fn(() => 7),
      endExport = vi.fn()
    const { result } = renderHook(() =>
      useExportActions(current, { flushPendingSave, beginExport, endExport })
    )
    let pending
    act(() => {
      pending = result.current.onExportHTML()
    })
    expect(h.get).not.toHaveBeenCalled()
    await act(async () => {
      ack.resolve(true)
      await entered.promise
    })
    expect(h.prepare).toHaveBeenCalledWith(saved, { signal: expect.any(AbortSignal) })
    expect(h.generate).toHaveBeenCalledWith(saved, {
      portable: true,
      semanticOutputResources: { schemaVersion: 1, sourceIdentity: 'saved-identity' },
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await act(async () => {
      paint.resolve()
      await pending
    })
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(endExport).toHaveBeenCalledWith(7)
  })
  it('reserves PDF window synchronously before save work and closes it on failed ACK', async () => {
    const ack = deferred(),
      popup = { close: vi.fn() }
    h.reserve.mockReturnValue(popup)
    const flushPendingSave = vi.fn(() => ack.promise)
    const { result } = renderHook(() => useExportActions(current, { flushPendingSave }))
    let pending
    act(() => {
      pending = result.current.onExportPDF()
    })
    expect(h.reserve.mock.invocationCallOrder[0]).toBeLessThan(
      flushPendingSave.mock.invocationCallOrder[0]
    )
    expect(h.pdf).not.toHaveBeenCalled()
    await act(async () => {
      ack.resolve(false)
      await pending
    })
    expect(popup.close).toHaveBeenCalledOnce()
    expect(h.error).toHaveBeenCalledWith(expect.stringContaining('Unable to save'))
  })
  it('cancels in-flight validation on unmount and never downloads its late success', async () => {
    const paint = deferred(),
      entered = deferred()
    h.validate.mockImplementation(() => {
      entered.resolve()
      return paint.promise
    })
    const { result, unmount } = renderHook(() => useExportActions(current))
    let pending
    await act(async () => {
      pending = result.current.onExportHTML()
      await entered.promise
    })
    unmount()
    expect(h.validate.mock.calls[0][1].signal.aborted).toBe(true)
    await act(async () => {
      paint.resolve()
      await pending
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(h.error).not.toHaveBeenCalled()
  })
  it.each(['unmount', 'switch presentation', 'start another output'])(
    'closes the reserved PDF window before save ACK on %s',
    async (reason) => {
      const ack = deferred(),
        popup = { close: vi.fn() }
      h.reserve.mockReturnValue(popup)
      const flushPendingSave = vi.fn(() => ack.promise)
      const { result, unmount, rerender } = renderHook(
        ({ presentation }) => useExportActions(presentation, { flushPendingSave }),
        { initialProps: { presentation: current } }
      )
      let pending, replacement
      act(() => {
        pending = result.current.onExportPDF()
      })
      expect(h.reserve).toHaveBeenCalledOnce()
      if (reason === 'unmount') unmount()
      else if (reason === 'switch presentation')
        rerender({ presentation: { ...current, id: 'other' } })
      else
        act(() => {
          replacement = result.current.onExportHTML()
        })
      const closedBeforeAck = popup.close.mock.calls.length > 0
      await act(async () => {
        ack.resolve(false)
        await pending
        await replacement
      })
      expect(closedBeforeAck).toBe(true)
      expect(h.pdf).not.toHaveBeenCalled()
      expect(h.get).not.toHaveBeenCalled()
      if (reason !== 'start another output') expect(h.error).not.toHaveBeenCalled()
    }
  )
  it('rejects a save conflict appearing during the authoritative snapshot read', async () => {
    const snapshot = deferred(),
      entered = deferred()
    h.get.mockImplementation(() => {
      entered.resolve()
      return snapshot.promise
    })
    const beginExport = vi.fn(() => 7)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useExportActions(current, { beginExport }))
    let pending
    await act(async () => {
      pending = result.current.onExportHTML()
      await entered.promise
    })
    h.state.saveConflict = true
    await act(async () => {
      snapshot.resolve(saved)
      await pending
    })
    expect(h.prepare).not.toHaveBeenCalled()
    expect(h.generate).not.toHaveBeenCalled()
    expect(beginExport).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(h.error).toHaveBeenCalledOnce()
  })
})
