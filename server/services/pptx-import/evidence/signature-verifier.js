const { verify } = require('node:crypto')
const { hashCanonical } = require('./canonical-hash')

function unsigned(value) {
  if (!value || typeof value !== 'object') return null
  const { signature: _signature, ...payload } = value
  return payload
}

function verifySigned(value, publicKey) {
  if (!value?.signature || !publicKey) return false
  try {
    return verify(
      null,
      Buffer.from(hashCanonical(unsigned(value))),
      publicKey,
      Buffer.from(value.signature, 'base64')
    )
  } catch {
    return false
  }
}

module.exports = { unsigned, verifySigned }
