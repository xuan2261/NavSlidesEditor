import { createHash } from 'node:crypto'

export const SHA256 = /^[0-9a-f]{64}$/
export const GIT_SHA = /^[0-9a-f]{40}$/

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    )
  }
  return value
}

export function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function hashCanonical(value) {
  return sha256(canonicalJson(value))
}

export function assertHex(value, pattern, name) {
  if (!pattern.test(value ?? '')) throw new Error(`${name} must be canonical hexadecimal`)
}

export function assertCommon(receipt, expected = receipt) {
  if (!receipt || typeof receipt !== 'object') throw new Error('receipt is required')
  assertHex(receipt.subjectSha, GIT_SHA, 'subjectSha')
  assertHex(receipt.clientDigest, SHA256, 'clientDigest')
  for (const name of ['schemaVersion', 'policyVersion', 'qualificationId']) {
    if (!receipt[name]) throw new Error(`${name} is required`)
    if (expected[name] && receipt[name] !== expected[name]) throw new Error(`${name} mismatch`)
  }
  for (const name of ['subjectSha', 'clientDigest']) {
    if (expected[name] && receipt[name] !== expected[name]) throw new Error(`${name} mismatch`)
  }
  if (!receipt.lockHashes || Object.keys(receipt.lockHashes).length === 0) {
    throw new Error('lockHashes are required')
  }
  for (const [name, digest] of Object.entries(receipt.lockHashes)) {
    assertHex(digest, SHA256, `lockHashes.${name}`)
    if (expected.lockHashes?.[name] !== undefined && expected.lockHashes[name] !== digest) {
      throw new Error(`lockHashes.${name} mismatch`)
    }
  }
}
