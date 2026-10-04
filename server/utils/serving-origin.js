function normalizeAddress(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^::ffff:/, '')
}

function getServingBaseUrl(req) {
  const header = (name) => req?.get?.(name) ?? req?.headers?.[name]
  const remoteAddress = normalizeAddress(req?.socket?.remoteAddress)
  // Match the ingress policy's explicit proxy trust; never trust forwarding
  // headers from an arbitrary client or change Express's global trust policy.
  const trustedProxy = (process.env.NAVSLIDES_TRUSTED_PROXY_ADDRESSES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .some((value) => normalizeAddress(value) === remoteAddress)
  const host = (trustedProxy && header('x-forwarded-host')) || header('host')
  const protocol =
    (trustedProxy && header('x-forwarded-proto')) ||
    req?.protocol ||
    (req?.socket?.encrypted ? 'https' : 'http')
  if (
    typeof host !== 'string' ||
    !host ||
    /[\s,/?#@]/.test(host) ||
    !['http', 'https'].includes(protocol)
  )
    return ''
  try {
    return new URL(`${protocol}://${host}`).origin
  } catch {
    return ''
  }
}

module.exports = { getServingBaseUrl }
