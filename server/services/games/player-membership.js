const store = require('./room-store')
const life = require('./room-lifecycle')
const { playerAuthorized } = require('./room-auth')
function leaderboard(room) {
  return [...room.players.values()]
    .map((player) => ({ playerId: player.playerId, name: player.name, score: player.score }))
    .sort((a, b) => b.score - a.score)
}
function observeRoom(gameId) {
  const room = store.rooms.get(gameId)
  return room
    ? { ok: true, players: room.players, leaderboard: leaderboard(room), isHost: false }
    : { ok: false, error: 'room-not-found' }
}
function joinRoom(gameId, playerId, name, options = {}) {
  const room = store.rooms.get(gameId),
    reject = (error) => ({ ok: false, error })
  if (!room) return reject('room-not-found')
  if (
    !store.isId(playerId) ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 30 ||
    (options.socketId && !store.isId(options.socketId))
  )
    return reject('invalid-player')
  if (!['host', 'player', undefined].includes(options.role)) return reject('invalid-role')
  const host = options.role === 'host'
  if (host && !store.validToken(room.hostCapabilityHash, options.hostCapability))
    return reject('invalid-host-capability')
  const existing = room.players.get(playerId)
  const recover = host && room.hostPlayerId === playerId
  if (existing && !store.validToken(existing.sessionTokenHash, options.sessionToken) && !recover)
    return reject('invalid-player-session')
  if (existing?.role === 'host' && !host) return reject('invalid-role')
  if (host && room.hostPlayerId && room.hostPlayerId !== playerId)
    return reject('invalid-host-session')
  if (!existing && !host) {
    let learners = 0
    for (const member of room.players.values()) if (member.role !== 'host') learners++
    if (learners >= 200) return reject('room-full')
  }
  const sessionToken = !existing || recover ? store.token() : options.sessionToken
  const player = existing || {
    playerId,
    score: 0,
    answers: [],
    teamId: null,
    ownSubmission: null,
    quiz: null,
    admitted: false,
  }
  Object.assign(player, {
    name: name.trim(),
    socketId: options.socketId || playerId,
    role: host ? 'host' : 'player',
    sessionTokenHash: store.hash(sessionToken),
  })
  room.players.set(playerId, player)
  if (room.cleanupKind === 'empty') {
    clearTimeout(room.cleanupTimer)
    room.cleanupTimer = null
    room.cleanupKind = null
  }
  if (host) {
    room.hostPlayerId = playerId
    room.hostSocketId = player.socketId
    store.pendingHostCapabilities.delete(gameId)
    clearTimeout(room.unclaimedCleanupTimer)
    room.unclaimedCleanupTimer = null
  }
  return {
    ok: true,
    players: room.players,
    leaderboard: leaderboard(room),
    isHost: host,
    sessionToken,
  }
}
function leaveRoom(gameId, playerId, options = {}) {
  const room = store.rooms.get(gameId),
    player = room?.players.get(playerId)
  if (!room) return { ok: false, error: 'room-not-found' }
  if (!player) return { ok: false, error: 'player-not-found' }
  if (options.requireSession && !playerAuthorized(room, { ...options, playerId }))
    return { ok: false, error: 'stale-player-session' }
  room.players.delete(playerId)
  room.roster = room.roster.filter((id) => id !== playerId)
  if (room.hostPlayerId === playerId) {
    room.hostPlayerId = null
    room.hostSocketId = null
  }
  if (room.engagement?.votes)
    room.engagement.votes = room.engagement.votes.filter((row) => row.participantId !== playerId)
  if (room.engagement?.submissions)
    room.engagement.submissions = room.engagement.submissions.filter(
      (row) => row.participantId !== playerId
    )
  life.scheduleEmptyCleanup(gameId)
  return { ok: true, players: room.players }
}
function disconnectRoom(gameId, playerId, socketId) {
  const room = store.rooms.get(gameId),
    player = room?.players.get(playerId)
  if (!room) return { ok: false, error: 'room-not-found' }
  if (player?.socketId === socketId) {
    player.socketId = null
    if (room.hostSocketId === socketId) room.hostSocketId = null
  }
  life.scheduleEmptyCleanup(gameId)
  return { ok: true, players: room.players }
}
module.exports = { joinRoom, observeRoom, leaveRoom, disconnectRoom, leaderboard }
