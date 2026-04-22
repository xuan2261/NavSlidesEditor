import ws from 'k6/ws'
import { check } from 'k6'

export const options = {
  vus: 50,
  duration: '30s',
}

export default function () {
  // Socket.IO uses Engine.IO underneath. We connect to Engine.IO protocol v4 over WS.
  const url = 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket'

  const res = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      // connection opened
    })

    socket.on('message', (msg) => {
      // 0 = open
      if (msg.startsWith('0')) {
        // Connected to engine.io, now connect to socket.io default namespace
        socket.send('40')
      }
      // 40 = connected to default namespace
      else if (msg.startsWith('40')) {
        // Connected to namespace, now emit a join event
        socket.send('42["join-presentation", "test-presentation-id"]')
      }
      // 2 = ping from server
      else if (msg.startsWith('2')) {
        // Reply with pong
        socket.send('3')
      }
    })

    // Keep connection alive for the duration of the test
    socket.setTimeout(function () {
      socket.close()
    }, 30000)
  })

  check(res, { 'status is 101': (r) => r && r.status === 101 })
}
