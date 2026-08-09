import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const gamesRouter = require('./games-rest-api-handler.js')
const GameEngine = require('../services/game-room-manager-singleton-service.js')
const app = express()
app.use(express.json())
app.use('/api/games', gamesRouter)

const createGame = (id, gameType = 'quiz', options = {}) =>
  request(app).post('/api/games').send({ gameId: id, gameType, options })
const joinGame = (id, actor) => request(app).post(`/api/games/${id}/join`).send(actor)
const answer = (id, actor) => request(app).post(`/api/games/${id}/answer`).send(actor)
function hostActor(host, overrides = {}) {
  return {
    socketId: host.socketId,
    playerId: host.playerId,
    playerName: 'Host',
    role: 'host',
    sessionToken: host.sessionToken,
    hostCapability: host.hostCapability,
    ...overrides,
  }
}

beforeEach(() => GameEngine._reset())

describe('games REST API authorization', () => {
  it('keeps generic creation as an unauthenticated local bootstrap boundary', async () => {
    const created = await createGame('rest-create', 'name-picker', { items: ['A', 'B'] })
    expect(created.status).toBe(200)
    expect(created.body.hostCapability).toEqual(expect.any(String))

    const room = GameEngine.getRoom('rest-create')
    expect(room).toHaveProperty('hostCapabilityHash')
    expect(room).not.toHaveProperty('hostCapability')
    expect(room).not.toHaveProperty('pendingHostCapability')

    const retried = await createGame('rest-create', 'name-picker', { items: ['C'] })
    expect(retried.status).toBe(200)
    expect(retried.body.hostCapability).toBe(created.body.hostCapability)

    const joined = await joinGame('rest-create', {
      socketId: 'rest-host-socket', playerId: 'rest-host', playerName: 'Host', role: 'host',
      hostCapability: created.body.hostCapability,
    })
    expect(joined.status).toBe(200)

    const existing = await createGame('rest-create', 'name-picker', { items: ['C'] })
    expect(existing.status).toBe(200)
    expect(existing.body.hostCapability).toBeUndefined()
  })

  it('rejects a host join without the server-issued capability', async () => {
    const created = await createGame('rest-host-join')
    const actor = {
      socketId: 'host-socket', playerId: 'host-player', playerName: 'Host', role: 'host',
      hostCapability: 'wrong-capability',
    }
    const rejected = await joinGame('rest-host-join', actor)
    expect(rejected.status).toBe(403)
    expect(rejected.body.error).toBe('invalid-host-capability')

    const joined = await joinGame('rest-host-join', {
      ...actor, hostCapability: created.body.hostCapability,
    })
    expect(joined.status).toBe(200)
    expect(joined.body.sessionToken).toEqual(expect.any(String))
  })

  it('recovers a host session when the initial session event was lost', async () => {
    const id = 'rest-host-session-recovery'
    const created = await createGame(id, 'name-picker', { items: ['A', 'B'] })
    const first = await joinGame(id, {
      socketId: 'host-socket-a', playerId: 'host-player', playerName: 'Host', role: 'host',
      hostCapability: created.body.hostCapability,
    })
    expect(first.status).toBe(200)

    const recovered = await joinGame(id, {
      socketId: 'host-socket-b', playerId: 'host-player', playerName: 'Host', role: 'host',
      hostCapability: created.body.hostCapability,
    })
    expect(recovered.status).toBe(200)
    expect(recovered.body.sessionToken).toEqual(expect.any(String))
    expect(recovered.body.sessionToken).not.toBe(first.body.sessionToken)

    const staleControl = await request(app).post(`/api/games/${id}/next`).send({
      socketId: 'host-socket-a', playerId: 'host-player', sessionToken: first.body.sessionToken,
      hostCapability: created.body.hostCapability,
    })
    expect(staleControl.status).toBe(403)

    const recoveredControl = await request(app).post(`/api/games/${id}/next`).send({
      socketId: 'host-socket-b', playerId: 'host-player', sessionToken: recovered.body.sessionToken,
      hostCapability: created.body.hostCapability,
    })
    expect(recoveredControl.status).toBe(200)
  })

  it('keeps REST observers read-only and outside the player map', async () => {
    const id = 'rest-observer'
    const created = await createGame(id, 'quiz', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
    })
    const host = await joinGame(id, {
      socketId: 'observer-host-socket', playerId: 'observer-host', playerName: 'Host', role: 'host',
      hostCapability: created.body.hostCapability,
    })
    expect(host.status).toBe(200)

    const observed = await joinGame(id, {
      role: 'observer', socketId: 'observer-socket', playerId: 'observer', playerName: 'Observer',
    })
    expect(observed.status).toBe(200)
    expect(observed.body).toMatchObject({ role: 'observer', players: 1 })
    expect(observed.body.sessionToken).toBeUndefined()
    expect(GameEngine.getRoom(id).players.has('observer')).toBe(false)

    const attemptedAnswer = await answer(id, {
      socketId: 'observer-socket', playerId: 'observer', sessionToken: 'fake-session',
      questionId: 'q1', answerIndex: 0, timeSpentMs: 100,
    })
    expect(attemptedAnswer.status).toBe(404)
    expect(GameEngine.getRoom(id).players.has('observer')).toBe(false)
  })

  it('rejects stale player sessions and old sockets after reconnect', async () => {
    const id = 'rest-player-session'
    await createGame(id, 'quiz', { questions: [{ id: 'q1', correctIndex: 0, points: 10 }] })
    const first = await joinGame(id, {
      socketId: 'player-socket-a', playerId: 'player-1', playerName: 'Player', role: 'player',
    })
    expect(first.status).toBe(200)

    const invalid = await joinGame(id, {
      socketId: 'player-socket-b', playerId: 'player-1', playerName: 'Player', role: 'player',
      sessionToken: 'not-the-issued-token',
    })
    expect(invalid.status).toBe(403)
    expect(invalid.body.error).toBe('invalid-player-session')

    const rejoined = await joinGame(id, {
      socketId: 'player-socket-b', playerId: 'player-1', playerName: 'Player', role: 'player',
      sessionToken: first.body.sessionToken,
    })
    expect(rejoined.status).toBe(200)
    GameEngine.nextQuestion(id)

    const stale = await answer(id, {
      socketId: 'player-socket-a', playerId: 'player-1', sessionToken: first.body.sessionToken,
      questionId: 'q1', answerIndex: 0, timeSpentMs: 100,
    })
    expect(stale.status).toBe(403)
    expect(stale.body.error).toBe('stale-player-session')
  })

  it('requires the player session and active socket for answers', async () => {
    const id = 'rest-answer'
    await createGame(id, 'quiz', { questions: [{ id: 'q1', correctIndex: 0, points: 10 }] })
    const joined = await joinGame(id, {
      socketId: 'answer-socket', playerId: 'answer-player', playerName: 'Player', role: 'player',
    })
    GameEngine.nextQuestion(id)
    const rejected = await answer(id, {
      socketId: 'answer-socket', playerId: 'answer-player', sessionToken: 'wrong-token',
      questionId: 'q1', answerIndex: 0, timeSpentMs: 100,
    })
    expect(rejected.status).toBe(403)
    expect(rejected.body.error).toBe('stale-player-session')

    const accepted = await answer(id, {
      socketId: 'answer-socket', playerId: 'answer-player', sessionToken: joined.body.sessionToken,
      questionId: 'q1', answerIndex: 0, timeSpentMs: 100,
    })
    expect(accepted.status).toBe(200)
    expect(accepted.body.correct).toBe(true)
  })

  it('requires REST answers to identify the active question', async () => {
    const id = 'rest-question-binding'
    const created = await createGame(id, 'quiz', {
      questions: [
        { id: 'q1', correctIndex: 0, points: 10 },
        { id: 'q2', correctIndex: 1, points: 10 },
      ],
    })
    const hostJoin = await joinGame(id, {
      socketId: 'rest-question-host-socket',
      playerId: 'rest-question-host',
      playerName: 'Host',
      role: 'host',
      hostCapability: created.body.hostCapability,
    })
    const host = {
      socketId: 'rest-question-host-socket',
      playerId: 'rest-question-host',
      sessionToken: hostJoin.body.sessionToken,
      hostCapability: created.body.hostCapability,
    }
    const playerJoin = await joinGame(id, {
      socketId: 'rest-question-player-socket',
      playerId: 'rest-question-player',
      playerName: 'Player',
      role: 'player',
    })

    expect((await request(app).post(`/api/games/${id}/next`).send(host)).status).toBe(200)
    expect((await request(app).post(`/api/games/${id}/next`).send(host)).status).toBe(200)

    const omitted = await answer(id, {
      socketId: 'rest-question-player-socket',
      playerId: 'rest-question-player',
      sessionToken: playerJoin.body.sessionToken,
      answerIndex: 1,
      timeSpentMs: 100,
    })
    expect(omitted.status).toBe(400)
    expect(omitted.body.error).toContain('questionId')
    expect(GameEngine.getRoom(id).players.get('rest-question-player').score).toBe(0)

    const stale = await answer(id, {
      socketId: 'rest-question-player-socket',
      playerId: 'rest-question-player',
      sessionToken: playerJoin.body.sessionToken,
      questionId: 'q1',
      answerIndex: 0,
      timeSpentMs: 100,
    })
    expect(stale.status).toBe(409)
    expect(stale.body.error).toBe('stale-question')
    expect(GameEngine.getRoom(id).players.get('rest-question-player').score).toBe(0)

    const valid = await answer(id, {
      socketId: 'rest-question-player-socket',
      playerId: 'rest-question-player',
      sessionToken: playerJoin.body.sessionToken,
      questionId: 'q2',
      answerIndex: 1,
      timeSpentMs: 100,
    })
    expect(valid.status).toBe(200)
    expect(valid.body.correct).toBe(true)
  })

  it('restricts next, random, end, and delete to the active host context', async () => {
    const id = 'rest-host-controls'
    const created = await createGame(id, 'name-picker', { items: ['A', 'B'] })
    const hostJoin = await joinGame(id, {
      socketId: 'host-socket', playerId: 'host-player', playerName: 'Host', role: 'host',
      hostCapability: created.body.hostCapability,
    })
    const host = {
      socketId: 'host-socket', playerId: 'host-player', sessionToken: hostJoin.body.sessionToken,
      hostCapability: created.body.hostCapability,
    }
    const player = await joinGame(id, {
      socketId: 'player-socket', playerId: 'player-1', playerName: 'Player', role: 'player',
    })
    const forbidden = hostActor(host, {
      socketId: 'player-socket', playerId: 'player-1', sessionToken: player.body.sessionToken,
      hostCapability: 'wrong-capability',
    })
    for (const action of ['next', 'random', 'end']) {
      const response = await request(app).post(`/api/games/${id}/${action}`).send(forbidden)
      expect(response.status).toBe(403)
    }
    const forbiddenDelete = await request(app).delete(`/api/games/${id}`).send(forbidden)
    expect(forbiddenDelete.status).toBe(403)

    const next = await request(app).post(`/api/games/${id}/next`).send(hostActor(host))
    expect(next.status).toBe(200)
    const random = await request(app).post(`/api/games/${id}/random`).send(hostActor(host))
    expect(random.status).toBe(200)
    expect(random.body.winnerIndex).toBeGreaterThanOrEqual(0)
    const ended = await request(app).post(`/api/games/${id}/end`).send(hostActor(host))
    expect(ended.status).toBe(200)
    expect(ended.body.status).toBe('finished')
    const deleted = await request(app).delete(`/api/games/${id}`).send(hostActor(host))
    expect(deleted.status).toBe(200)
    expect(GameEngine.getRoom(id)).toBeUndefined()
  })

  it('returns a finished state when REST next advances beyond the final question', async () => {
    const id = 'rest-final-question'
    const created = await createGame(id, 'quiz', {
      questions: [{ id: 'q1', correctIndex: 0, points: 10 }],
    })
    const joined = await joinGame(id, {
      socketId: 'rest-final-host-socket',
      playerId: 'rest-final-host',
      playerName: 'Host',
      role: 'host',
      hostCapability: created.body.hostCapability,
    })
    const actor = {
      socketId: 'rest-final-host-socket',
      playerId: 'rest-final-host',
      sessionToken: joined.body.sessionToken,
      hostCapability: created.body.hostCapability,
    }

    const first = await request(app).post(`/api/games/${id}/next`).send(actor)
    expect(first.status).toBe(200)
    expect(first.body.question.id).toBe('q1')

    const finished = await request(app).post(`/api/games/${id}/next`).send(actor)
    expect(finished.status).toBe(200)
    expect(finished.body).toMatchObject({ currentQuestion: null, question: null, status: 'finished' })
  })

  it('keeps sessions and host capabilities out of leaderboard rows', async () => {
    const id = 'rest-leaderboard'
    const created = await createGame(id)
    const joined = await joinGame(id, {
      socketId: 'host-socket', playerId: 'host-player', playerName: 'Host', role: 'host',
      hostCapability: created.body.hostCapability,
    })
    const leaderboard = await request(app).get(`/api/games/${id}/leaderboard`)
    expect(leaderboard.status).toBe(200)
    expect(leaderboard.body).toEqual([{ playerId: 'host-player', name: 'Host', score: 0 }])
    expect(JSON.stringify(leaderboard.body)).not.toContain(joined.body.sessionToken)
    expect(JSON.stringify(leaderboard.body)).not.toContain(created.body.hostCapability)
  })
})
