import { afterEach, describe, expect, it, vi } from 'vitest'
import providerModule from './ai-provider.js'

const { callAI } = providerModule
const originalFetch = global.fetch

describe('AI provider custom endpoint transport', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    global.fetch = originalFetch
  })

  it('[cap:ai.endpoint-guard tier:deep] does not follow redirects after endpoint validation', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 302,
      statusText: 'Found',
      headers: new Map([['location', 'http://169.254.169.254/latest/meta-data']]),
    }))
    global.fetch = fetchMock

    await expect(
      callAI(
        { provider: 'custom', customEndpoint: 'https://93.184.216.34/v1' },
        'system',
        'user'
      )
    ).rejects.toThrow(/Custom API Error/)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
  })
})
