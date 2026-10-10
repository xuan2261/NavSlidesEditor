// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const router = require('./games-rest-api-handler')
const engine = require('../services/game-room-manager-singleton-service')
const app = express()
app.use(express.json())
app.use('/api/games', router)
let sequence = 0
afterEach(() => {
  vi.restoreAllMocks()
  engine._reset()
})
async function provision(type = 'hot-potato', options = {}) {
  const created = await request(app)
    .post('/api/games')
    .send({ gameId: 'room', gameType: type, options })
  expect(created.status).toBe(200)
  const host = {
    socketId: 'host-socket',
    playerId: 'host',
    playerName: 'Host',
    role: 'host',
    hostCapability: created.body.hostCapability,
  }
  const joined = await request(app).post('/api/games/room/join').send(host)
  const actor = { ...host, sessionToken: joined.body.sessionToken }
  const learner = {
    socketId: 'learner-socket',
    playerId: 'learner',
    playerName: 'Learner',
    role: 'player',
  }
  const player = await request(app).post('/api/games/room/join').send(learner)
  const playerActor = { ...learner, sessionToken: player.body.sessionToken }
  function payload(fields = {}, who = actor) {
    const room = engine.getRoom('room')
    return {
      ...who,
      gameId: 'room',
      roomInstanceId: room.roomInstanceId,
      generation: room.generation,
      roundId: room.roundId,
      commandId: `rest-${++sequence}`,
      ...fields,
    }
  }
  const mutate = (action, fields = {}, who) =>
    request(app).post(`/api/games/room/${action}`).send(payload(fields, who))
  return { created, actor, playerActor, payload, mutate }
}
describe('REST local provisioning authority', () => {
  it('recovers only ownerless unclaimed authority and never reads owned pending capability', async () => {
    const f = await provision('poll')
    const claimed = await request(app).post('/api/games').send({ gameId: 'room', gameType: 'poll' })
    expect(claimed.status).toBe(200)
    expect(claimed.body.hostCapability).toBeUndefined()
    const owner = { presentationId: 'deck', liveRoomCode: 'live', presentationGeneration: 1 }
    engine.createRoom('owned', 'quiz', {}, owner)
    const original = engine.peekHostCapability('owned'),
      pending = vi.spyOn(engine, 'peekHostCapability')
    const rejected = await request(app)
      .post('/api/games')
      .send({ gameId: 'owned', gameType: 'quiz', options: { title: 'attacker' } })
    expect(rejected.status).toBe(403)
    expect(rejected.body).toEqual({ error: 'presenter-owned-room' })
    expect(pending).not.toHaveBeenCalled()
    expect(engine.getRoom('owned').owner).toEqual(owner)
    pending.mockRestore()
    expect(
      engine.joinRoom('owned', 'presenter', 'Host', {
        role: 'host',
        socketId: 'trusted',
        hostCapability: original,
      }).ok
    ).toBe(true)
    expect(f.created.body.hostCapability).toBeTypeOf('string')
  })
  it('keeps create retry capability until claim and rejects malformed/local-only types', async () => {
    const body = { gameId: 'retry', gameType: 'poll' }
    const first = await request(app).post('/api/games').send(body),
      second = await request(app)
        .post('/api/games')
        .send({ ...body, options: { prompt: 'Changed' } })
    expect(second.body.hostCapability).toBe(first.body.hostCapability)
    expect(engine.getRoom('retry').config.prompt).not.toBe('Changed')
    expect(
      (await request(app).post('/api/games').send({ gameId: 'bad', gameType: 'countdown' })).status
    ).toBe(400)
    expect(
      (
        await request(app)
          .post('/api/games')
          .send({ gameId: 'bad', gameType: 'quiz', options: { questions: [null] } })
      ).status
    ).toBe(400)
  })
  it('rejects wrong host capability and recovers a lost host session only with trusted capability', async () => {
    const f = await provision()
    const wrong = await request(app)
      .post('/api/games/room/join')
      .send({ ...f.actor, hostCapability: 'wrong' })
    expect(wrong.status).toBe(403)
    const recovered = await request(app)
      .post('/api/games/room/join')
      .send({ ...f.actor, socketId: 'new-host', sessionToken: undefined })
    expect(recovered.status).toBe(200)
    expect(recovered.body.sessionToken).not.toBe(f.actor.sessionToken)
    expect((await f.mutate('next')).status).toBe(403)
  })
  it('exposes observer E without granting mutation or adding membership', async () => {
    const f = await provision()
    await f.mutate('next')
    const observed = await request(app)
      .post('/api/games/room/join')
      .send({ role: 'observer', playerName: 'Observer', playerId: 'observer' })
    expect(observed.body).toMatchObject({
      isHost: false,
      roomInstanceId: expect.any(String),
      generation: 0,
      roundId: 1,
    })
    expect(observed.body.sessionToken).toBeUndefined()
    expect(engine.getRoom('room').players.has('observer')).toBe(false)
    expect(
      (
        await f.mutate(
          'answer',
          { questionId: 'question-1', attemptId: 'a', answerIndex: 0 },
          { socketId: 'observer', playerId: 'observer', sessionToken: 'fake' }
        )
      ).status
    ).toBe(403)
  })
  it('binds answers to current E/question/session and once-only receipts without exposing keys', async () => {
    const question = {
      id: 'q',
      question: 'Choose B',
      options: ['A', 'B'],
      correctIndex: 1,
      points: 10,
    }
    const f = await provision('hot-potato', { questions: [question] })
    const next = await f.mutate('next')
    expect(next.body.state.question.id).toBe('q')
    expect(JSON.stringify(next.body.state)).not.toContain('answerKey')
    expect(
      (
        await f.mutate(
          'answer',
          { questionId: 'old', attemptId: 'a', answerIndex: 1 },
          f.playerActor
        )
      ).body.error
    ).toBe('stale-question')
    const payload = f.payload({ questionId: 'q', attemptId: 'a', answerIndex: 1 }, f.playerActor)
    const accepted = await request(app).post('/api/games/room/answer').send(payload)
    expect(accepted.body.result).toMatchObject({ correct: true, points: 10, totalScore: 10 })
    const duplicate = await request(app).post('/api/games/room/answer').send(payload)
    expect(duplicate.body.duplicate).toBe(true)
    expect(
      (
        await request(app)
          .post('/api/games/room/answer')
          .send({ ...payload, answerIndex: 0 })
      ).body.error
    ).toBe('command-id-conflict')
    const rejoin = await request(app)
      .post('/api/games/room/join')
      .send({ ...f.playerActor, socketId: 'new-learner' })
    expect(rejoin.body.state.ownSubmission.result.totalScore).toBe(10)
    expect(
      (await f.mutate('answer', { questionId: 'q', attemptId: 'b', answerIndex: 1 }, f.playerActor))
        .body.error
    ).toBe('stale-player-session')
    expect(
      (
        await f.mutate(
          'answer',
          { roomInstanceId: 'wrong', questionId: 'q', attemptId: 'b', answerIndex: 1 },
          { ...f.playerActor, socketId: 'new-learner' }
        )
      ).body.error
    ).toBe('stale-room-instance')
  })
  it('requires host E for every mutation, final next ends and deletion removes room', async () => {
    const f = await provision()
    for (const action of ['next', 'random', 'end', 'reset'])
      expect((await f.mutate(action, {}, f.playerActor)).status).toBe(403)
    expect((await request(app).post('/api/games/room/next').send(f.actor)).status).toBe(400)
    const old = f.payload()
    await f.mutate('reset')
    expect((await request(app).post('/api/games/room/next').send(old)).body.error).toBe(
      'stale-generation'
    )
    expect((await f.mutate('next')).body.state.phase).toBe('active')
    expect((await f.mutate('next')).body.state.status).toBe('finished')
    expect(
      (await request(app).delete('/api/games/room').send(f.payload({}, f.playerActor))).status
    ).toBe(403)
    expect((await request(app).delete('/api/games/room').send(f.payload())).body.deleted).toBe(true)
    expect(engine.getRoom('room')).toBeUndefined()
  })
  it('runs random through server-selected room-local state', async () => {
    const f = await provision('name-picker', { items: ['A'], excludeAfterPick: true })
    expect((await f.mutate('random')).body.result).toMatchObject({ winner: 'A', winnerIndex: 0 })
    expect((await f.mutate('random')).body.result.winnerIndex).toBe(-1)
  })
})
