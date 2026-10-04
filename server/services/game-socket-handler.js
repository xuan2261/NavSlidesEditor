const { hostEvents, playerEvents } = require('./games/command-dispatch')
const { createPublisher, publishExisting } = require('./games/socket-publication')
const { envelope } = require('./games/command-ledger')
const engine = require('./game-room-manager-singleton-service')
function setupGameSocketHandlers(io) {
  const namespace = io.of('/games'),
    publisher = createPublisher(namespace, engine)
  const detach = engine.subscribeState(publisher.publish)
  const detachCleanup = engine.subscribeRoomCleanup((gameId, room) => {
    for (const socket of namespace.sockets.values())
      if (socket.data.gameActor?.roomInstanceId === room.roomInstanceId) {
        socket.leave(room.socketRoomId)
        socket.data.gameActor = null
        socket.emit('game-room-expired', { gameId, roomInstanceId: room.roomInstanceId })
      }
  })
  io.engine.on('close', () => {
    detach()
    detachCleanup()
  })
  namespace.on('connection', (socket) => {
    const error = (message) => socket.emit('game-error', { message, error: message })
    socket.on('game-join', (value) => {
      const payload = value && typeof value === 'object' ? value : {}
      const { gameId, playerName, role, sessionToken, hostCapability } = payload
      if (socket.data.gameActor && socket.data.gameActor.gameId !== gameId)
        return error('already-joined-room')
      if (
        socket.data.gameActor &&
        socket.data.gameActor.playerId !==
          (role === 'observer' ? null : payload.playerId || socket.id)
      )
        return error('already-joined-player')
      const observing = role === 'observer',
        playerId = payload.playerId || socket.id
      const result = observing
        ? engine.observeRoom(gameId)
        : engine.joinRoom(gameId, playerId, playerName, {
            socketId: socket.id,
            role,
            sessionToken,
            hostCapability,
            requireSession: true,
          })
      if (!result.ok) return error(result.error)
      const room = engine.getRoom(gameId)
      socket.data.gameActor = {
        gameId,
        roomInstanceId: room.roomInstanceId,
        playerId: observing ? null : playerId,
        socketId: socket.id,
        sessionToken: observing ? null : result.sessionToken,
        hostCapability: role === 'host' ? hostCapability : null,
      }
      socket.join(room.socketRoomId)
      socket.emit('game-session', {
        ...envelope(room),
        gameType: room.gameType,
        playerId: observing ? null : playerId,
        sessionToken: observing ? null : result.sessionToken,
        isHost: result.isHost,
        role: observing ? 'observer' : result.isHost ? 'host' : 'player',
      })
      room.stateVersion++
      publisher.broadcast(gameId, 'game-player-joined', {
        players: engine.getPublicState(gameId).players,
      })
      publisher.publish(gameId)
      publisher.emitState(socket, gameId, observing ? null : playerId)
      socket.emit('game-leaderboard', {
        ...envelope(room),
        stateVersion: room.stateVersion,
        scores: result.leaderboard,
      })
      if (room.status === 'active') {
        if (room.gameType === 'poll')
          socket.emit('game-poll-started', {
            ...envelope(room),
            stateVersion: room.stateVersion,
            ...engine.getPollAggregate(gameId),
          })
        if (room.gameType === 'word-cloud')
          socket.emit('game-word-cloud-started', {
            ...envelope(room),
            stateVersion: room.stateVersion,
            ...engine.getWordCloudAggregate(gameId),
          })
        if (room.gameType === 'matching')
          socket.emit('game-matching-started', {
            ...envelope(room),
            stateVersion: room.stateVersion,
            ...engine.getMatchingState(gameId),
          })
      }
    })
    for (const event of [...hostEvents, ...playerEvents])
      socket.on(event, (value) => {
        const payload = value && typeof value === 'object' ? value : {},
          actor = socket.data.gameActor
        if (!actor) return error('Not in a game room')
        if (payload.gameId !== actor.gameId) return error('Invalid game room for this socket')
        const result = engine.command(event, payload, actor)
        socket.emit('game-command-result', result)
        if (!result.accepted) {
          socket.emit('game-error', { ...result, message: result.error })
          return
        }
        if (
          event === 'game-answer' ||
          event === 'game-relay-answer' ||
          event === 'game-trivia-answer'
        )
          socket.emit('game-answer-result', { ...result, ...result.result })
        const acceptedEvents = {
          'game-poll-submit': 'game-poll-vote-accepted',
          'game-word-cloud-submit': 'game-word-cloud-submit-accepted',
          'game-matching-submit': 'game-matching-submit-accepted',
        }
        if (acceptedEvents[event])
          socket.emit(acceptedEvents[event], { ...result, ...result.result })
        publishExisting(publisher, engine, event, actor.gameId, result)
      })
    socket.on('game-leave', () => {
      const actor = socket.data.gameActor
      if (!actor) return
      const room = engine.getRoom(actor.gameId)
      if (actor.playerId)
        engine.leaveRoom(actor.gameId, actor.playerId, { ...actor, requireSession: true })
      if (room) socket.leave(room.socketRoomId)
      socket.data.gameActor = null
      if (room)
        publisher.broadcast(actor.gameId, 'game-player-left', {
          players: engine.getPublicState(actor.gameId).players,
        })
      if (room) {
        room.stateVersion++
        publisher.publish(actor.gameId)
        if (room.gameType === 'poll')
          publisher.broadcast(
            actor.gameId,
            'game-poll-results',
            engine.getPollAggregate(actor.gameId)
          )
        if (room.gameType === 'matching')
          publisher.broadcast(
            actor.gameId,
            'game-matching-results',
            engine.getMatchingState(actor.gameId)
          )
      }
    })
    socket.on('disconnect', () => {
      const actor = socket.data.gameActor
      if (!actor) return
      if (actor.playerId) engine.disconnectRoom(actor.gameId, actor.playerId, socket.id)
      socket.data.gameActor = null
    })
  })
}
module.exports = { setupGameSocketHandlers }
