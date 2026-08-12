import { describe, expect, it } from 'vitest'
import { getExposureWarning, isLoopbackHost, resolveListenHost } from './listen-host-policy.js'

describe('listen host policy', () => {
  it('defaults to IPv4 loopback and rejects URL-like values', () => {
    expect(resolveListenHost()).toBe('127.0.0.1')
    expect(resolveListenHost({ envHost: '0.0.0.0' })).toBe('0.0.0.0')
    expect(resolveListenHost({ explicitHost: '::1' })).toBe('::1')
    expect(() => resolveListenHost({ explicitHost: 'http://0.0.0.0' })).toThrow('Invalid listen host')
  })
  it('warns on every unacknowledged non-loopback exposure', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true)
    expect(getExposureWarning('0.0.0.0')).toMatchObject({
      code: 'unauthenticated-network-exposure',
      address: '0.0.0.0',
    })
    expect(getExposureWarning('0.0.0.0', true)).toMatchObject({
      code: 'unauthenticated-network-exposure',
    })
  })
})
