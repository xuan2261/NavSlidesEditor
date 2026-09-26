import { afterEach, describe, expect, it, vi } from 'vitest'
import { presentInWindow } from '../src/htmlGenerator.js'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('presentation starting position', () => {
  it('opens the requested horizontal and vertical position', () => {
    const open = vi.spyOn(globalThis.window, 'open').mockImplementation(() => null)
    presentInWindow({ id: 'deck', slides: [{}, {}, { children: [{}, {}] }] }, { startAt: { h: 2, v: 1 } })
    const url = new URL(open.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/api/presentations/deck/present')
    expect(url.hash).toBe('#/2/1')
  })

  it('keeps a from-start launch at the beginning', () => {
    const open = vi.spyOn(globalThis.window, 'open').mockImplementation(() => null)
    presentInWindow({ id: 'deck', slides: [{}] })
    expect(open.mock.calls[0][0]).toBe('/api/presentations/deck/present')
  })

  it('starts an unsaved presentation at its vertical position and revokes the bare blob URL', () => {
    vi.useFakeTimers()
    const blobUrl = 'blob:http://localhost/unsaved-deck'
    const createObjectURL = vi.fn(() => blobUrl)
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    })
    const open = vi.spyOn(globalThis.window, 'open').mockImplementation(() => null)
    presentInWindow({
      title: 'Unsaved deck',
      slides: [
        { elements: [] },
        { elements: [], children: [{ elements: [] }] },
      ],
    }, { startAt: { h: 1, v: 1 } })

    expect(open).toHaveBeenCalledWith(`${blobUrl}#/1/1`, '_blank')
    expect(createObjectURL.mock.calls[0][0].type).toBe('text/html')
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runOnlyPendingTimers()
    expect(revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith(blobUrl)
  })
})
