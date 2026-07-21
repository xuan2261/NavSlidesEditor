import { describe, expect, it } from 'vitest'
import limits from './request-limits.js'

const { MAX_IDEMPOTENCY_KEY_LENGTH, isValidIdempotencyKey } = limits

describe('request limits', () => {
  it('bounds idempotency keys to printable ASCII and 128 bytes', () => {
    expect(MAX_IDEMPOTENCY_KEY_LENGTH).toBe(128)
    expect(isValidIdempotencyKey('x'.repeat(128))).toBe(true)
    expect(isValidIdempotencyKey('opaque-key-01')).toBe(true)
  })

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['overlong', 'x'.repeat(129)],
    ['non-ASCII', 'clé'],
    ['control character', 'key\nvalue'],
  ])('rejects %s idempotency keys', (_, value) => {
    expect(isValidIdempotencyKey(value)).toBe(false)
  })
})
