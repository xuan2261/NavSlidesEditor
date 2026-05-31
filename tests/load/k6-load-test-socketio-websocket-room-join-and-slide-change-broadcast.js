/* global __ENV */
import http from 'k6/http'
import ws from 'k6/ws'
import { check } from 'k6'
import { Counter, Rate } from 'k6/metrics'
import { buildOptions, getProfile } from './k6-shared-load-test-profile-options-smoke-load-stress.js'

const roomJoinSuccess = new Rate('room_join_success_rate')
const socketMessages = new Counter('socket_messages_received')

export const options = buildOptions({
  ws_connecting: ['p(95)<200'],
  ws_msgs_received: ['count>2'],
  room_join_success_rate: ['rate>0.99'],
})

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3002/api'
const WS_URL = __ENV.WS_URL || 'ws://localhost:3002/ws/?EIO=4&transport=websocket'

function assertLoopbackUrl(value, name, protocols) {
  const protocolPattern = protocols.join('|')
  const pattern = new RegExp(`^(${protocolPattern}):\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?(\\/|$)`)
  if (!pattern.test(value)) {
    throw new Error(`${name} must target loopback only for destructive load tests: ${value}`)
  }
}

export function setup() {
  assertLoopbackUrl(API_BASE_URL, 'API_BASE_URL', ['http', 'https'])
  assertLoopbackUrl(WS_URL, 'WS_URL', ['ws', 'wss'])
  const p = getProfile()
  console.log(`[ws-load] profile=${p.name} vus=${p.vus} duration=${p.duration}`)
  const res = http.post(`${API_BASE_URL}/live/room`)
  if (res.status !== 200) {
    throw new Error(`Failed to create live room: status=${res.status} body=${res.body}`)
  }
  return { ...p, roomCode: res.json('roomCode') }
}

export default function (data) {
  const roomId = data.roomCode

  const res = ws.connect(WS_URL, {}, function (socket) {
    let joined = false

    socket.on('message', (msg) => {
      if (msg.startsWith('0')) {
        socket.send('40')
      } else if (msg.startsWith('40')) {
        socket.send(`42["join-room",{"roomId":"${roomId}","role":"viewer"}]`)
      } else if (msg.startsWith('42')) {
        socketMessages.add(1)
        try {
          const payload = JSON.parse(msg.slice(2))
          if (Array.isArray(payload)) {
            const event = payload[0]
            if (event === 'sync-state' || event === 'annotations:sync' || event === 'viewer-count') {
              joined = true
              roomJoinSuccess.add(1)
            }
          }
        } catch {}
      } else if (msg.startsWith('2')) {
        socket.send('3')
      }
    })

    socket.setTimeout(function () {
      if (!joined) roomJoinSuccess.add(0)
      socket.close()
    }, 30000)
  })

  check(res, { 'status is 101': (r) => r && r.status === 101 })
}
