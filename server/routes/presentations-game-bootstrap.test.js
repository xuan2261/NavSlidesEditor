import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import express from 'express'
import { createRequire } from 'node:module'
import * as storage from '../services/storage.js'

const require = createRequire(import.meta.url)
const presentationsRouter = require('./presentations.js')
const liveRooms = require('../services/live-rooms.js')
const GameEngine = require('../services/game-room-manager-singleton-service.js')

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/presentations', presentationsRouter)
  return app
}

const app = createApp()

beforeAll(() => storage.initDataFiles())
beforeEach(() => {
  liveRooms._resetRooms()
  GameEngine._reset()
})

describe('presenter game bootstrap route', () => {
  it('rejects a completion from a replaced presenter generation', () => {
    const room = {
      presenterId: 'presenter-a',
      presenterConnected: true,
      presentationId: 'deck-a',
      presentationGeneration: 4,
    }
    const expected = {
      room,
      presenterId: 'presenter-a',
      presenterToken: 'presenter-token',
      presentationId: 'deck-a',
      presentationGeneration: 4,
    }

    expect(presentationsRouter.isCurrentPresenterBootstrap(expected, room)).toBe(false)
    room.presenterTokenHash = require('node:crypto')
      .createHash('sha256')
      .update('presenter-token')
      .digest('hex')
    expect(presentationsRouter.isCurrentPresenterBootstrap(expected, room)).toBe(true)

    const replacement = { ...room, presentationGeneration: 5, presenterId: 'presenter-b' }
    expect(presentationsRouter.isCurrentPresenterBootstrap(expected, replacement)).toBe(false)
  })

  it('returns an actionable permanent rejection when authored question kinds are unsupported live', async () => {
    const created = await request(app)
      .post('/api/presentations')
      .send({
        title: 'Unsupported live question kind',
        slides: [
          {
            elements: [
              {
                id: 'typed-live',
                type: 'game',
                gameType: 'hot-potato',
                'hot-potato': {
                  questions: [
                    {
                      id: 'typed-question',
                      kind: 'multi-choice',
                      prompt: 'Select A',
                      points: 10,
                      timeLimit: 30,
                      options: [
                        { id: 'a', text: 'A' },
                        { id: 'b', text: 'B' },
                      ],
                      answerKey: { optionIds: ['a'] },
                      feedback: { correct: '', incorrect: '', explanation: '' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      })
    expect(created.status).toBe(201)
    const id = created.body.id
    const roomCode = liveRooms.generateRoomCode()
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(roomCode, presenterToken)
    liveRooms.joinRoom(roomCode, 'typed-presenter', 'presenter', { presenterToken })
    liveRooms.getRoomState(roomCode).presentationId = id
    try {
      const response = await request(app)
        .post(`/api/presentations/${id}/present/game-bootstrap`)
        .send({ roomCode, presenterToken })
      expect(response.status).toBe(400)
      expect(response.body).toMatchObject({
        error: 'invalid-game-config',
        message: expect.stringMatching(/single-choice.*offline/i),
      })
      expect(GameEngine.getRoom('typed-live')).toBeUndefined()
    } finally {
      liveRooms.removeRoom(roomCode)
      await request(app).delete(`/api/presentations/${id}/permanent`)
    }
  })

  it('authenticates the live presenter and creates authoritative game rooms', async () => {
    const created = await request(app)
      .post('/api/presentations')
      .send({
        title: `Game bootstrap ${Date.now()}`,
        slides: [
          {
            elements: [
              {
                id: 'bootstrap-game',
                type: 'game',
                gameType: 'poll',
                poll: {
                  prompt: 'Authoritative question',
                  options: [
                    { id: 'yes', text: 'Yes' },
                    { id: 'no', text: 'No' },
                  ],
                },
              },
            ],
          },
        ],
      })
    expect(created.status).toBe(201)
    const id = created.body.id
    const roomCode = liveRooms.generateRoomCode()
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(roomCode, presenterToken)
    liveRooms.joinRoom(roomCode, 'presenter-socket', 'presenter', { presenterToken })
    const room = liveRooms.getRoomState(roomCode)
    room.presentationId = id

    try {
      const response = await request(app)
        .post(`/api/presentations/${id}/present/game-bootstrap`)
        .send({ roomCode, presenterToken })

      expect(response.status).toBe(200)
      expect(response.headers['cache-control']).toContain('no-store')
      expect(response.body.games).toHaveLength(1)
      expect(typeof response.body.games[0].hostCapability).toBe('string')
      const gameId = response.body.games[0].transportGameId
      expect(response.body.games[0]).toMatchObject({
        elementId: 'bootstrap-game',
        effectiveSlideId: expect.any(String),
      })
      expect(GameEngine.getRoom(gameId).owner).toEqual({
        presentationId: id,
        liveRoomCode: roomCode,
        presentationGeneration: room.presentationGeneration,
      })
      expect(GameEngine.getRoom(gameId)).not.toHaveProperty('hostCapability')
    } finally {
      liveRooms.removeRoom(roomCode)
      await request(app).delete(`/api/presentations/${id}/permanent`)
    }
  })

  it('allocates an independent game room when the presenter starts a new live room', async () => {
    const created = await request(app)
      .post('/api/presentations')
      .send({
        title: `Game bootstrap restart ${Date.now()}`,
        slides: [
          {
            elements: [
              {
                id: 'restart-game',
                type: 'game',
                gameType: 'poll',
                poll: {
                  prompt: 'Restart question',
                  options: [
                    { id: 'yes', text: 'Yes' },
                    { id: 'no', text: 'No' },
                  ],
                },
              },
            ],
          },
        ],
      })
    expect(created.status).toBe(201)
    const id = created.body.id
    const firstRoomCode = liveRooms.generateRoomCode()
    const firstPresenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(firstRoomCode, firstPresenterToken)
    liveRooms.joinRoom(firstRoomCode, 'presenter-socket-1', 'presenter', {
      presenterToken: firstPresenterToken,
    })
    liveRooms.getRoomState(firstRoomCode).presentationId = id

    const firstBootstrap = await request(app)
      .post(`/api/presentations/${id}/present/game-bootstrap`)
      .send({ roomCode: firstRoomCode, presenterToken: firstPresenterToken })
    expect(firstBootstrap.status).toBe(200)
    const { hostCapability, transportGameId: firstGameId } = firstBootstrap.body.games[0]
    const hostJoin = GameEngine.joinRoom(firstGameId, 'presenter-host-old', 'Presenter', {
      socketId: 'game-host-socket-1',
      role: 'host',
      hostCapability,
      requireSession: true,
    })
    expect(hostJoin.ok).toBe(true)
    GameEngine.disconnectRoom(firstGameId, 'presenter-host-old', 'game-host-socket-1')
    liveRooms.removeRoom(firstRoomCode)

    const secondRoomCode = liveRooms.generateRoomCode()
    const secondPresenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(secondRoomCode, secondPresenterToken)
    liveRooms.joinRoom(secondRoomCode, 'presenter-socket-2', 'presenter', {
      presenterToken: secondPresenterToken,
    })
    liveRooms.getRoomState(secondRoomCode).presentationId = id

    try {
      const secondBootstrap = await request(app)
        .post(`/api/presentations/${id}/present/game-bootstrap`)
        .send({ roomCode: secondRoomCode, presenterToken: secondPresenterToken })

      expect(secondBootstrap.status).toBe(200)
      const secondGameId = secondBootstrap.body.games[0].transportGameId
      expect(secondGameId).not.toBe(firstGameId)
      expect(GameEngine.getRoom(firstGameId).owner.liveRoomCode).toBe(firstRoomCode)
      expect(GameEngine.getRoom(firstGameId).hostPlayerId).toBe('presenter-host-old')
      expect(GameEngine.getRoom(secondGameId).owner).toEqual({
        presentationId: id,
        liveRoomCode: secondRoomCode,
        presentationGeneration: 1,
      })
    } finally {
      liveRooms.removeRoom(secondRoomCode)
      await request(app).delete(`/api/presentations/${id}/permanent`)
    }
  })

  it('isolates disconnected claimed rooms from another presentation without raw-ID conflict', async () => {
    const first = await request(app)
      .post('/api/presentations')
      .send({
        title: `Game bootstrap owner isolation A ${Date.now()}`,
        slides: [
          {
            elements: [
              {
                id: 'cross-presentation-game',
                type: 'game',
                gameType: 'poll',
                poll: {
                  prompt: 'Deck A',
                  options: [
                    { id: 'a', text: 'A' },
                    { id: 'other-a', text: 'Other' },
                  ],
                },
              },
            ],
          },
        ],
      })
    const second = await request(app)
      .post('/api/presentations')
      .send({
        title: `Game bootstrap owner isolation B ${Date.now()}`,
        slides: [
          {
            elements: [
              {
                id: 'cross-presentation-game',
                type: 'game',
                gameType: 'poll',
                poll: {
                  prompt: 'Deck B',
                  options: [
                    { id: 'b', text: 'B' },
                    { id: 'other-b', text: 'Other' },
                  ],
                },
              },
            ],
          },
        ],
      })
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)

    const firstRoomCode = liveRooms.generateRoomCode()
    const firstPresenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(firstRoomCode, firstPresenterToken)
    liveRooms.joinRoom(firstRoomCode, 'presenter-socket-a', 'presenter', {
      presenterToken: firstPresenterToken,
    })
    liveRooms.getRoomState(firstRoomCode).presentationId = first.body.id
    const firstBootstrap = await request(app)
      .post(`/api/presentations/${first.body.id}/present/game-bootstrap`)
      .send({ roomCode: firstRoomCode, presenterToken: firstPresenterToken })
    expect(firstBootstrap.status).toBe(200)

    const firstGameId = firstBootstrap.body.games[0].transportGameId
    const hostJoin = GameEngine.joinRoom(firstGameId, 'presenter-host-a', 'Presenter', {
      socketId: 'game-host-socket-a',
      role: 'host',
      hostCapability: firstBootstrap.body.games[0].hostCapability,
      requireSession: true,
    })
    expect(hostJoin.ok).toBe(true)
    GameEngine.disconnectRoom(firstGameId, 'presenter-host-a', 'game-host-socket-a')
    liveRooms.removeRoom(firstRoomCode)

    const secondRoomCode = liveRooms.generateRoomCode()
    const secondPresenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(secondRoomCode, secondPresenterToken)
    liveRooms.joinRoom(secondRoomCode, 'presenter-socket-b', 'presenter', {
      presenterToken: secondPresenterToken,
    })
    liveRooms.getRoomState(secondRoomCode).presentationId = second.body.id

    try {
      const secondBootstrap = await request(app)
        .post(`/api/presentations/${second.body.id}/present/game-bootstrap`)
        .send({ roomCode: secondRoomCode, presenterToken: secondPresenterToken })

      expect(secondBootstrap.status).toBe(200)
      const secondGameId = secondBootstrap.body.games[0].transportGameId
      expect(secondGameId).not.toBe(firstGameId)
      expect(GameEngine.getRoom(firstGameId).owner.presentationId).toBe(first.body.id)
      expect(GameEngine.getRoom(secondGameId).owner.presentationId).toBe(second.body.id)
    } finally {
      liveRooms.removeRoom(secondRoomCode)
      await request(app).delete(`/api/presentations/${first.body.id}/permanent`)
      await request(app).delete(`/api/presentations/${second.body.id}/permanent`)
    }
  })

  it('rejects invalid presenter credentials and a deck that is not ready', async () => {
    const created = await request(app)
      .post('/api/presentations')
      .send({
        title: `Game bootstrap auth ${Date.now()}`,
        slides: [
          { elements: [{ id: 'bootstrap-auth-game', type: 'game', gameType: 'name-picker' }] },
        ],
      })
    expect(created.status).toBe(201)
    const id = created.body.id
    const roomCode = liveRooms.generateRoomCode()
    const presenterToken = liveRooms.createPresenterToken()
    liveRooms.registerRoom(roomCode, presenterToken)

    try {
      const invalid = await request(app)
        .post(`/api/presentations/${id}/present/game-bootstrap`)
        .send({ roomCode, presenterToken: 'invalid' })
      expect(invalid.status).toBe(403)
      expect(invalid.body.error).toBe('invalid-presenter-token')

      liveRooms.joinRoom(roomCode, 'presenter-socket', 'presenter', { presenterToken })
      const notReady = await request(app)
        .post(`/api/presentations/${id}/present/game-bootstrap`)
        .send({ roomCode, presenterToken })
      expect(notReady.status).toBe(409)
      expect(notReady.body.error).toBe('presenter-deck-not-ready')
    } finally {
      liveRooms.removeRoom(roomCode)
      await request(app).delete(`/api/presentations/${id}/permanent`)
    }
  })
})
