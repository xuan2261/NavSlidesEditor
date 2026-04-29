import { beforeEach, describe, expect, it, vi } from 'vitest'
import dns from 'dns'
import { assertSafeAiEndpoint } from './ai-endpoint-guard.js'

describe('ai-endpoint-guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST = ''
  })

  it('rejects localhost and private endpoints', async () => {
    await expect(assertSafeAiEndpoint('http://localhost:11434/v1')).rejects.toThrow(
      'Private or local endpoints are blocked'
    )
    await expect(assertSafeAiEndpoint('http://127.0.0.1:11434/v1')).rejects.toThrow(
      'Private or local endpoints are blocked'
    )
  })

  it('rejects hostnames that resolve to private addresses', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '192.168.1.8' }])
    await expect(assertSafeAiEndpoint('https://intranet.example/v1')).rejects.toThrow(
      'Private or local endpoints are blocked'
    )
  })

  it('allows hostnames that resolve to public addresses', async () => {
    vi.spyOn(dns.promises, 'lookup').mockResolvedValue([{ address: '8.8.8.8' }])
    await expect(assertSafeAiEndpoint('https://api.example.com/v1')).resolves.toContain(
      'https://api.example.com/v1'
    )
  })
})
