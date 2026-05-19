/* global __ENV, __VU */
import ws from 'k6/ws'
import { check } from 'k6'
import { Counter, Rate } from 'k6/metrics'
import { buildOptions, getProfile } from './k6-shared-load-test-profile-options-smoke-load-stress.js'

const roomJoinSuccess = new Rate('room_join_success_rate')
const slideChangeMessages = new Counter('slide_change_messages_received')

export const options = buildOptions({
  ws_connecting: ['p(95)<200'],
  ws_msgs_received: ['count>100'],
  room_join_success_rate: ['rate>0.99'],
})

export function setup() {
  const p = getProfile()
  console.log(`[ws-load] profile=${p.name} vus=${p.vus} duration=${p.duration}`)
  return p
}

export default function () {
  const url = __ENV.WS_URL || 'ws://localhost:3002/ws/?EIO=4&transport=websocket'
  const roomId = `LOADROOM${(__VU || 0).toString().padStart(4, '0')}`

  const res = ws.connect(url, {}, function (socket) {
    let joined = false

    socket.on('message', (msg) => {
      if (msg.startsWith('0')) {
        socket.send('40')
      } else if (msg.startsWith('40')) {
        socket.send(`42["join-room",{"roomId":"${roomId}","role":"viewer"}]`)
      } else if (msg.startsWith('42')) {
        try {
          const payload = JSON.parse(msg.slice(2))
          if (Array.isArray(payload)) {
            const event = payload[0]
            if (event === 'room-joined' || event === 'joined-room') {
              joined = true
              roomJoinSuccess.add(1)
            } else if (event === 'slide-changed' || event === 'slide-change') {
              slideChangeMessages.add(1)
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
