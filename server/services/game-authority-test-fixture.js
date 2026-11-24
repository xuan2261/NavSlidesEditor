import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
export const engine = require('./game-room-manager-singleton-service')
export const { now } = require('./games/room-lifecycle')
let counter = 0
export function fixture(type, options = {}, id = 'room') {
  const room = engine.createRoom(id, type, options),
    hostCapability = engine.peekHostCapability(id)
  const host = engine.joinRoom(id, 'host', 'Host', {
    role: 'host',
    socketId: 'host-socket',
    hostCapability,
  })
  const hostActor = {
    playerId: 'host',
    socketId: 'host-socket',
    sessionToken: host.sessionToken,
    hostCapability,
  }
  const playerActors = new Map()
  const envelope = (fields) => ({
    gameId: id,
    roomInstanceId: room.roomInstanceId,
    generation: room.generation,
    roundId: room.roundId,
    commandId: `command-${++counter}`,
    ...fields,
  })
  function join(playerId = 'learner', name = 'Learner', extra = {}) {
    const previous = playerActors.get(playerId)
    const socketId = extra.socketId || `${playerId}-socket`
    const result = engine.joinRoom(id, playerId, name, {
      socketId,
      sessionToken: previous?.sessionToken,
      ...extra,
    })
    if (result.ok)
      playerActors.set(playerId, { playerId, socketId, sessionToken: result.sessionToken })
    return result
  }
  const command = (event, fields = {}, playerId) =>
    engine.command(event, envelope(fields), playerId ? playerActors.get(playerId) : hostActor)
  return { room, hostActor, playerActors, envelope, join, command }
}
