import { afterEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  load: vi.fn(),
  requests: vi.fn(),
  print: vi.fn(),
  reveal: vi.fn(),
  exportPDF: vi.fn(),
  presentInWindow: vi.fn(),
  showError: vi.fn(),
}))
vi.mock('../hooks/use-pptx-source-font-loader', () => ({ loadPptxSourceFontResources: h.load }))
vi.mock('revealjs-shared/src/pptx-source-font-request.js', () => ({
  collectSemanticFontRequests: h.requests,
}))
vi.mock('revealjs-shared', () => ({
  generatePrintHTML: h.print,
  generateRevealHTML: h.reveal,
  exportPDF: h.exportPDF,
  presentInWindow: h.presentInWindow,
  getBackgroundAttrs: vi.fn(),
  escapeHtml: vi.fn(),
}))
vi.mock('./app-feedback', () => ({ showError: h.showError }))
import {
  awaitSemanticOutputDocument,
  exportPDF,
  prepareSemanticOutputResources,
  presentInWindow,
  reserveOutputWindow,
  validateSemanticOutputHTML,
} from './generateHTML'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function outputPopup() {
  const navigation = deferred(),
    paint = deferred()
  const handle = { state: 'loading', ready: paint.promise, dispose: vi.fn() }
  const popup = {
    closed: false,
    close: vi.fn(),
    addEventListener: vi.fn(),
    document: { defaultView: { __navslidesSemanticOutput: handle } },
    location: { replace: vi.fn(() => navigation.resolve()) },
  }
  const outputDocument = popup.document
  const documentRead = vi.fn(() => outputDocument)
  Object.defineProperty(popup, 'document', { get: documentRead })
  return { popup, navigation, paint, handle, documentRead }
}
function outputLoaded(popup, overrides = {}) {
  const event = new MessageEvent('message', {
    origin: window.location.origin,
    data: { type: 'navslides-output-loaded', token: 'owned-load-token' },
    ...overrides,
  })
  Object.defineProperty(event, 'source', { value: overrides.source ?? popup })
  window.dispatchEvent(event)
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})
describe('semantic output client caller contract', () => {
  it('rejects cancellation before document load and releases its URL exactly once', async () => {
    const { popup, navigation, documentRead } = outputPopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('owned-load-token')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:output')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    h.requests.mockReturnValue({ identity: 'key', issues: [], faces: [{}] })
    h.load.mockResolvedValue({ schemaVersion: 1 })
    h.print.mockReturnValue('<html><body></body></html>')
    const controller = new AbortController()
    const pending = exportPDF({ pptxSemantic: {} }, { signal: controller.signal })
    await navigation.promise
    controller.abort()
    await pending
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:output')
    expect(documentRead).not.toHaveBeenCalled()
    expect(h.showError).not.toHaveBeenCalled()
    outputLoaded(popup)
    expect(documentRead).not.toHaveBeenCalled()
  })
  it('requires the exact popup, origin and token before propagating destination rejection', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { popup, navigation, paint, documentRead } = outputPopup()
    vi.spyOn(window, 'open').mockReturnValue(popup)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('owned-load-token')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:output')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    h.requests.mockReturnValue({ identity: 'key', issues: [], faces: [{}] })
    h.load.mockResolvedValue({ schemaVersion: 1 })
    h.print.mockReturnValue('<html><body></body></html>')
    const pending = exportPDF({ pptxSemantic: {} })
    await navigation.promise
    outputLoaded(popup, { origin: 'https://other.example' })
    outputLoaded(popup, { source: {} })
    outputLoaded(popup, { data: { type: 'navslides-output-loaded', token: 'foreign' } })
    expect(documentRead).not.toHaveBeenCalled()
    outputLoaded(popup)
    paint.reject(new Error('source-font-hash-mismatch'))
    await pending
    expect(documentRead).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:output')
    expect(popup.close).toHaveBeenCalledOnce()
    expect(h.showError).toHaveBeenCalledOnce()
  })
  it('uses exact current identity and forwards cancellation without a runtime alias', async () => {
    h.requests.mockReturnValue({ identity: 'journal-font-key', issues: [], faces: [{}] })
    const bundle = { schemaVersion: 1, sourceIdentity: 'verified', fontProfile: {}, assets: [] }
    h.load.mockResolvedValue(bundle)
    const signal = new AbortController().signal
    expect(await prepareSemanticOutputResources({ id: 'deck', pptxSemantic: {} }, { signal })).toBe(
      bundle
    )
    expect(h.load).toHaveBeenCalledWith({
      presentationId: 'deck',
      requestIdentity: 'journal-font-key',
      document,
      signal,
    })
    expect(await prepareSemanticOutputResources({ id: 'legacy' })).toBeNull()
  })
  it('awaits the exact semantic Promise and rejects a non-ready or cancelled generation', async () => {
    let release
    const ready = new Promise((resolve) => {
      release = resolve
    })
    const handle = { state: 'loading', ready }
    const output = { defaultView: { __navslidesSemanticOutput: handle } }
    let done = false
    const pending = awaitSemanticOutputDocument(output).then(() => {
      done = true
    })
    expect(done).toBe(false)
    handle.state = 'ready'
    release()
    await pending
    expect(done).toBe(true)
    handle.state = 'disposed'
    await expect(awaitSemanticOutputDocument(output)).rejects.toThrow('not ready')
    const controller = new AbortController()
    handle.ready = new Promise(() => {})
    const aborted = awaitSemanticOutputDocument(output, { signal: controller.signal })
    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
  })
  it('reports rejected legacy operations as well as synchronous popup blocking', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    h.exportPDF.mockRejectedValue(new Error('print rejected'))
    await exportPDF({ id: 'legacy' })
    expect(h.showError).toHaveBeenCalledWith('PDF export failed: print rejected')
    vi.spyOn(window, 'open').mockReturnValue(null)
    expect(() => reserveOutputWindow()).toThrow('blocked')
    h.requests.mockReturnValue({ identity: 'key', issues: [], faces: [{}] })
    await presentInWindow({ pptxSemantic: {} })
    expect(h.showError).toHaveBeenCalledWith('Failed to present: Output window was blocked')
    expect(h.load).not.toHaveBeenCalled()
  })
  it('reserves popup before font work, closes on rejection and never falls back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const popup = { close: vi.fn(), closed: false }
    vi.spyOn(window, 'open').mockReturnValue(popup)
    h.requests.mockReturnValue({ identity: 'key', issues: [], faces: [{}] })
    h.load.mockRejectedValue(new Error('source-font-source-stale'))
    await exportPDF({ id: 'deck', pptxSemantic: {} })
    expect(window.open.mock.invocationCallOrder[0]).toBeLessThan(h.load.mock.invocationCallOrder[0])
    expect(popup.close).toHaveBeenCalledTimes(1)
    expect(h.print).not.toHaveBeenCalled()
    expect(h.exportPDF).not.toHaveBeenCalled()
    expect(h.showError).toHaveBeenCalledWith('PDF export failed: source-font-source-stale')
  })
  it('disposes a validation document after rejection and removes its iframe', async () => {
    const original = document.createElement.bind(document)
    let frame
    const dispose = vi.fn()
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const element = original(tag)
      if (tag === 'iframe') frame = element
      return element
    })
    const pending = validateSemanticOutputHTML('<p>semantic</p>')
    const handle = { state: 'error', ready: Promise.reject(new Error('font mismatch')), dispose }
    handle.ready.catch(() => {})
    Object.defineProperty(frame, 'contentWindow', {
      configurable: true,
      value: { __navslidesSemanticOutput: handle },
    })
    Object.defineProperty(frame, 'contentDocument', {
      configurable: true,
      value: { defaultView: frame.contentWindow },
    })
    frame.onload()
    await expect(pending).rejects.toThrow('font mismatch')
    expect(dispose).toHaveBeenCalledOnce()
    expect(frame.isConnected).toBe(false)
  })
})
