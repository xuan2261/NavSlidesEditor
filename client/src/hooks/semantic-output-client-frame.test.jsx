import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRevealPreviewFrame } from './use-reveal-preview-frame'

function Harness({ html, frameKey = 0, state = null }) {
  const { iframeRef, status, error } = useRevealPreviewFrame(html, state, frameKey)
  return <><iframe ref={iframeRef} title="semantic-preview" /><output>{error || status}</output></>
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function destination(frame, gate) {
  let revealReady
  const deck = {
    isReady: vi.fn(() => false), on: vi.fn((_event, listener) => { revealReady = listener }),
    off: vi.fn(), configure: vi.fn(), slide: vi.fn(),
  }
  const handle = { state: 'loading', ready: gate.promise, dispose: vi.fn() }
  Object.defineProperty(frame, 'contentWindow', {
    configurable: true, value: {
      Reveal: deck, __navslidesSemanticOutput: handle,
      document: { getElementById: () => null },
    },
  })
  return { deck, handle, ready: () => revealReady() }
}
afterEach(() => { vi.restoreAllMocks() })
describe('semantic preview exact readiness and generation ownership', () => {
  it('does not configure or navigate until semantic paint and Reveal ready both complete', async () => {
    const view = render(<Harness html="<p>A</p>" state={{ slideIndex: 1, verticalIndex: 2, fragmentIndex: 3 }} />)
    const gate = deferred(), output = destination(view.getByTitle('semantic-preview'), gate)
    let load
    act(() => { load = view.getByTitle('semantic-preview').onload() })
    expect(output.deck.on).not.toHaveBeenCalled()
    expect(output.deck.configure).not.toHaveBeenCalled()
    await act(async () => { output.handle.state = 'ready'; gate.resolve(); await load })
    expect(output.deck.on).toHaveBeenCalledWith('ready', expect.any(Function))
    expect(output.deck.slide).not.toHaveBeenCalled()
    act(() => output.ready())
    expect(output.deck.slide).toHaveBeenCalledWith(1, 2, 3)
    expect(view.getByText('ready')).toBeTruthy()
    view.unmount()
    expect(output.handle.dispose).toHaveBeenCalledOnce()
  })
  it('disposes replacement generations and ignores late completions and stale load callbacks', async () => {
    const view = render(<Harness html="<p>A</p>" />)
    const frame = view.getByTitle('semantic-preview'), gate = deferred(), output = destination(frame, gate)
    const stale = frame.onload
    let load
    act(() => { load = stale() })
    const replacement = deferred()
    destination(frame, replacement)
    view.rerender(<Harness html="<p>B</p>" frameKey={1} />)
    expect(output.handle.dispose).toHaveBeenCalledOnce()
    await act(async () => { output.handle.state = 'ready'; gate.resolve(); await load; await stale() })
    expect(output.deck.on).not.toHaveBeenCalled()
    expect(output.deck.configure).not.toHaveBeenCalled()
    view.unmount()
  })
  it('surfaces semantic rejection with no Reveal navigation or fallback', async () => {
    const view = render(<Harness html="<p>A</p>" />)
    const gate = deferred(), output = destination(view.getByTitle('semantic-preview'), gate)
    let load
    act(() => { load = view.getByTitle('semantic-preview').onload() })
    await act(async () => { gate.reject(new Error('source-font-hash-mismatch')); await load })
    expect(view.getByText('source-font-hash-mismatch')).toBeTruthy()
    expect(output.deck.on).not.toHaveBeenCalled()
    expect(output.deck.slide).not.toHaveBeenCalled()
    view.unmount()
  })
})
