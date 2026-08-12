import { describe, expect, it } from 'vitest'
import { createCrc32, crc32 } from './crc32.js'

describe('incremental CRC32', () => {
  it('matches the standard vector', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
  })

  it('matches one-shot output when updated in chunks', () => {
    const crc = createCrc32()
    crc.update(Buffer.from('1234')).update(Buffer.from('5678')).update(Buffer.from('9'))
    expect(crc.digest()).toBe(crc32(Buffer.from('123456789')))
  })
})
