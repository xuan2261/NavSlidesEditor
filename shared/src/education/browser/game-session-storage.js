function read(storage, key) {
  try {
    return storage?.getItem(key) || null
  } catch {
    return null
  }
}
function store(storage, key, value) {
  try {
    if (value) storage?.setItem(key, value)
  } catch {
    /* Storage denial must not prevent a live join. */
  }
}
function createGameSessionStorage({ storage, sessionStorage, role = 'player', gameId, randomId }) {
  const prefix = `navslides-game:${role}:${encodeURIComponent(gameId)}`
  const identityKey = `${prefix}:player`
  const playerId = read(storage, identityKey) || randomId()
  store(storage, identityKey, playerId)
  const tokenKey = `${prefix}:${playerId}:session`
  const capabilityKey = `${prefix}:host`
  return {
    playerId,
    getToken: () => (role === 'observer' ? null : read(storage, tokenKey)),
    setToken: (value) => {
      if (role !== 'observer') store(storage, tokenKey, value)
    },
    getCapability: () => (role === 'host' ? read(sessionStorage, capabilityKey) : null),
    setCapability: (value) => {
      if (role === 'host') store(sessionStorage, capabilityKey, value)
    },
  }
}
module.exports = { createGameSessionStorage }
