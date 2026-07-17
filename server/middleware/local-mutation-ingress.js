const LOCAL_MUTATION_INGRESS_DENIAL_CODE = 'local-mutation-ingress-denied'
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// This protects the local deployment and browser CSRF boundary. It is not user
// authentication and deliberately has no identity or authorization semantics.
const MUTATION_ROUTE_FAMILIES = Object.freeze([
  { method: 'POST', path: '/api/pptx/import' },
  { method: 'POST', path: '/api/upload' },
  { method: 'POST', path: '/api/presentations' },
  { method: 'PUT', path: '/api/presentations/example' },
  { method: 'POST', path: '/api/presentations/example/duplicate' },
  { method: 'DELETE', path: '/api/presentations/example' },
  { method: 'POST', path: '/api/presentations/example/restore' },
  { method: 'DELETE', path: '/api/presentations/example/permanent' },
  { method: 'POST', path: '/api/presentations/example/snapshot' },
  { method: 'POST', path: '/api/presentations/example/restore/snapshot' },
  { method: 'DELETE', path: '/api/presentations/example/snapshots/snapshot' },
  { method: 'POST', path: '/api/presentations/example/save-as-template' },
  { method: 'POST', path: '/api/templates' },
  { method: 'POST', path: '/api/templates/example/instantiate' },
  { method: 'POST', path: '/api/pptx/portable/import' },
  { method: 'POST', path: '/api/rclone/sync' },
  { method: 'POST', path: '/api/rclone/sync-single' },
  { method: 'POST', path: '/api/presentations/example/pptx-edited' },
  { method: 'POST', path: '/api/presentations/example/pptx-edited-exports' },
  { method: 'DELETE', path: '/api/pptx/jobs/00000000-0000-4000-8000-000000000000' },
  { method: 'DELETE', path: '/api/presentations/example/pptx-edited-exports/job' },
  { method: 'POST', path: '/api/pptx/qualification' },
  { method: 'POST', path: '/api/presentations/example/pptx-local-evidence/job' },
  { method: 'DELETE', path: '/api/presentations/example/pptx-local-evidence/job' },
  { method: 'POST', path: '/api/presentations/example/pptx-local-evidence/job/decisions/security' },
  { method: 'POST', path: '/api/presentations/example/pptx-local-evidence/job/revoke' },
])

function csv(value, fallback = []) {
  if (value === undefined || value === '') return fallback
  return String(value).split(',').map((item) => item.trim()).filter(Boolean)
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === '') return fallback
  return value === 'true'
}

function normalizeAddress(value) {
  return String(value).toLowerCase().replace(/^::ffff:/, '')
}

function parseHost(value) {
  if (typeof value !== 'string' || !value || value.includes(',') || /[\s/?#@]/.test(value)) return null
  try {
    const url = new URL(`http://${value}`)
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return { hostname: url.hostname.toLowerCase(), port: url.port || null }
  } catch {
    return null
  }
}

function parseOrigin(value) {
  if (typeof value !== 'string' || !value || value === 'null' || value.includes(',') || /\s/.test(value)) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash || url.origin !== value) return null
    return url.origin
  } catch {
    return null
  }
}

function hostMatches(host, allowedHost) {
  return host && allowedHost && host.hostname === allowedHost.hostname &&
    (allowedHost.port === null || allowedHost.port === host.port)
}

function originFor(protocol, host) {
  return `${protocol}://${host.hostname}${host.port ? `:${host.port}` : ''}`
}

function safeDeny(res) {
  return res.status(403).json({
    error: 'Request denied',
    code: LOCAL_MUTATION_INGRESS_DENIAL_CODE,
  })
}

function createLocalMutationIngressPolicy(options = {}) {
  const allowedHosts = (options.allowedHosts || csv(process.env.NAVSLIDES_LOCAL_ALLOWED_HOSTS,
    ['localhost', '127.0.0.1', '[::1]'])).map(parseHost).filter(Boolean)
  const allowedOrigins = (options.allowedOrigins || csv(process.env.NAVSLIDES_LOCAL_ALLOWED_ORIGINS))
    .map(parseOrigin).filter(Boolean)
  const trustedProxyAddresses = new Set((options.trustedProxyAddresses ||
    csv(process.env.NAVSLIDES_TRUSTED_PROXY_ADDRESSES)).map(normalizeAddress))
  const allowMissingOrigin = options.allowMissingOrigin ??
    parseBoolean(process.env.NAVSLIDES_ALLOW_MISSING_ORIGIN, true)

  return (req, res, next) => {
    const requestPath = typeof req.path === 'string' ? req.path.toLowerCase() : ''
    if (!UNSAFE_METHODS.has(req.method) || !requestPath.startsWith('/api/')) return next()

    const remoteAddress = normalizeAddress(req.socket?.remoteAddress)
    const trustedProxy = trustedProxyAddresses.has(remoteAddress)
    const requestedHost = trustedProxy && req.get('x-forwarded-host')
      ? req.get('x-forwarded-host')
      : req.get('host')
    const host = parseHost(requestedHost)
    if (!allowedHosts.some((allowedHost) => hostMatches(host, allowedHost))) return safeDeny(res)

    const forwardedProtocol = trustedProxy ? req.get('x-forwarded-proto') : null
    const protocol = forwardedProtocol || 'http'
    if (!['http', 'https'].includes(protocol) || (forwardedProtocol && forwardedProtocol.includes(','))) {
      return safeDeny(res)
    }

    const rawOrigin = req.get('origin')
    if (!rawOrigin) return allowMissingOrigin ? next() : safeDeny(res)
    const origin = parseOrigin(rawOrigin)
    if (!origin || origin !== originFor(protocol, host) ||
      (allowedOrigins.length && !allowedOrigins.includes(origin))) return safeDeny(res)
    return next()
  }
}

module.exports = {
  createLocalMutationIngressPolicy,
  LOCAL_MUTATION_INGRESS_DENIAL_CODE,
  MUTATION_ROUTE_FAMILIES,
}
