const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])

function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has(String(host || '').trim().toLowerCase())
}

function resolveListenHost({ explicitHost, envHost, fallback = '127.0.0.1' } = {}) {
  const host = String(explicitHost || envHost || fallback).trim()
  if (host === '::1') return host
  if (!host || /[/:,\s]/.test(host)) throw new Error('Invalid listen host')
  if (!/^[A-Za-z0-9.-]+$/.test(host)) throw new Error('Invalid listen host')
  return host
}
function getExposureWarning(host) {
  if (isLoopbackHost(host)) return null
  return {
    code: 'unauthenticated-network-exposure',
    address: host,
    message: `Server is listening on ${host} without external authentication acknowledgement`,
  }
}

module.exports = { isLoopbackHost, resolveListenHost, getExposureWarning }
