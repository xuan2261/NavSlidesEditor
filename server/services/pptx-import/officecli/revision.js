const crypto = require('node:crypto')
const { gatewayError } = require('./errors')

const SHA256 = /^[a-f0-9]{64}$/i

function createRevisionDescriptor(input) {
  if (!input || typeof input.id !== 'string' || !input.id) {
    throw new TypeError('Revision id is required')
  }
  if (!SHA256.test(input.sha256 || '') || !Number.isSafeInteger(input.byteLength)) {
    throw new TypeError('Revision hash and byte length are required')
  }
  const verdict = input.safetyVerdict
    ? Object.freeze({ ...input.safetyVerdict })
    : null
  return Object.freeze({
    id: input.id,
    sha256: input.sha256.toLowerCase(),
    byteLength: input.byteLength,
    safetyVerdict: verdict,
  })
}

function assertGuardedRevision(revision) {
  const verdict = revision?.safetyVerdict
  if (!Object.isFrozen(revision) || !verdict?.rawZipSafe || !verdict?.xmlSafe ||
      verdict.verifiedSha256?.toLowerCase() !== revision.sha256?.toLowerCase()) {
    throw gatewayError('UNGUARDED_REVISION', 'Package revision has no verified safety verdict')
  }
}

function verifyRevisionBytes(revision, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length !== revision.byteLength) {
    throw gatewayError('REVISION_HASH_MISMATCH', 'Package revision no longer matches its descriptor')
  }
  const actual = crypto.createHash('sha256').update(bytes).digest('hex')
  const expected = Buffer.from(revision.sha256, 'hex')
  if (!crypto.timingSafeEqual(Buffer.from(actual, 'hex'), expected)) {
    throw gatewayError('REVISION_HASH_MISMATCH', 'Package revision no longer matches its descriptor')
  }
}

module.exports = { assertGuardedRevision, createRevisionDescriptor, verifyRevisionBytes }
