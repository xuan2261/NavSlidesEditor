import { useRevealPreviewFrame } from './use-reveal-preview-frame'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

function Harness({ html, frameKey }) {
  const { iframeRef } = useRevealPreviewFrame(html, null, frameKey)
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
})
