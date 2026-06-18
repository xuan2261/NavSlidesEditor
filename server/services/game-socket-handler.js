/**
 * Game Socket.IO event handlers (Phase 2).
 * Attaches game-join, game-answer, game-random, game-next, game-end, game-leave
 * events to the '/games' namespace of the given Socket.IO io instance.
 *
 * Players are identified by a stable client-supplied playerId (falls back to
 * socket.id). Presenter-only events (game-next, game-end, game-random) are
 * authorized against the room host.
 */
const GameEngine = require('./game-room-manager-singleton-service')

function setupGameSocketHandlers(io) {
  const gameNamespace = io.of('/games')

  gameNamespace.on('connection', (socket) => {
    let currentGameId = null
    let currentPlayerId = null

    const broadcastPlayers = (gid) => {
      const room = GameEngine.getRoom(gid)
      if (!room) return
      gameNamespace.to(gid).emit('game-player-joined', {
        players: Array.from(room.players.values()).map((p) => ({ name: p.name, score: p.score })),
      })
    }

    const emitPollAggregate = (gid) => {
      const aggregate = GameEngine.getPollAggregate(gid)
      if (aggregate) gameNamespace.to(gid).emit('game-poll-results', aggregate)
    }

    const emitWordCloudAggregate = (gid) => {
      const aggregate = GameEngine.getWordCloudAggregate(gid)
      if (aggregate) gameNamespace.to(gid).emit('game-word-cloud-results', aggregate)
    }

    const emitMatchingState = (gid, options = {}) => {
      const state = GameEngine.getMatchingState(gid, options)
      if (state) gameNamespace.to(gid).emit('game-matching-results', state)
    }

    // Reject events from a socket that is not the room host.
    const requireHost = (gid) => {
      if (GameEngine.isHost(gid, currentPlayerId)) return true
      socket.emit('game-error', { message: 'Not authorized: host only' })
      return false
    }

    // Player joins a game room
    socket.on('game-join', ({ gameId, playerName, playerId, role, gameType, options }) => {
      if (!gameId || !playerName) {
        socket.emit('game-error', { message: 'gameId and playerName are required' })
        return
      }
      if (!GameEngine.getRoom(gameId) && role === 'host' && gameType) {
        GameEngine.createRoom(gameId, gameType, options || {})
      }
      const pid = playerId || socket.id
      const result = GameEngine.joinRoom(gameId, pid, playerName, { socketId: socket.id, role })
      if (!result.ok) {
        socket.emit('game-error', { message: result.error })
        return
      }
      currentGameId = gameId
      currentPlayerId = pid
      socket.join(gameId)

      broadcastPlayers(gameId)
      socket.emit('game-leaderboard', { scores: result.leaderboard })
    })

    // Player submits an answer
    socket.on('game-answer', ({ gameId, answerIndex, timeSpentMs }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      const result = GameEngine.submitAnswer(gid, currentPlayerId, answerIndex, timeSpentMs || 0)
      if (result === null) {
        socket.emit('game-error', { message: 'Room not found or no active question' })
        return
      }
      if (result.duplicate) {
        socket.emit('game-error', { message: 'Already answered this question' })
        return
      }

      socket.emit('game-answer-result', {
        correct: result.correct,
        points: result.points,
        totalScore: result.totalScore,
      })

      const lb = GameEngine.getLeaderboard(gid)
      if (lb) gameNamespace.to(gid).emit('game-leaderboard', { scores: lb })
    })

    socket.on('game-poll-submit', ({ gameId, optionId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      if (!gameId || gameId !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitPollVote(gameId, currentPlayerId, optionId, { socketId: socket.id })
      if (!result || !result.ok) {
        socket.emit('game-error', { message: result?.error || 'Room not found or invalid poll' })
        return
      }
      socket.emit('game-poll-vote-accepted', { optionId })
      gameNamespace.to(gameId).emit('game-poll-results', result.aggregate)
    })

    socket.on('game-poll-start', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      const room = GameEngine.getRoom(gid)
      if (!room || room.gameType !== 'poll') {
        socket.emit('game-error', { message: 'Room not found or invalid poll' })
        return
      }
      room.status = 'active'
      gameNamespace.to(gid).emit('game-poll-started', GameEngine.getPollAggregate(gid))
    })

    socket.on('game-poll-reveal', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      emitPollAggregate(gid)
    })

    socket.on('game-word-cloud-submit', ({ gameId, text }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      if (!gameId || gameId !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitWordCloudText(gameId, currentPlayerId, text, { socketId: socket.id })
      if (!result || !result.ok) {
        socket.emit('game-error', { message: result?.error || 'Room not found or invalid word cloud' })
        return
      }
      socket.emit('game-word-cloud-submit-accepted', { text: result.text })
      gameNamespace.to(gameId).emit('game-word-cloud-results', result.aggregate)
    })

    socket.on('game-word-cloud-start', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      const room = GameEngine.getRoom(gid)
      if (!room || room.gameType !== 'word-cloud') {
        socket.emit('game-error', { message: 'Room not found or invalid word cloud' })
        return
      }
      room.status = 'active'
      gameNamespace.to(gid).emit('game-word-cloud-started', GameEngine.getWordCloudAggregate(gid))
    })

    socket.on('game-word-cloud-reveal', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      emitWordCloudAggregate(gid)
    })

    socket.on('game-word-cloud-clear', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      const aggregate = GameEngine.clearWordCloud(gid)
      if (!aggregate) {
        socket.emit('game-error', { message: 'Room not found or invalid word cloud' })
        return
      }
      gameNamespace.to(gid).emit('game-word-cloud-results', aggregate)
    })

    socket.on('game-matching-submit', ({ gameId, pairs }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      if (!gameId || gameId !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitMatchingPairs(gameId, currentPlayerId, pairs, { socketId: socket.id })
      if (!result || !result.ok) {
        socket.emit('game-error', { message: result?.error || 'Room not found or invalid matching game' })
        return
      }
      socket.emit('game-matching-submit-accepted', {
        score: result.score,
        total: result.total,
        correct: result.correct,
      })
      gameNamespace.to(gameId).emit('game-matching-results', result.summary)
    })

    socket.on('game-matching-start', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      const room = GameEngine.getRoom(gid)
      if (!room || room.gameType !== 'matching') {
        socket.emit('game-error', { message: 'Room not found or invalid matching game' })
        return
      }
      room.status = 'active'
      gameNamespace.to(gid).emit('game-matching-started', GameEngine.getMatchingState(gid))
    })

    socket.on('game-matching-reveal', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      if (!requireHost(gid)) return
      emitMatchingState(gid, { revealed: true })
    })

    // Presenter triggers random picker (host only)
    socket.on('game-random', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (!requireHost(gid)) return
      const winnerIndex = GameEngine.triggerRandom(gid)
      if (winnerIndex === null) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      gameNamespace.to(gid).emit('game-random-result', { winnerIndex })
    })

    // Presenter advances to next question (host only)
    socket.on('game-next', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (!requireHost(gid)) return
      const room = GameEngine.nextQuestion(gid)
      if (!room) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      const question = room.questions[room.currentQuestion] || null
      gameNamespace.to(gid).emit('game-question', {
        question,
        questionNumber: room.currentQuestion + 1,
        totalQuestions: room.questions.length,
      })
    })

    // Presenter ends the game (host only)
    socket.on('game-end', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (!requireHost(gid)) return
      const room = GameEngine.endGame(gid)
      if (!room) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      const lb = GameEngine.getLeaderboard(gid)
      gameNamespace.to(gid).emit('game-ended', { finalScores: lb || [] })
    })

    // Player leaves the game
    socket.on('game-leave', ({ gameId }) => {
      if (!currentGameId) return
      const gid = gameId || currentGameId
      GameEngine.leaveRoom(gid, currentPlayerId)
      socket.leave(gid)
      currentGameId = null
      currentPlayerId = null

      const room = GameEngine.getRoom(gid)
      if (room && room.players.size > 0) {
        broadcastPlayers(gid)
        if (room.gameType === 'poll') emitPollAggregate(gid)
        if (room.gameType === 'word-cloud') emitWordCloudAggregate(gid)
        if (room.gameType === 'matching') emitMatchingState(gid)
      } else {
        GameEngine.scheduleEmptyCleanup(gid)
      }
    })

    // Auto-cleanup on disconnect
    socket.on('disconnect', () => {
      if (!currentGameId) return
      const gid = currentGameId
      GameEngine.disconnectRoom(gid, currentPlayerId, socket.id)
      const room = GameEngine.getRoom(gid)
      if (room && Array.from(room.players.values()).some((player) => player.socketId)) {
        broadcastPlayers(gid)
      } else {
        GameEngine.scheduleEmptyCleanup(gid)
      }
    })
  })
}

module.exports = { setupGameSocketHandlers }
