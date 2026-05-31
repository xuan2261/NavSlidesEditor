import { test, expect } from '../fixtures/test-fixtures.js'
import { io } from 'socket.io-client'

function serverBaseUrl() {
  return `http://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT || '3202'}`
}

// Connect to the dedicated game namespace (shares the /ws socket.io path).
function connectGameSocket() {
  return new Promise((resolve, reject) => {
    const socket = io(`${serverBaseUrl()}/games`, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    const t = setTimeout(() => {
      socket.close()
      reject(new Error('game socket connect timeout'))
    }, 8000)
    socket.once('connect', () => {
      clearTimeout(t)
      resolve(socket)
    })
    socket.once('connect_error', (err) => {
      clearTimeout(t)
      socket.close()
      reject(err)
    })
  })
}

function waitForEvent(socket, event, predicate = () => true, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs)
    const handler = (payload) => {
      if (!predicate(payload)) return
      clearTimeout(t)
      socket.off(event, handler)
      resolve(payload)
    }
    socket.on(event, handler)
  })
}

test.describe('Game scoring and leaderboard over sockets', () => {
  test('[cap:game.score] two players join, answer, and the leaderboard ranks the correct answerer first', async ({
    request,
  }) => {
    const gameId = `e2e-game-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    // Single question, no timeLimit → scoring is deterministic (correct=10, wrong=0).
    const created = await request.post('/api/games', {
      data: {
        gameId,
        gameType: 'hot-potato',
        options: { questions: [{ id: 'q1', correctIndex: 1, points: 10 }] },
      },
    })
    expect(created.ok()).toBeTruthy()

    const alice = await connectGameSocket()
    const bob = await connectGameSocket()
    try {
      const aliceJoined = waitForEvent(alice, 'game-leaderboard')
      alice.emit('game-join', { gameId, playerName: 'Alice' })
      await aliceJoined

      const bobJoined = waitForEvent(bob, 'game-leaderboard')
      bob.emit('game-join', { gameId, playerName: 'Bob' })
      await bobJoined

      const aliceResult = waitForEvent(alice, 'game-answer-result')
      alice.emit('game-answer', { gameId, answerIndex: 1, timeSpentMs: 500 })
      const aliceScore = await aliceResult
      expect(aliceScore.correct).toBe(true)
      expect(aliceScore.totalScore).toBe(10)

      const bobResult = waitForEvent(bob, 'game-answer-result')
      bob.emit('game-answer', { gameId, answerIndex: 0, timeSpentMs: 500 })
      const bobScore = await bobResult
      expect(bobScore.correct).toBe(false)
      expect(bobScore.totalScore).toBe(0)

      // Leaderboard reflects the socket-side scoring and ranks Alice first.
      const lbRes = await request.get(`/api/games/${gameId}/leaderboard`)
      expect(lbRes.ok()).toBeTruthy()
      const leaderboard = await lbRes.json()
      expect(leaderboard[0]).toMatchObject({ name: 'Alice', score: 10 })
      expect(leaderboard.find((p) => p.name === 'Bob')).toMatchObject({ score: 0 })
    } finally {
      alice.disconnect()
      bob.disconnect()
      await request.delete(`/api/games/${gameId}`).catch(() => {})
    }
  })
})
