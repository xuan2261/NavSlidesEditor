const dns = require('dns').promises
const net = require('net')

function isBlockedIpv4(ip) {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true
  const [a, b] = parts

  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a >= 224) return true
  return false
}

function isBlockedIpv6(ip) {
  const normalized = ip.toLowerCase()
  if (normalized === '::' || normalized === '::1') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('ff')) return true
  if (/^fe[89ab]/.test(normalized)) return true
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length)
    if (net.isIP(mapped) === 4) return isBlockedIpv4(mapped)
  }
  return false
}

function isBlockedIp(ip) {
  const version = net.isIP(ip)
  if (version === 4) return isBlockedIpv4(ip)
  if (version === 6) return isBlockedIpv6(ip)
  return true
}

async function resolveHost(hostname) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true })
  return records.map((record) => record.address)
}

// Build a synchronous-callback DNS lookup that resolves ONLY to the
// pre-validated addresses. undici's connect step calls this instead of the OS
// resolver, so the socket connects to an address we already vetted — closing
// the DNS-rebinding TOCTOU window between validation and fetch.
function buildPinnedLookup(addresses) {
  const records = addresses.map((address) => ({
    address,
    family: net.isIP(address) === 6 ? 6 : 4,
  }))
  return function pinnedLookup(_hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback
    const opts = typeof options === 'function' ? {} : options || {}
    if (opts.all) return cb(null, records)
    return cb(null, records[0].address, records[0].family)
  }
}

// Returns an undici Agent (when available) whose connect.lookup is pinned to
// the validated addresses. If undici is not present we return undefined; the
// caller then must not perform the request, since we cannot guarantee the
// connection target. We prefer the standalone `undici` package (ships with
// Node 18+). `node:undici` is intentionally NOT a public builtin, so we don't
// rely on it.
function buildPinnedDispatcher(addresses) {
  let undici
  try {
    undici = require('undici')
  } catch {
    return undefined
  }
  if (!undici || typeof undici.Agent !== 'function') return undefined
  return new undici.Agent({
    connect: { lookup: buildPinnedLookup(addresses) },
  })
}

// Validates a user-configured AI endpoint against SSRF.
// Returns { url, addresses, dispatcher } — NOT a bare string. The caller MUST
// pass `dispatcher` to fetch so the connection is pinned to a validated IP and
// cannot re-resolve DNS to an internal address.
async function assertSafeAiEndpoint(rawUrl) {
  let parsed
  try {
    parsed = new URL(String(rawUrl || ''))
  } catch {
    throw new Error('Invalid custom endpoint URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP(S) endpoints are allowed')
  }

  const hostname = parsed.hostname.toLowerCase()

  // localhost / *.localhost are reserved to loopback (RFC 6761) — block
  // directly without a network resolve. This also avoids a hang on names that
  // never resolve. Allowlisting cannot override a loopback-reserved name.
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Private or local endpoints are blocked')
  }

  // NOTE: the allowlist (AI_CUSTOM_ENDPOINT_ALLOWLIST) is informational only.
  // IP validation is authoritative: an allowlisted hostname that resolves to
  // an internal IP is still blocked (removes the old early-return bypass).
  let addresses
  if (net.isIP(hostname)) {
    addresses = [hostname]
  } else {
    addresses = await resolveHost(hostname)
  }

  if (!addresses.length) throw new Error('Unable to resolve custom endpoint')
  if (addresses.some(isBlockedIp)) {
    throw new Error('Private or local endpoints are blocked')
  }

  const dispatcher = buildPinnedDispatcher(addresses)
  if (!dispatcher) {
    throw new Error('Unable to establish a pinned connection for the custom endpoint')
  }

  return { url: parsed.toString(), addresses, dispatcher }
}

module.exports = { assertSafeAiEndpoint, isBlockedIp, buildPinnedLookup }
