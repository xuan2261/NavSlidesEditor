import { useRevealPreviewFrame } from './use-reveal-preview-frame'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

function Harness({ html, frameKey, state = null }) {
  const { iframeRef } = useRevealPreviewFrame(html, state, frameKey)
  return <iframe ref={iframeRef} title="preview" />
}

describe('useRevealPreviewFrame timer ownership', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('ignores stale onload callbacks and clears the active generation timers on unmount', () => {
    vi.useFakeTimers()
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const view = render(<Harness html="<p>A</p>" frameKey={1} />)
    const iframe = view.getByTitle('preview')
    const staleOnload = iframe.onload

    view.rerender(<Harness html="<p>B</p>" frameKey={2} />)
    const activeOnload = iframe.onload
    setIntervalSpy.mockClear()
    setTimeoutSpy.mockClear()

    staleOnload()
    expect(setIntervalSpy).not.toHaveBeenCalled()
    expect(setTimeoutSpy).not.toHaveBeenCalled()

    activeOnload()
    const intervalId = setIntervalSpy.mock.results[0].value
    const timeoutId = setTimeoutSpy.mock.results[0].value
    view.unmount()

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId)
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId)
  })

  it('configures and navigates horizontal, vertical, and fragment state after Reveal is ready', () => {
    vi.useFakeTimers()
    const deck = {
      isReady: vi.fn(() => true),
      configure: vi.fn(),
      slide: vi.fn(),
    }
    const view = render(
      <Harness
        html="<p>Reveal 6</p>"
        frameKey={1}
        state={{ slideIndex: 2, verticalIndex: 1, fragmentIndex: 3 }}
      />
    )
    const iframe = view.getByTitle('preview')
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      value: { Reveal: deck, document: { getElementById: vi.fn(() => null) } },
    })

    iframe.onload()
    vi.advanceTimersByTime(100)

    expect(deck.configure).toHaveBeenCalledTimes(1)
    expect(deck.slide).toHaveBeenCalledWith(2, 1, 3)

    view.rerender(
      <Harness
        html="<p>Reveal 6</p>"
        frameKey={1}
        state={{ slideIndex: 4, verticalIndex: 2, fragmentIndex: 0 }}
      />
    )
    expect(deck.slide).toHaveBeenLastCalledWith(4, 2, 0)
    view.unmount()
  })
})
