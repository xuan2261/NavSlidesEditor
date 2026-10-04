import { expect } from '@playwright/test'

function polling(url) {
  const parsed = new URL(url)
  return /^\/ws\/?$/.test(parsed.pathname) && parsed.searchParams.get('transport') === 'polling'
}
function append(payload, rows, order, transport) {
  if (typeof payload !== 'string') return
  for (const [index, packet] of payload.split('\x1e').entries()) {
    if (!packet.startsWith('42/games,')) continue
    const event = JSON.parse(packet.slice(packet.indexOf('[')))
    expect(event).toHaveLength(2)
    expect(typeof event[0]).toBe('string')
    expect(event[1] && typeof event[1] === 'object').toBe(true)
    rows.push({ name: event[0], data: event[1], order, index, transport })
  }
  rows.sort((a, b) => a.order - b.order || a.index - b.index)
}
export function capturePackets(page, wire = { incoming: [], outgoing: [] }) {
  let sequence = 0
  wire.pending = new Set()
  wire.errors = []
  const capture = (payload, rows, order, transport = 'websocket') => {
    try {
      append(payload, rows, order, transport)
    } catch (error) {
      wire.errors.push(error)
    }
  }
  page.on('websocket', (socket) => {
    for (const [event, rows] of [
      ['framereceived', wire.incoming],
      ['framesent', wire.outgoing],
    ]) {
      socket.on(event, (frame) => capture(frame.payload, rows, sequence++))
    }
  })
  page.on('request', (request) => {
    if (polling(request.url()) && request.method() === 'POST')
      capture(request.postData(), wire.outgoing, sequence++, 'polling')
  })
  page.on('response', (response) => {
    if (!polling(response.url()) || response.request().method() !== 'GET') return
    const order = sequence++
    const pending = (async () => {
      try {
        const failure = await response.finished()
        if (failure) return // Aborted long polls have no complete delivered payload.
        capture(await response.text(), wire.incoming, order, 'polling')
      } catch (error) {
        if (!page.isClosed()) wire.errors.push(error)
      }
    })()
    wire.pending.add(pending)
    void pending.finally(() => wire.pending.delete(pending))
  })
  return wire
}
export async function settlePackets(journey) {
  const wires = [journey.hostWire, ...journey.wires]
  await Promise.all(wires.flatMap((wire) => [...wire.pending]))
  for (const wire of wires)
    expect(wire.errors, 'Native transport packet capture must succeed').toEqual([])
}
