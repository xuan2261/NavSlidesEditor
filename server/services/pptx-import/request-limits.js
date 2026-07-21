const MAX_IDEMPOTENCY_KEY_LENGTH = 128
const OPAQUE_ASCII_KEY = /^[\x21-\x7e]+$/u

function isValidIdempotencyKey(value) {
  return typeof value === 'string' &&
    value.length <= MAX_IDEMPOTENCY_KEY_LENGTH &&
    OPAQUE_ASCII_KEY.test(value)
}

module.exports = { MAX_IDEMPOTENCY_KEY_LENGTH, isValidIdempotencyKey }
