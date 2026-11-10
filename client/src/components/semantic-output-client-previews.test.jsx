import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({
  prepare: vi.fn(), generate: vi.fn(() => '<html>semantic</html>'),
  offline: vi.fn(), frame: vi.fn(() => ({ iframeRef: { current: null }, status: 'loading' })),
}))
vi.mock('../utils/generateHTML', () => ({
  prepareSemanticOutputResources: h.prepare, generateRevealHTML: h.generate,
}))
vi.mock('../utils/offlineExport', () => ({ generateOfflineHTML: h.offline }))
vi.mock('../hooks/use-reveal-preview-frame', () => ({ useRevealPreviewFrame: h.frame }))
vi.mock('./transition-preview-helpers', () => ({
  resolveTransitionPreviewSlides: ({ presentation }) => ({
    currentSlide: presentation.slides[0], nextSlide: presentation.slides[1],
    currentAddress: '1', nextAddress: '2',
  }),
  buildTransitionPreviewHtml: (options) => ({
    html: h.generate(options.presentation, { semanticOutputResources: options.semanticOutputResources }),
  }),
}))
vi.mock('revealjs-shared', () => ({
  resolveEffectiveTransition: () => ({ transition: 'slide', direction: 'default', duration: null }),
  resolveEffectiveSlide: (slide) => ({ slide }),
}))
import AnimationPreviewModal from './AnimationPreviewModal'
import TransitionPreview from './TransitionPreview'
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const semantic = { schemaVersion: 1, instances: { originalSlideIdentity: {} } }
const presentation = {
  id: 'deck', pptxSemantic: semantic,
  slides: [{ id: 's1', elements: [] }, { id: 's2', elements: [] }],
}
beforeEach(() => {
  vi.clearAllMocks()
  h.offline.mockImplementation(async (html) => html)
})
afterEach(() => vi.restoreAllMocks())
describe('asynchronous semantic preview callers', () => {
  it('keeps the full canonical snapshot and selected slide while preparing outside render', async () => {
    const gate = deferred()
    h.prepare.mockReturnValue(gate.promise)
    const view = render(<AnimationPreviewModal presentation={presentation} slideIndex={1} onClose={() => {}} />)
    expect(h.generate).not.toHaveBeenCalled()
    const [snapshot, { signal }] = h.prepare.mock.calls[0]
    expect(snapshot.pptxSemantic).toBe(semantic)
    expect(snapshot.slides[0].id).toBe('s2')
    const resources = { schemaVersion: 1, sourceIdentity: 'verified' }
    await act(async () => { gate.resolve(resources); await gate.promise })
    expect(h.generate).toHaveBeenCalledWith(snapshot, { semanticOutputResources: resources })
    expect(h.frame).toHaveBeenLastCalledWith('<html>semantic</html>', expect.any(Object))
    view.unmount()
    expect(signal.aborted).toBe(true)
  })
  it('cancels stale animation callbacks and never generates from a rejected resource load', async () => {
    const gate = deferred()
    h.prepare.mockReturnValue(gate.promise)
    const view = render(<AnimationPreviewModal presentation={presentation} slideIndex={0} onClose={() => {}} />)
    view.unmount()
    await act(async () => { gate.resolve({}); await gate.promise })
    expect(h.generate).not.toHaveBeenCalled()
  })
  it('does not fall back to local HTML when semantic transition preparation fails', async () => {
    const gate = deferred()
    h.prepare.mockReturnValue(gate.promise)
    const view = render(<TransitionPreview presentation={presentation} fromIndex={0} onClose={() => {}} />)
    await act(async () => { gate.reject(new Error('source-font-source-stale')); await gate.promise.catch(() => {}) })
    expect(view.getByText('source-font-source-stale')).toBeTruthy()
    expect(h.generate).not.toHaveBeenCalled()
    expect(h.offline).not.toHaveBeenCalled()
    expect(h.frame).toHaveBeenLastCalledWith('', null, 0)
    view.unmount()
  })
})
