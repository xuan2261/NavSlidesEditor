import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from './copy-to-clipboard'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('copyTextToClipboard', () => {
  it('uses the async clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await expect(copyTextToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to a hidden textarea when the async API rejects', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('permission denied')) },
    })
    const execCommand = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    })

    await expect(copyTextToClipboard('fallback text')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('returns false when neither clipboard path is available', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: undefined,
    })

    await expect(copyTextToClipboard('unavailable')).resolves.toBe(false)
  })
})
