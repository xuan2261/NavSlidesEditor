const crypto = require('node:crypto')

const CAPABILITY_SCOPE = 'project-import:mutate'

function sessionError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status })
}

function hashCapability(capability, salt) {
  return crypto.scryptSync(String(capability), salt, 32).toString('hex')
}

function secureEqual(left, right) {
  const a = Buffer.from(String(left), 'hex')
  const b = Buffer.from(String(right), 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function verifyCapability(record, capability) {
  if (!record || record.scope !== CAPABILITY_SCOPE) {
    throw sessionError('PROJECT_IMPORT_CAPABILITY_INVALID', 'Import capability is invalid', 403)
  }
  const terminal = ['committed', 'rolled-back'].includes(record.state)
  if (record.revokedAt && !terminal) {
    throw sessionError('PROJECT_IMPORT_CAPABILITY_REVOKED', 'Import capability is revoked', 403)
  }
  if (record.state === 'pending' && Date.parse(record.expiresAt) <= Date.now()) {
    throw sessionError('PROJECT_IMPORT_EXPIRED', 'Import session has expired', 410)
  }
  const expected = record.capabilityHash || (terminal ? record.replayHash : null)
  const actual = hashCapability(capability, record.capabilitySalt)
  if (!expected || !secureEqual(expected, actual)) {
    throw sessionError('PROJECT_IMPORT_CAPABILITY_INVALID', 'Import capability is invalid', 403)
  }
}

module.exports = {
  CAPABILITY_SCOPE,
  hashCapability,
  sessionError,
  verifyCapability,
}
