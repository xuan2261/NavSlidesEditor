/**
 * Game Socket.IO event handlers (Phase 2).
 * Attaches game-join, game-answer, game-random, game-next, game-end, game-leave
 * events to the '/games' namespace of the given Socket.IO io instance.
 *
 * Players are identified by a stable client-supplied playerId (falls back to
 * socket.id), but joins and mutations are bound to a server-issued session
 * token. Presenter-only events (game-next, game-end, game-random) are
 * authorized against the room host and active socket session.
 */
const GameEngine = require('./game-room-manager-singleton-service')

function toPublicQuestion(question) {
  if (!question || typeof question !== 'object') return null
  const publicQuestion = { ...question }
  for (const key of [
    'correctIndex',
    'correctAnswer',
    'answer',
    'answerIndex',
    'answerKey',
    'solution',
    'explanation',
  ]) delete publicQuestion[key]
  return publicQuestion
}

function getQuestionTiming(room, question) {
  if (!Number.isFinite(room?.questionStartedAt)) return {}
  const limitMs = Number(question?.timeLimit) * 1000
  if (!Number.isFinite(limitMs) || limitMs <= 0) return {}
  return {
    questionStartedAt: room.questionStartedAt,
    timeRemainingMs: Math.max(0, limitMs - (Date.now() - room.questionStartedAt)),
  }
}

function setupGameSocketHandlers(io) {
  const gameNamespace = io.of('/games')
  const roomMembers = new Map()
  GameEngine.subscribeRoomCleanup?.((gameId, room) => {
    const members = roomMembers.get(room.socketRoomId)
    if (!members) return
    for (const invalidate of [...members]) invalidate(gameId)
    roomMembers.delete(room.socketRoomId)
  })

  const broadcastGame = (gid, event, payload) => {
    const room = GameEngine.getRoom(gid)
    if (room?.socketRoomId) gameNamespace.to(room.socketRoomId).emit(event, payload)
  }

  gameNamespace.on('connection', (socket) => {
    const onPayload = (event, handler) => socket.on(event, (payload) => {
      const normalized = payload && typeof payload === 'object' ? payload : {}
      return handler(normalized)
    })

    let currentGameId = null
    let currentPlayerId = null
    let currentSessionToken = null
    let currentHostCapability = null
    let membership = null

    const leaveGameChannel = () => {
      if (!membership) return
      const { channel, invalidate } = membership
      const members = roomMembers.get(channel)
      members?.delete(invalidate)
      if (members && members.size === 0) roomMembers.delete(channel)
      socket.leave(channel)
      membership = null
    }

    const invalidateMembership = (expiredGameId) => {
      const gameId = currentGameId || expiredGameId
      leaveGameChannel()
      currentGameId = null
      currentPlayerId = null
      currentSessionToken = null
      currentHostCapability = null
      socket.emit('game-room-expired', { gameId })
    }

    const joinGameChannel = (room) => {
      leaveGameChannel()
      if (!room?.socketRoomId) return false
      const channel = room.socketRoomId
      const members = roomMembers.get(channel) || new Set()
      const invalidate = (expiredGameId) => invalidateMembership(expiredGameId)
      members.add(invalidate)
      roomMembers.set(channel, members)
      membership = { channel, invalidate }
      socket.join(channel)
      return true
    }

    const broadcastPlayers = (gid) => {
      const room = GameEngine.getRoom(gid)
      if (!room) return
      broadcastGame(gid, 'game-player-joined', {
        players: Array.from(room.players.values()).map((p) => ({ name: p.name, score: p.score })),
      })
    }

    const emitPollAggregate = (gid) => {
      const aggregate = GameEngine.getPollAggregate(gid)
      if (aggregate) broadcastGame(gid, 'game-poll-results', aggregate)
    }

    const emitWordCloudAggregate = (gid) => {
      const aggregate = GameEngine.getWordCloudAggregate(gid)
      if (aggregate) broadcastGame(gid, 'game-word-cloud-results', aggregate)
    }

    const emitMatchingState = (gid, options = {}) => {
      const state = GameEngine.getMatchingState(gid, options)
      if (state) broadcastGame(gid, 'game-matching-results', state)
    }

    const emitCurrentGameState = (gid) => {
      const room = GameEngine.getRoom(gid)
      if (!room) return
      if (room.status === 'finished') {
        socket.emit('game-ended', { finalScores: GameEngine.getLeaderboard(gid) || [] })
        return
      }
      if (room.currentQuestion >= 0 && room.questions[room.currentQuestion]) {
        const question = room.questions[room.currentQuestion]
        socket.emit('game-question', {
          question: toPublicQuestion(question),
          questionNumber: room.currentQuestion + 1,
          totalQuestions: room.questions.length,
          allowLate: room.allowLate === true,
          ...getQuestionTiming(room, question),
        })
        const player = currentPlayerId ? room.players.get(currentPlayerId) : null
        const previousAnswer = player?.answers.find((answer) => answer.questionId === question.id)
        if (previousAnswer) {
          socket.emit('game-answer-result', {
            correct: previousAnswer.correct,
            correctIndex: question.correctIndex,
            answerIndex: previousAnswer.answerIndex,
            points: previousAnswer.points || 0,
            totalScore: player.score,
          })
        }
        return
      }
      if (room.status !== 'active') return
      if (room.gameType === 'poll') {
        socket.emit('game-poll-started', GameEngine.getPollAggregate(gid))
      } else if (room.gameType === 'word-cloud') {
        socket.emit('game-word-cloud-started', GameEngine.getWordCloudAggregate(gid))
      } else if (room.gameType === 'matching') {
        socket.emit('game-matching-started', GameEngine.getMatchingState(gid))
      }
    }

    // Reject events from a socket that is not the room host.
    const requireHost = (gid) => {
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return false
      }
      if (GameEngine.isHost(
        gid,
        currentPlayerId,
        socket.id,
        currentSessionToken,
        currentHostCapability
      )) return true
      socket.emit('game-error', { message: 'Not authorized: host only' })
      return false
    }

    // Player joins a game room
    onPayload('game-join', ({
      gameId,
      playerName,
      playerId,
      role,
      sessionToken,
      hostCapability,
    } = {}) => {
      if (!gameId || !playerName) {
        socket.emit('game-error', { message: 'gameId and playerName are required' })
        return
      }
      if (currentGameId && currentGameId !== gameId) {
        socket.emit('game-error', { message: 'already-joined-room' })
        return
      }
      const observing = role === 'observer'
      const pid = playerId || socket.id
      const result = observing
        ? GameEngine.observeRoom(gameId)
        : GameEngine.joinRoom(gameId, pid, playerName, {
            socketId: socket.id,
            role,
            requireSession: true,
            sessionToken,
            hostCapability,
          })
      if (!result.ok) {
        socket.emit('game-error', { message: result.error })
        return
      }
      currentGameId = gameId
      currentPlayerId = observing ? null : pid
      currentSessionToken = observing ? null : result.sessionToken || sessionToken || null
      currentHostCapability = observing || role !== 'host' ? null : hostCapability
      if (!joinGameChannel(GameEngine.getRoom(gameId))) {
        currentGameId = null
        currentPlayerId = null
        currentSessionToken = null
        currentHostCapability = null
        socket.emit('game-error', { message: 'room-not-found' })
        return
      }

      if (!observing) {
        broadcastPlayers(gameId)
        if (currentSessionToken) {
          socket.emit('game-session', { playerId: pid, sessionToken: currentSessionToken })
        }
      }
      socket.emit('game-leaderboard', { scores: result.leaderboard })
      emitCurrentGameState(gameId)
    })

    // Player submits an answer
    onPayload('game-answer', ({ gameId, questionId, answerIndex, timeSpentMs } = {}) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitAnswer(
        gid,
        currentPlayerId,
        answerIndex,
        timeSpentMs,
        {
          socketId: socket.id,
          sessionToken: currentSessionToken,
          requireSession: true,
          questionId,
          requireQuestionId: true,
        }
      )
      if (result === null) {
        socket.emit('game-error', { message: 'Room not found or no active question' })
        return
      }
      if (result.error) {
        socket.emit('game-error', { message: result.error })
        return
      }
      if (result.duplicate) {
        socket.emit('game-answer-result', {
          correct: result.correct,
          correctIndex: result.correctIndex,
          answerIndex: result.answerIndex,
          points: result.points,
          totalScore: result.totalScore,
        })
        return
      }

      socket.emit('game-answer-result', {
        correct: result.correct,
        correctIndex: result.correctIndex,
        answerIndex: result.answerIndex,
        points: result.points,
        totalScore: result.totalScore,
      })

      const lb = GameEngine.getLeaderboard(gid)
      if (lb) broadcastGame(gid,'game-leaderboard', { scores: lb })
    })

    onPayload('game-poll-submit', ({ gameId, optionId } = {}) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      if (!gameId || gameId !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitPollVote(gameId, currentPlayerId, optionId, {
        socketId: socket.id,
        sessionToken: currentSessionToken,
        requireSession: true,
      })
      if (!result || !result.ok) {
        socket.emit('game-error', { message: result?.error || 'Room not found or invalid poll' })
        return
      }
      socket.emit('game-poll-vote-accepted', { optionId })
      broadcastGame(gameId,'game-poll-results', result.aggregate)
    })

    onPayload('game-poll-start', ({ gameId } = {}) => {
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
      GameEngine.activateRoom(gid)
      broadcastGame(gid,'game-poll-started', GameEngine.getPollAggregate(gid))
    })

    onPayload('game-poll-reveal', ({ gameId } = {}) => {
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

    onPayload('game-word-cloud-submit', ({ gameId, text } = {}) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      if (!gameId || gameId !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitWordCloudText(gameId, currentPlayerId, text, {
        socketId: socket.id,
        sessionToken: currentSessionToken,
        requireSession: true,
      })
      if (!result || !result.ok) {
        socket.emit('game-error', { message: result?.error || 'Room not found or invalid word cloud' })
        return
      }
      socket.emit('game-word-cloud-submit-accepted', { text: result.text })
      broadcastGame(gameId,'game-word-cloud-results', result.aggregate)
    })

    onPayload('game-word-cloud-start', ({ gameId } = {}) => {
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
      GameEngine.activateRoom(gid)
      broadcastGame(gid,'game-word-cloud-started', GameEngine.getWordCloudAggregate(gid))
    })

    onPayload('game-word-cloud-reveal', ({ gameId } = {}) => {
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

    onPayload('game-word-cloud-clear', ({ gameId } = {}) => {
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
      broadcastGame(gid,'game-word-cloud-results', aggregate)
    })

    onPayload('game-matching-submit', ({ gameId, pairs } = {}) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      if (!gameId || gameId !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = GameEngine.submitMatchingPairs(gameId, currentPlayerId, pairs, {
        socketId: socket.id,
        sessionToken: currentSessionToken,
        requireSession: true,
      })
      if (!result || !result.ok) {
        socket.emit('game-error', { message: result?.error || 'Room not found or invalid matching game' })
        return
      }
      socket.emit('game-matching-submit-accepted', {
        score: result.score,
        total: result.total,
        correct: result.correct,
      })
      broadcastGame(gameId,'game-matching-results', result.summary)
    })

    onPayload('game-matching-start', ({ gameId } = {}) => {
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
      GameEngine.activateRoom(gid)
      room.matchingSubmissions.clear()
      GameEngine.setMatchingRevealed(gid, false)
      broadcastGame(gid,'game-matching-started', GameEngine.getMatchingState(gid))
    })

    onPayload('game-matching-reveal', ({ gameId } = {}) => {
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
      const state = GameEngine.setMatchingRevealed(gid)
      if (state) broadcastGame(gid, 'game-matching-results', state)
    })

    // Presenter triggers random picker (host only)
    onPayload('game-random', ({ gameId } = {}) => {
      if (!currentGameId) {
        socket.emit('game-error', { message: 'Not in a game room' })
        return
      }
      const gid = gameId || currentGameId
      if (!requireHost(gid)) return
      const result = GameEngine.triggerRandomResult(gid)
      if (result === null) {
        socket.emit('game-error', { message: 'Room not found' })
        return
      }
      broadcastGame(gid, 'game-random-result', result)
    })

    // Presenter advances to next question (host only)
    onPayload('game-next', ({ gameId } = {}) => {
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
      if (room.status === 'finished') {
        broadcastGame(gid, 'game-ended', { finalScores: GameEngine.getLeaderboard(gid) || [] })
        return
      }
      const question = room.questions[room.currentQuestion] || null
      if (!question) {
        if (room.status === 'finished') {
          broadcastGame(gid, 'game-ended', { finalScores: GameEngine.getLeaderboard(gid) || [] })
        } else {
          socket.emit('game-error', { message: 'No active question' })
        }
        return
      }
      broadcastGame(gid,'game-question', {
        question: toPublicQuestion(question),
        questionNumber: room.currentQuestion + 1,
        totalQuestions: room.questions.length,
        allowLate: room.allowLate === true,
        ...getQuestionTiming(room, question),
      })
    })

    // Presenter ends the game (host only)
    onPayload('game-end', ({ gameId } = {}) => {
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
      broadcastGame(gid,'game-ended', { finalScores: lb || [] })
    })

    // Player leaves the game
    onPayload('game-leave', ({ gameId } = {}) => {
      if (!currentGameId) return
      const gid = gameId || currentGameId
      if (gid !== currentGameId) {
        socket.emit('game-error', { message: 'Invalid game room for this socket' })
        return
      }
      const result = currentPlayerId
        ? GameEngine.leaveRoom(gid, currentPlayerId, {
            socketId: socket.id,
            sessionToken: currentSessionToken,
            requireSession: true,
          })
        : { ok: true }
      if (!result.ok) {
        socket.emit('game-error', { message: result.error })
        return
      }
      leaveGameChannel()
      currentGameId = null
      currentPlayerId = null
      currentSessionToken = null
      currentHostCapability = null

      const room = GameEngine.getRoom(gid)
      if (room && Array.from(room.players.values()).some((player) => player.socketId)) {
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
      leaveGameChannel()
      currentGameId = null
      currentPlayerId = null
      currentSessionToken = null
      currentHostCapability = null
    })
  })
}

module.exports = { setupGameSocketHandlers }
