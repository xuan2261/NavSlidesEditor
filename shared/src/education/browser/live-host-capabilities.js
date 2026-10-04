const storageKey = (presentationId, roomCode) =>
  `navslides-game-host-capabilities:${JSON.stringify([presentationId, roomCode])}`
function readHostCapabilities(window, presentationId, roomCode) {
  const values = Object.create(null)
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey(presentationId, roomCode)))
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const [id, capability] of Object.entries(stored)) {
        if (typeof capability === 'string' && capability) values[id] = capability
      }
    }
  } catch {
    /* Private authority remains memory-only when storage is unavailable. */
  }
  return values
}
function saveHostCapabilities(window, presentationId, roomCode, values) {
  try {
    window.sessionStorage.setItem(storageKey(presentationId, roomCode), JSON.stringify(values))
  } catch {
    /* Storage failure never relaxes server capability admission. */
  }
}
module.exports = { readHostCapabilities, saveHostCapabilities }
