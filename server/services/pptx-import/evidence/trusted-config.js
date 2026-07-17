const { cloneFrozen, isPlainRecord, ownKeys } = require('../own-plain-data')

const FIELDS = Object.freeze([
  'rootSha256', 'policyIdentity', 'authorityFingerprints', 'ledgerCheckpoint',
])

function parseTrustedConfig(input) {
  try {
    const value = cloneFrozen(input)
    if (!isPlainRecord(value) || ownKeys(value)?.some((key) => !FIELDS.includes(key))) return null
    if (!/^[a-f0-9]{64}$/i.test(value.rootSha256 || '')) return null
    if (typeof value.policyIdentity !== 'string' || value.policyIdentity.length > 160) return null
    if (!isPlainRecord(value.authorityFingerprints) || !isPlainRecord(value.ledgerCheckpoint)) return null
    if (Object.keys(value.authorityFingerprints).some((key) => !['ci', 'provider', 'ledger'].includes(key))) return null
    if (!['ci', 'provider', 'ledger'].every((key) => /^[a-f0-9]{64}$/i.test(value.authorityFingerprints[key] || ''))) return null
    if (typeof value.ledgerCheckpoint.identity !== 'string' ||
      !Number.isInteger(value.ledgerCheckpoint.epoch) || value.ledgerCheckpoint.epoch < 0 ||
      !/^[a-f0-9]{64}$/i.test(value.ledgerCheckpoint.digest || '')) return null
    return value
  } catch { return null }
}

module.exports = { parseTrustedConfig }
