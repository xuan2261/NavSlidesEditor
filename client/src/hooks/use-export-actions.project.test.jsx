import JSZip from 'jszip'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useExportActions } from './use-export-actions'
import { useEditorSaveController } from './editor-controller/use-editor-save-controller'
import { usePresentationStore } from '../stores/presentation-store'
import { showError } from '../utils/app-feedback'

vi.mock('../utils/app-feedback', () => ({ showError: vi.fn(), showNotice: vi.fn(), confirmUser: vi.fn() }))
vi.mock('../utils/editor-draft-store', () => ({
  createEditorDraft: vi.fn((args) => ({ ...args, updatedAt: '2026-10-09T00:00:00Z' })),
  writeEditorDraft: vi.fn().mockResolvedValue(true),
  clearEditorDraft: vi.fn().mockResolvedValue(true),
}))

const initial = { id: 'deck-1', title: 'Initial', pptxSourceAvailable: true, aggregateGeneration: 1,
  slides: [{ id: 'slide-1', elements: [] }] }
const jsonResponse = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
const deferred = () => {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
const blobBytes = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsArrayBuffer(blob)
})

async function archiveFor(presentation) {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({ version: '2.0', media: [], hasLocalMedia: false }))
  zip.file('presentation.json', JSON.stringify(presentation))
  zip.file('package/manifest.json', JSON.stringify({ original: { sha256: 'a'.repeat(64) } }))
  zip.file(`package/blobs/${'a'.repeat(64)}`, 'original-package-bytes')
  return new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' })
}

function renderExport() {
  return renderHook(() => {
    const save = useEditorSaveController({ isTemplate: false })
    const actions = useExportActions(initial, { ...save, flushPendingSave: save.flushAndWait })
    return { ...save, ...actions }
  })
}

describe('P10 project export saved-snapshot consumer', () => {
  let saved, downloaded, archiveFailure, saveFailure, holdArchive, archiveStarted, putTitles
  beforeEach(() => {
    saved = initial
    downloaded = null
    archiveFailure = null
    saveFailure = null
    holdArchive = null
    archiveStarted = deferred()
    putTitles = []
    usePresentationStore.setState({ presentation: initial, saveConflict: null })
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { downloaded = blob; return 'blob:archive' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (url === '/api/presentations/deck-1' && options.method === 'PUT') {
        if (saveFailure) return jsonResponse(saveFailure, 409)
        const body = JSON.parse(options.body)
        putTitles.push(body.title)
        saved = { ...body, aggregateGeneration: saved.aggregateGeneration + 1 }
        return jsonResponse(saved)
      }
      if (url === '/api/presentations/deck-1') return jsonResponse(saved)
      if (url === '/api/presentations/deck-1/project-archive') {
        const captured = saved
        archiveStarted.resolve()
        if (holdArchive) await holdArchive.promise
        if (archiveFailure) return jsonResponse(archiveFailure, 409)
        if (options.headers?.['If-Pptx-Generation'] !== String(captured.aggregateGeneration)) {
          return jsonResponse({ error: 'Source changed', code: 'SYNC_SOURCE_CHANGED' }, 409)
        }
        return { ok: true, blob: async () => archiveFor(captured) }
      }
      throw new Error(`Unexpected HTTP request: ${url}`)
    }))
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('exports dirty saved generation rather than stale render props, preserving the no-media package ZIP', async () => {
    const { result } = renderExport()
    const dirty = { ...initial, title: 'Saved latest' }
    act(() => { usePresentationStore.getState().setPresentation(dirty); result.current.scheduleSave(dirty, 1500) })
    await act(async () => result.current.onExportProject())
    expect(putTitles).toEqual(['Saved latest'])
    expect(downloaded.type).toBe('application/zip')
    const zip = await JSZip.loadAsync(await blobBytes(downloaded))
    expect(JSON.parse(await zip.file('manifest.json').async('text')).version).toBe('2.0')
    expect(JSON.parse(await zip.file('presentation.json').async('text'))).toMatchObject({ title: 'Saved latest', aggregateGeneration: 2 })
    expect(await zip.file(`package/blobs/${'a'.repeat(64)}`).async('text')).toBe('original-package-bytes')
    expect(showError).not.toHaveBeenCalled()
  })

  it('keeps edits queued during export out of the captured archive and saves them after barrier release', async () => {
    holdArchive = deferred()
    const { result } = renderExport()
    let exporting
    await act(async () => { exporting = result.current.onExportProject(); await Promise.resolve(); await Promise.resolve() })
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/project-archive'))).toBe(true)
    // The request is deferred by an explicit server-boundary marker, never a sleep.
    await act(async () => archiveStarted.promise)
    const later = { ...initial, title: 'Later edit' }
    act(() => { usePresentationStore.getState().setPresentation(later); result.current.scheduleSave(later, 0) })
    expect(putTitles).toEqual([])
    holdArchive.resolve()
    await act(async () => exporting)
    const zip = await JSZip.loadAsync(await blobBytes(downloaded))
    expect(JSON.parse(await zip.file('presentation.json').async('text')).title).toBe('Initial')
    await act(async () => result.current.flushAndWait())
    expect(saved.title).toBe('Later edit')
  })

  it('does not download or request an archive when the dirty save conflicts', async () => {
    saveFailure = { error: 'Stale generation', reason: 'STALE_GENERATION', currentGeneration: 3 }
    const { result } = renderExport()
    act(() => result.current.scheduleSave({ ...initial, title: 'Unsaved' }, 1500))
    await act(async () => result.current.onExportProject())
    expect(downloaded).toBeNull()
    expect(saved).toBe(initial)
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/project-archive'))).toBe(false)
    expect(showError).toHaveBeenCalled()
  })

  it('blocks an unresolved conflict even when no save is queued', async () => {
    usePresentationStore.getState().setSaveConflict(initial, 3)
    const { result } = renderExport()
    await act(async () => result.current.onExportProject())
    expect(downloaded).toBeNull()
    expect(fetch.mock.calls.some(([url]) => url.endsWith('/project-archive'))).toBe(false)
  })

  it.each(['SYNC_SOURCE_CHANGED', 'PROJECT_MEDIA_MISSING'])('does not download degraded archives after %s and releases the barrier', async (code) => {
    archiveFailure = { error: code, code }
    const { result } = renderExport()
    await act(async () => result.current.onExportProject())
    expect(downloaded).toBeNull()
    expect(showError).toHaveBeenCalled()
    act(() => result.current.scheduleSave({ ...initial, title: 'Still editable' }, 0))
    await act(async () => result.current.flushAndWait())
    expect(saved.title).toBe('Still editable')
  })
})

describe('P10 Editor Open project atomic admission', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
  it.each(['legacy.json', 'package.navslides'])('rolls back failed media placement without generic creation for %s', async (name) => {
    const file = name.endsWith('.json')
      ? new File([JSON.stringify({ version: '1.1', presentation: initial })], name)
      : new File([await blobBytes(await archiveFor(initial))], name)
    let pending = false
    let published = false
    let genericCreated = false
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
      if (url === '/api/project-imports/preflight') {
        const admitted = options.body.get('file')
        expect(admitted.name).toBe(name)
        if (name.endsWith('.navslides')) {
          const zip = await JSZip.loadAsync(await blobBytes(admitted))
          expect(zip.file('package/manifest.json')).not.toBeNull()
        }
        pending = true
        return jsonResponse({ sessionId: 'session-open', capability: 'secret-cap', mediaCount: 1 })
      }
      if (url === '/api/project-imports/session-open/media') {
        expect(options.headers['X-NavSlides-Import-Capability']).toBe('secret-cap')
        return jsonResponse({ error: 'Owned media unavailable', code: 'PROJECT_MEDIA_MISSING' }, 409)
      }
      if (url === '/api/project-imports/session-open' && options.method === 'DELETE') {
        pending = false
        return jsonResponse({ status: 'rolled-back' })
      }
      if (url.endsWith('/publish')) published = true
      if (url === '/api/presentations' && options.method === 'POST') genericCreated = true
      throw new Error(`Unexpected HTTP request: ${url}`)
    }))
    let input
    const create = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = create(tag)
      if (tag === 'input') { input = element; element.click = vi.fn() }
      return element
    })
    const { result } = renderHook(() => useExportActions(initial))
    act(() => result.current.onOpenProject())
    await act(async () => input.onchange({ target: { files: [file] } }))
    expect(pending).toBe(false)
    expect(published).toBe(false)
    expect(genericCreated).toBe(false)
    expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/session-open') && options.method === 'DELETE')).toBe(true)
  })
})
