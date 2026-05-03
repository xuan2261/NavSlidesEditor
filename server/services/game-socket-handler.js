/**
 * Game Socket.IO event handlers (Phase 2).
 * Attaches game-join, game-answer, game-random, game-next, game-end, game-leave
 * events to the given Socket.IO io instance.
 */
const GameEngine = require('./game-room-manager-singleton-service')

function setupGameSocketHandlers(io) {
  const gameNamespace = io.of('/games')

  gameNamespace.on('connection', (socket) => {
    let currentGameId = null

    // Player joins a game room
    socket.on('game-join', ({ gameId, playerName, _playerId }) => {
      if (!gameId || !playerName) {
        socket.emit('game-error', { message: 'gameId and playerName are required' })
        return
      }
      const result = GameEngine.joinRoom(gameId, socket.id, playerName)
      if (!result.ok) {
        socket.emit('game-error', { message: result.error })
        return
      }
      currentGameId = gameId
      socket.join(gameId)

      // Broadcast updated player list
      gameNamespace.to(gameId).emit('game-player-joined', {
        players: Array.from(result.players.values()).map((p) => ({ name: p.name, score: p.score })),
      })

      // Send current leaderboard
      socket.emit('game-leaderboard', { scores: result.leaderboard })
    })

    // Player submits an answer
    socket.on('game-answer', ({ gameId, answerIndex, timeSpentMs }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const result = GameEngine.submitAnswer(gameId || currentGameId, socket.id, answerIndex, timeSpentMs || 0)
      if (result === null) {
        socket.emit('game-error', { message: 'Room not found or no active question' })
        return
      }

      socket.emit('game-answer-result', {
        correct: result.correct,
        points: result.points,
        totalScore: result.totalScore,
      })

      // Broadcast updated leaderboard to all in room
      const lb = GameEngine.getLeaderboard(gameId || currentGameId)
      if (lb) {
        gameNamespace.to(gameId || currentGameId).emit('game-leaderboard', { scores: lb })
      }
    })

    // Presenter triggers random picker
    socket.on('game-random', ({ gameId, _action }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const winnerIndex = GameEngine.triggerRandom(gameId || currentGameId)
      if (winnerIndex === null) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      gameNamespace.to(gameId || currentGameId).emit('game-random-result', { winnerIndex })
    })

    // Presenter advances to next question
    socket.on('game-next', ({ gameId, _questionId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const room = GameEngine.nextQuestion(gameId || currentGameId)
      if (!room) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      const question = room.questions[room.currentQuestion] || null
      gameNamespace.to(gameId || currentGameId).emit('game-question', {
        question,
        questionNumber: room.currentQuestion + 1,
        totalQuestions: room.questions.length,
      })
    })

    // Presenter ends the game
    socket.on('game-end', ({ gameId }) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const room = GameEngine.endGame(gameId || currentGameId)
      if (!room) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      const lb = GameEngine.getLeaderboard(gameId || currentGameId)
      gameNamespace.to(gameId || currentGameId).emit('game-ended', {
        finalScores: lb || [],
      })
    })

    // Player leaves the game
    socket.on('game-leave', ({ gameId }) => {
      if (!currentGameId) return
      const gid = gameId || currentGameId
      GameEngine.leaveRoom(gid, socket.id)
      socket.leave(gid)
      currentGameId = null

      // Broadcast updated player list
      const room = GameEngine.getRoom(gid)
      if (room) {
        gameNamespace.to(gid).emit('game-player-joined', {
          players: Array.from(room.players.values()).map((p) => ({ name: p.name, score: p.score })),
        })
      }
    })

    // Auto-cleanup on disconnect
    socket.on('disconnect', () => {
      if (currentGameId) {
        GameEngine.leaveRoom(currentGameId, socket.id)
        const room = GameEngine.getRoom(currentGameId)
        if (room) {
          gameNamespace.to(currentGameId).emit('game-player-joined', {
            players: Array.from(room.players.values()).map((p) => ({ name: p.name, score: p.score })),
          })
        }
      }
    })
  })
}

module.exports = { setupGameSocketHandlers }
