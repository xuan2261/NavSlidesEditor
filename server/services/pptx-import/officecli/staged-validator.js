const crypto = require('node:crypto')
const { createRevisionDescriptor } = require('./revision')
const { securityPreflight: defaultSecurityPreflight } = require('../export-security-preflight')

function createStagedOfficeCliValidator({ createGateway, securityPreflight = defaultSecurityPreflight } = {}) {
  if (typeof createGateway !== 'function' || typeof securityPreflight !== 'function') {
    throw new TypeError('Staged OfficeCLI validator dependencies are required')
  }

  return async function validateStagedPackage({ afterBytes }) {
    if (!Buffer.isBuffer(afterBytes)) return false
    const security = await securityPreflight(afterBytes)
    if (!security?.ok) return false
    const sha256 = crypto.createHash('sha256').update(afterBytes).digest('hex')
    const revision = createRevisionDescriptor({
      id: `staged-${sha256}`,
      sha256,
      byteLength: afterBytes.length,
      safetyVerdict: { rawZipSafe: true, xmlSafe: true, verifiedSha256: sha256 },
    })
    const gateway = createGateway({ readRevision: async (requested) => requested.id === revision.id ? afterBytes : null })
    try {
      const capability = typeof gateway.probeCapability === 'function' ? await gateway.probeCapability() : null
      if (capability && (!capability.available || !capability.validation)) return false
      return (await gateway.validatePackage(revision))?.ok === true
    } catch {
      return false
    }
  }
}

module.exports = { createStagedOfficeCliValidator }
