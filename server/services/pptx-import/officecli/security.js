const crypto = require('node:crypto')
const { gatewayError } = require('./errors')

function createJobCapability() {
  const capability = crypto.randomBytes(32).toString('base64url')
  const capabilityHash = crypto.createHash('sha256').update(capability).digest('hex')
  return {
    capability,
    capabilityHash,
    publicDto: Object.freeze({
      protected: true,
      operational: false,
      routeControls: false,
      reason: 'job-route-unavailable',
    }),
  }
}

function verifyJobCapability(candidate, expectedHash) {
  if (typeof candidate !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash || '')) return false
  const actual = crypto.createHash('sha256').update(candidate).digest()
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`.toLowerCase()
  } catch {
    return null
  }
}

function enforceSameOrigin(headers, { allowedOrigins = [] } = {}) {
  const origin = normalizeOrigin(headers?.origin)
  const allowed = allowedOrigins.map(normalizeOrigin).filter(Boolean)
  if (!origin || !allowed.includes(origin)) {
    throw gatewayError('ORIGIN_REJECTED', 'Request origin is not allowed')
  }
  const originHost = new URL(origin).host.toLowerCase()
  if (String(headers?.host || '').toLowerCase() !== originHost) {
    throw gatewayError('HOST_REJECTED', 'Request host does not match origin')
  }
  return true
}

function redactDiagnostics(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[A-Za-z]:[\\/][^\s"'<>]+|\/(?:tmp|var|home)\/[^\s"'<>]+/gi, '[path]')
    .replace(/(capability|token|secret|password)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/<\?xml[\s\S]*$/i, '[xml-redacted]')
    .slice(0, 1024)
}

module.exports = {
  createJobCapability,
  enforceSameOrigin,
  redactDiagnostics,
  verifyJobCapability,
}
