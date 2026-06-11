// @vitest-environment node
import dns from 'node:dns/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import guardModule from './ai-endpoint-guard.js'

const { assertSafeAiEndpoint } = guardModule

describe('SSRF guard pins the connection to a validated IP', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST
  })

  it('blocks a public hostname that resolves to a private IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
    await expect(assertSafeAiEndpoint('https://evil.example/v1')).rejects.toThrow(/blocked/)
  })

  it('blocks an ALLOWLISTED hostname that resolves to an internal IP (no early-return bypass)', async () => {
    process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST = 'trusted.example'
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '169.254.169.254', family: 4 }])
    await expect(assertSafeAiEndpoint('https://trusted.example/v1')).rejects.toThrow(/blocked/)
  })

  it('blocks an allowlisted host if ANY resolved IP is internal', async () => {
    process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST = 'trusted.example'
    vi.spyOn(dns, 'lookup').mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ])
    await expect(assertSafeAiEndpoint('https://trusted.example/v1')).rejects.toThrow(/blocked/)
  })

  it('allows a public hostname and returns a pinned dispatcher, not a bare URL string', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const result = await assertSafeAiEndpoint('https://api.example.com/v1')

    // Contract changed: must NOT be a bare string that would re-resolve DNS.
    expect(typeof result).not.toBe('string')
    expect(result.url).toBe('https://api.example.com/v1')
    expect(Array.isArray(result.addresses)).toBe(true)
    expect(result.addresses).toEqual(['93.184.216.34'])
    // A dispatcher must be present so fetch connects to the validated IP only.
    expect(result.dispatcher).toBeTruthy()
  })

  it('pins the connect lookup to ONLY the validated addresses', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const result = await assertSafeAiEndpoint('https://api.example.com/v1')
    const lookup = guardModule.buildPinnedLookup(result.addresses)

    const seen = await new Promise((resolve, reject) => {
      lookup('api.example.com', { all: true }, (err, addresses) =>
        err ? reject(err) : resolve(addresses)
      )
    })
    // The lookup hands back only the pre-validated IP, never a fresh DNS answer.
    expect(seen).toEqual([{ address: '93.184.216.34', family: 4 }])
  })
})
