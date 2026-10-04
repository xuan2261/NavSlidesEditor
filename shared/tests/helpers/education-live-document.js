import { afterEach, vi } from 'vitest'
import { actualEducationDocument } from './education-document.js'
import { createDefaultGameConfig } from '../../src/education/game-defaults.js'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let socketSequence = 0
const engine = require('../../../server/services/game-room-manager-singleton-service')
const documents = [],
  capabilities = new Map()
afterEach(() => {
  for (const dom of documents.splice(0)) {
    dom.window.dispatchEvent(new dom.window.Event('beforeunload'))
    dom.window.close()
  }
  capabilities.clear()
  engine._reset()
})
export const stateOf = (socket) => engine.getPublicState(socket.gameId)
const poll = { ...createDefaultGameConfig('poll'), prompt: 'Choose your team' }
const element = {
  id: 'shared',
  type: 'game',
  gameType: 'poll',
  poll,
  x: 0,
  y: 0,
  width: 640,
  height: 480,
}
const presentation = {
  id: 'host-deck',
  updatedAt: 'revision-1',
  layoutMasters: [{ id: 'lesson', name: 'Lesson', placeholders: [], fixedElements: [element] }],
  slides: [
    { id: 'one', layoutId: 'lesson', elements: [] },
    { id: 'two', layoutId: 'lesson', elements: [] },
  ],
}
export const bindings = () =>
  ['one', 'two'].map((effectiveSlideId, index) => ({
    effectiveSlideId,
    elementId: 'layout-fixed:lesson:shared',
    transportGameId: `opaque-${index}`,
    gameType: 'poll',
    config: structuredClone(poll),
    hostCapability: `PRIVATE_CAP_${index}`,
  }))
export const success = (games) => ({
  presentationId: 'host-deck',
  presentationRevision: 'revision-1',
  presentationGeneration: 4,
  allocationGeneration: 'lineage',
  games,
})
export async function fixture(response, stored = {}, source = presentation) {
  const sockets = [],
    requests = []
  const readResponse = vi.fn(async () => response)
  const socketFactory = (namespace) => {
    const handlers = new Map(),
      socketId = `generated-socket-${++socketSequence}`
    const socket = {
      namespace,
      connected: true,
      disconnected: false,
      emitted: [],
      gameId: null,
      authority: null,
      publicState: null,
      lastReceipt: null,
      on(event, fn) {
        const rows = handlers.get(event) || new Set()
        rows.add(fn)
        handlers.set(event, rows)
        return socket
      },
      off(event, fn) {
        const rows = handlers.get(event)
        rows?.delete(fn)
        if (!rows?.size) handlers.delete(event)
        return socket
      },
      emit(event, payload) {
        socket.emitted.push({ event, payload })
        if (namespace !== '/games') return socket
        try {
          if (event === 'game-join') {
            socket.gameId = payload.gameId
            const joined = engine.joinRoom(payload.gameId, payload.playerId, payload.playerName, {
              ...payload,
              socketId,
            })
            socket.authority = {
              playerId: payload.playerId,
              socketId,
              sessionToken: joined.sessionToken,
              hostCapability: payload.hostCapability,
            }
            socket.receive('game-session', {
              ...stateOf(socket),
              playerId: payload.playerId,
              sessionToken: joined.sessionToken,
              isHost: true,
            })
            socket.receive('game-round-state', stateOf(socket))
          } else {
            const receipt = engine.command(event, payload, socket.authority)
            socket.receive('game-round-state', stateOf(socket))
            socket.receive('game-command-result', receipt)
          }
        } catch (error) {
          socket.receive('game-error', { gameId: socket.gameId, message: error.message })
        }
        return socket
      },
      disconnect() {
        socket.connected = false
        socket.disconnected = true
        socket.receive('disconnect')
      },
      receive(event, payload) {
        if (event === 'game-round-state') socket.publicState = payload
        if (event === 'game-command-result') socket.lastReceipt = payload
        for (const fn of [...(handlers.get(event) || [])]) fn(payload)
      },
    }
    sockets.push(socket)
    return socket
  }
  const dom = await actualEducationDocument(source, {
    options: { educationView: 'audience' },
    url: 'http://localhost/present?live=ROOM',
    socketFactory,
    beforeParse(window) {
      window.name = JSON.stringify({ roomCode: 'ROOM', presenterToken: 'PRIVATE_PRESENTER' })
      window.opener = { closed: false, postMessage: vi.fn() }
      for (const [key, value] of Object.entries(stored)) window.sessionStorage.setItem(key, value)
      window.fetch = async (url, options) => {
        requests.push(JSON.parse(options.body))
        return {
          ok: true,
          status: 200,
          json: async () => {
            const data = await readResponse()
            return {
              ...data,
              games: data.games.map((game) => {
                if (!engine.getRoom(game.transportGameId))
                  engine.createRoom(game.transportGameId, game.gameType, game.config)
                if (!capabilities.has(game.transportGameId))
                  capabilities.set(
                    game.transportGameId,
                    engine.peekHostCapability(game.transportGameId)
                  )
                return { ...game, hostCapability: capabilities.get(game.transportGameId) }
              }),
            }
          },
        }
      }
    },
  })
  documents.push(dom)
  await vi.waitFor(() => {
    if (!sockets.some((socket) => socket.namespace !== '/games'))
      throw new Error('Generated presenter socket has not loaded')
  })
  const live = sockets.find((socket) => socket.namespace !== '/games')
  live.receive('presentation-data', { presentationId: 'host-deck', presentationGeneration: 4 })
  return { dom, sockets, live, readResponse, requests }
}
export function shortcut(
  window,
  detail,
  context = {},
  source = window.opener,
  origin = window.location.origin
) {
  const event = new window.MessageEvent('message', {
    origin,
    data: {
      type: 'navslides:game-shortcut',
      presentationId: 'host-deck',
      roomCode: 'ROOM',
      detail: {
        effectiveSlideId: 'one',
        elementId: 'layout-fixed:lesson:shared',
        gameType: 'poll',
        ...detail,
      },
      ...context,
    },
  })
  Object.defineProperty(event, 'source', { value: source })
  window.dispatchEvent(event)
}
