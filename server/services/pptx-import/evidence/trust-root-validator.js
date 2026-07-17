const { createHash, createPrivateKey, createPublicKey } = require('node:crypto')

const AUTHORITY_ROLES = Object.freeze(['ci', 'provider', 'ledger'])

function isPrivateKey(value) {
  try {
    createPrivateKey(value)
    return true
  } catch {
    return false
  }
}

function publicKeyFingerprint(value) {
  try {
    const key = createPublicKey(value)
    if (key.asymmetricKeyType !== 'ed25519') return null
    const der = key.export({ type: 'spki', format: 'der' })
    return createHash('sha256').update(der).digest('hex')
  } catch {
    return null
  }
}

function validateAuthorityKeys(publicKeys, reasons) {
  const fingerprints = []
  for (const role of AUTHORITY_ROLES) {
    const key = publicKeys?.[role]
    if (!key) continue
    if (isPrivateKey(key)) reasons.push('trust-root-private-key-forbidden')
    const fingerprint = publicKeyFingerprint(key)
    if (!fingerprint) reasons.push(`invalid-${role}-authority-key`)
    else fingerprints.push(fingerprint)
  }
  if (new Set(fingerprints).size !== fingerprints.length) {
    reasons.push('non-independent-authority-keys')
  }
}

function validateTrustedRoot(trustRoot, trustedConfig, reasons) {
  if (!trustedConfig || typeof trustedConfig !== 'object') {
    reasons.push('missing-trusted-config')
    return false
  }
  const { hashCanonical } = require('./canonical-hash')
  if (!/^[a-f0-9]{64}$/i.test(trustedConfig.rootSha256 || '') ||
      hashCanonical(trustRoot) !== trustedConfig.rootSha256.toLowerCase()) {
    reasons.push('unpinned-trust-root')
  }
  if (trustRoot?.policy?.identity !== trustedConfig.policyIdentity) {
    reasons.push('untrusted-policy-identity')
  }
  for (const role of AUTHORITY_ROLES) {
    if (publicKeyFingerprint(trustRoot?.publicKeys?.[role]) !==
        trustedConfig.authorityFingerprints?.[role]) {
      reasons.push(`unpinned-${role}-authority`)
    }
  }
  return true
}

module.exports = { publicKeyFingerprint, validateAuthorityKeys, validateTrustedRoot }
