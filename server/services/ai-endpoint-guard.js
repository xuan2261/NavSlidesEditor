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

function parseIpv6Words(ip) {
  const normalized = ip.toLowerCase().split('%')[0]
  const halves = normalized.split('::')
  if (halves.length > 2) return null

  const parseHalf = (half) => {
    if (!half) return []
    const words = []
    for (const part of half.split(':')) {
      if (part.includes('.')) {
        if (net.isIP(part) !== 4) return null
        const bytes = part.split('.').map(Number)
        words.push((bytes[0] << 8) | bytes[1], (bytes[2] << 8) | bytes[3])
      } else {
        words.push(Number.parseInt(part, 16))
      }
    }
    return words
  }

  const left = parseHalf(halves[0])
  const right = parseHalf(halves[1] || '')
  if (!left || !right) return null
  const omitted = 8 - left.length - right.length
  if ((halves.length === 1 && omitted !== 0) || (halves.length === 2 && omitted < 1)) return null
  return [...left, ...Array(omitted).fill(0), ...right]
}

function matchesIpv6Prefix(words, prefix, bits) {
  const wholeWords = Math.floor(bits / 16)
  for (let index = 0; index < wholeWords; index++) {
    if (words[index] !== prefix[index]) return false
  }
  const remainingBits = bits % 16
  if (!remainingBits) return true
  const mask = (0xffff << (16 - remainingBits)) & 0xffff
  return (words[wholeWords] & mask) === (prefix[wholeWords] & mask)
}

const blockedIpv6Ranges = [
  [[0xfc00], 7], // unique-local
  [[0xfe80], 10], // link-local
  [[0xfec0], 10], // deprecated site-local
  [[0xff00], 8], // multicast
  [[0x0064, 0xff9b, 0x0001], 48], // local-use translation prefix
  [[0x0100, 0, 0, 0], 64], // discard-only
  [[0x2001, 0x0000], 32], // Teredo
  [[0x2001, 0x0002, 0], 48], // benchmarking
  [[0x2001, 0x0010], 28], // ORCHIDv1
  [[0x2001, 0x0020], 28], // ORCHIDv2
  [[0x2001, 0x0db8], 32], // documentation
  [[0x2002], 16], // deprecated 6to4
  [[0x3fff, 0], 20], // documentation
]

function isBlockedIpv6(ip) {
  const words = parseIpv6Words(ip)
  if (!words) return true

  const isUnspecified = words.every((word) => word === 0)
  const isLoopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1
  if (isUnspecified || isLoopback) return true

  const isMapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff
  const isCompatible = words.slice(0, 6).every((word) => word === 0)
  const isWellKnownNat64 = (
    words[0] === 0x0064 &&
    words[1] === 0xff9b &&
    words.slice(2, 6).every((word) => word === 0)
  )
  if (isMapped || isCompatible || isWellKnownNat64) {
    const embedded = [words[6] >> 8, words[6] & 0xff, words[7] >> 8, words[7] & 0xff].join('.')
    return isBlockedIpv4(embedded)
  }

  return blockedIpv6Ranges.some(([prefix, bits]) => matchesIpv6Prefix(words, prefix, bits))
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
