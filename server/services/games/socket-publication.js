const { envelope } = require('./command-ledger')
function createPublisher(namespace, engine) {
  function broadcast(gameId, event, payload) {
    const room = engine.getRoom(gameId)
    if (room)
      namespace
        .to(room.socketRoomId)
        .emit(event, { ...envelope(room), stateVersion: room.stateVersion, ...payload })
  }
  function emitState(socket, gameId, playerId) {
    const state = engine.getPublicState(gameId, playerId)
    if (!state) return
    socket.emit('game-round-state', state)
    if (state.question && state.status !== 'finished')
      socket.emit('game-question', {
        ...state,
        questionNumber: engine.getRoom(gameId).currentQuestion + 1,
        totalQuestions: engine.getRoom(gameId).questions.length,
        allowLate: engine.getRoom(gameId).allowLate,
      })
    if (state.ownSubmission?.result)
      socket.emit('game-answer-result', {
        ...envelope(engine.getRoom(gameId)),
        commandId: state.ownSubmission.commandId,
        stateVersion: state.stateVersion,
        ...state.ownSubmission.result,
      })
    if (state.status === 'finished')
      socket.emit('game-ended', {
        ...envelope(engine.getRoom(gameId)),
        stateVersion: state.stateVersion,
        finalScores: state.leaderboard,
      })
  }
  function publish(gameId) {
    const room = engine.getRoom(gameId)
    if (!room) return
    for (const socket of namespace.sockets.values()) {
      const context = socket.data.gameActor
      if (context?.gameId === gameId && context.roomInstanceId === room.roomInstanceId)
        emitState(
          socket,
          gameId,
          room.players.get(context.playerId)?.socketId === socket.id ? context.playerId : null
        )
    }
    broadcast(gameId, 'game-leaderboard', {
      scores: engine.getLeaderboard(gameId),
      teams: engine.getPublicState(gameId).teams,
    })
  }
  return { broadcast, emitState, publish }
}
function publishExisting(publisher, engine, event, gameId, result) {
  if (!result.accepted) return
  if (event.startsWith('game-poll-')) {
    const state = engine.getPollAggregate(gameId)
    publisher.broadcast(
      gameId,
      event.endsWith('-start') ? 'game-poll-started' : 'game-poll-results',
      state
    )
  }
  if (event.startsWith('game-word-cloud-'))
    publisher.broadcast(
      gameId,
      event.endsWith('-start') ? 'game-word-cloud-started' : 'game-word-cloud-results',
      engine.getWordCloudAggregate(gameId)
    )
  if (event.startsWith('game-matching-'))
    publisher.broadcast(
      gameId,
      event.endsWith('-start') ? 'game-matching-started' : 'game-matching-results',
      engine.getMatchingState(gameId)
    )
  if (event === 'game-random') publisher.broadcast(gameId, 'game-random-result', result.result)
}
module.exports = { createPublisher, publishExisting }
