import dns from 'node:dns/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import guardModule from './ai-endpoint-guard.js'

const { assertSafeAiEndpoint, isBlockedIp } = guardModule

describe('AI custom endpoint guard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST
  })

  it('[cap:ai.endpoint-guard tier:deep] blocks private and metadata IP ranges', () => {
    for (const ip of [
      '127.0.0.1',
      '10.0.0.5',
      '172.16.0.10',
      '192.168.1.7',
      '169.254.169.254',
      '::1',
      'fc00::1',
      'fe80::1',
      '::ffff:127.0.0.1',
    ]) {
      expect(isBlockedIp(ip)).toBe(true)
    }
    expect(isBlockedIp('93.184.216.34')).toBe(false)
    expect(isBlockedIp('2606:2800:220:1:248:1893:25c8:1946')).toBe(false)
  })

  it('[cap:ai.endpoint-guard tier:deep] rejects unsupported protocols and local hostnames', async () => {
    await expect(assertSafeAiEndpoint('file:///etc/passwd')).rejects.toThrow(/HTTP\(S\)/)
    await expect(assertSafeAiEndpoint('http://localhost:11434')).rejects.toThrow(/blocked/)
    await expect(assertSafeAiEndpoint('http://model.localhost/v1')).rejects.toThrow(/blocked/)
    await expect(assertSafeAiEndpoint('http://127.0.0.1:11434')).rejects.toThrow(/blocked/)
    await expect(assertSafeAiEndpoint('http://169.254.169.254/latest')).rejects.toThrow(/blocked/)
  })

  it('[cap:ai.endpoint-guard tier:deep] rejects DNS names resolving to private ranges', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '10.0.0.1', family: 4 }])
    await expect(assertSafeAiEndpoint('https://model.example/v1')).rejects.toThrow(/blocked/)
  })

  it('[cap:ai.endpoint-guard] allows public hosts and explicit hostname allowlist entries', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeAiEndpoint('https://api.example.com/v1')).resolves.toBe(
      'https://api.example.com/v1'
    )

    process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST = 'localhost'
    await expect(assertSafeAiEndpoint('http://localhost:11434')).resolves.toBe(
      'http://localhost:11434/'
    )
  })
})
