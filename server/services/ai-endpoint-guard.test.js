import dns from 'node:dns/promises'
import { afterEach, describe, expect, it, vi } from 'vitest'
import guardModule from './ai-endpoint-guard.js'

const { assertSafeAiEndpoint, isBlockedIp } = guardModule

describe('AI custom endpoint guard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST
  })

  it('[cap:ai.endpoint-guard tier:deep] blocks private, mapped, and special-use IP ranges', () => {
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
      '::ffff:7f00:1',
      '0:0:0:0:0:ffff:0a00:1',
      '64:ff9b::7f00:1',
      '64:ff9b::0a00:1',
      '64:ff9b:1::7f00:1',
      '100::1',
      '2001:2::1',
      '2001:10::1',
      '2001:20::1',
      '2001:db8::1',
      '2002::1',
      '3fff::1',
      'fec0::1',
    ]) {
      expect(isBlockedIp(ip)).toBe(true)
    }
    expect(isBlockedIp('93.184.216.34')).toBe(false)
    expect(isBlockedIp('::ffff:5db8:d822')).toBe(false)
    expect(isBlockedIp('64:ff9b::5db8:d822')).toBe(false)
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

  it('[cap:ai.endpoint-guard] allows public hosts and pins to the validated IP', async () => {
    vi.spyOn(dns, 'lookup').mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
    const result = await assertSafeAiEndpoint('https://api.example.com/v1')
    expect(result.url).toBe('https://api.example.com/v1')
    expect(result.addresses).toEqual(['93.184.216.34'])
    expect(result.dispatcher).toBeTruthy()
  })

  it('[cap:ai.endpoint-guard] still IP-checks allowlisted hosts (no bypass)', async () => {
    process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST = 'localhost'
    // localhost maps to loopback → blocked even though allowlisted.
    await expect(assertSafeAiEndpoint('http://localhost:11434')).rejects.toThrow(/blocked/)
  })
})
