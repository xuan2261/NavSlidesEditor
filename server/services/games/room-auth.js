const { validToken } = require('./room-store')
function playerAuthorized(room, actor) {
  const player = room?.players.get(actor?.playerId)
  return Boolean(
    player &&
    actor.socketId &&
    player.socketId === actor.socketId &&
    validToken(player.sessionTokenHash, actor.sessionToken)
  )
}
function hostAuthorized(room, actor) {
  return (
    playerAuthorized(room, actor) &&
    room.hostPlayerId === actor.playerId &&
    room.hostSocketId === actor.socketId &&
    validToken(room.hostCapabilityHash, actor.hostCapability)
  )
}
module.exports = { playerAuthorized, hostAuthorized }
