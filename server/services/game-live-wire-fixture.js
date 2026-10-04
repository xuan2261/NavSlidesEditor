import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { Server } from 'socket.io'
import { io as connect } from 'socket.io-client'
const require = createRequire(import.meta.url)
export const engine = require('./game-room-manager-singleton-service')
const { setupGameSocketHandlers } = require('./game-socket-handler')
let sequence = 0
export function once(socket, event, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener)
      reject(new Error(`Missing ${event}`))
    }, 4000)
    const listener = (data) => {
      if (!predicate(data)) return
      clearTimeout(timer)
      socket.off(event, listener)
      resolve(data)
    }
    socket.on(event, listener)
  })
}
export async function wireHarness() {
  engine._reset()
  const http = createServer(),
    io = new Server(http, { path: '/ws' })
  setupGameSocketHandlers(io)
  await new Promise((resolve, reject) => {
    http.once('error', reject)
    http.listen(0, '127.0.0.1', resolve)
  })
  const url = `http://127.0.0.1:${http.address().port}`,
    sockets = []
  async function client() {
    const socket = connect(`${url}/games`, {
      path: '/ws',
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    sockets.push(socket)
    await once(socket, 'connect')
    let session, state
    socket.on('game-session', (data) => {
      session = data
    })
    socket.on('game-round-state', (data) => {
      state = data
    })
    async function join(gameId, playerId, extra = {}) {
      const hydrated = once(socket, 'game-round-state'),
        admitted = once(socket, 'game-session')
      socket.emit('game-join', { gameId, playerId, playerName: playerId, ...extra })
      await admitted
      await hydrated
      return session
    }
    function waitState(receipt) {
      const matches = (snapshot) =>
        snapshot?.roomInstanceId === receipt.roomInstanceId &&
        snapshot.generation === receipt.generation &&
        snapshot.roundId === receipt.roundId &&
        snapshot.stateVersion >= receipt.stateVersion
      return matches(state) ? Promise.resolve(state) : once(socket, 'game-round-state', matches)
    }
    const envelope = (fields) => ({
      gameId: state.gameId,
      roomInstanceId: state.roomInstanceId,
      generation: state.generation,
      roundId: state.roundId,
      commandId: `wire-${++sequence}`,
      ...fields,
    })
    async function command(event, fields = {}) {
      const payload = envelope(fields),
        response = once(
          socket,
          'game-command-result',
          (data) => data.commandId === payload.commandId
        )
      socket.emit(event, payload)
      return response
    }
    return {
      socket,
      join,
      command,
      envelope,
      waitState,
      state: () => state,
      session: () => session,
    }
  }
  async function fixture(type, options = {}, id = type) {
    engine.createRoom(id, type, options)
    const host = await client(),
      a = await client(),
      b = await client()
    await host.join(id, 'host', { role: 'host', hostCapability: engine.peekHostCapability(id) })
    await a.join(id, 'alice')
    await b.join(id, 'bob')
    return {
      host,
      a,
      b,
      room: engine.getRoom(id),
      sync: (receipt) => Promise.all([host, a, b].map((client) => client.waitState(receipt))),
    }
  }
  return {
    client,
    fixture,
    close: async () => {
      sockets.forEach((socket) => socket.disconnect())
      await new Promise((resolve) => io.close(resolve))
      engine._reset()
    },
  }
}
