const dns = require('dns').promises
const net = require('net')

function parseAllowlist() {
  return String(process.env.AI_CUSTOM_ENDPOINT_ALLOWLIST || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

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
  const allowlist = parseAllowlist()
  if (allowlist.includes(hostname)) return parsed.toString()

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Private or local endpoints are blocked')
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('Private or local endpoints are blocked')
    return parsed.toString()
  }

  const addresses = await resolveHost(hostname)
  if (!addresses.length) throw new Error('Unable to resolve custom endpoint')
  if (addresses.some(isBlockedIp)) {
    throw new Error('Private or local endpoints are blocked')
  }

  return parsed.toString()
}

module.exports = { assertSafeAiEndpoint, isBlockedIp }
