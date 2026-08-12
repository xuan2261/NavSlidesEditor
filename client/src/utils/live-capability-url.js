const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32}$/

export function buildLiveCapabilityUrl(path, roomCode, capability) {
  if (typeof path !== 'string' || !path || typeof roomCode !== 'string' || !roomCode) {
    throw new TypeError('path and roomCode are required')
  }
  if (!CAPABILITY_PATTERN.test(String(capability || ''))) {
    throw new TypeError('capability must be a 192-bit base64url value')
  }
  return `${path.replace(/\/$/, '')}/${encodeURIComponent(roomCode)}#cap=${capability}`
}

export function parseLiveCapabilityHash(hash) {
  const value = typeof hash === 'string' ? hash.replace(/^#/, '') : ''
  const params = new URLSearchParams(value)
  const capability = params.get('cap')
  if (!CAPABILITY_PATTERN.test(capability || '') || params.toString() !== `cap=${capability}`) {
    return null
  }
  return capability
}

export function consumeLiveCapability(role, hash, historyObject = window.history, locationObject = window.location) {
  if (!['remote', 'speaker'].includes(role)) return null
  const capability = parseLiveCapabilityHash(hash)
  if (!capability) return null
  historyObject.replaceState(null, '', `${locationObject.pathname}${locationObject.search}`)
  return capability
}

export function isLiveCapability(value) {
  return CAPABILITY_PATTERN.test(String(value || ''))
}
