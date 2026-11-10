import { createRequire } from 'node:module'
import { afterEach, describe, expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const liveRooms = require('../../server/services/live-rooms')
const { setupSocketHandlers } = require('../../server/services/socket-handler')
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}
class Socket {
  constructor(id) { this.id = id; this.data = {}; this.handlers = {}; this.emitted = [] }
  on(event, handler) { this.handlers[event] = handler }
  emit(event, payload) { this.emitted.push({ event, payload }) }
  join() {}
  to() { return { emit() {} } }
  trigger(event, payload) { return this.handlers[event]?.(payload) }
}
afterEach(() => liveRooms._resetRooms())
async function harness() {
  liveRooms._resetRooms()
  let connect
  const io = { on(_event, handler) { connect = handler }, to() { return { emit() {} } } }
  const gate = deferred(), started = deferred()
  let delayed = false, receivedSignal
  const deck = { id: 'deck', title: 'Snapshot', slides: [{ id: 's', notes: 'Secret notes', elements: [] }] }
  setupSocketHandlers(io, { liveRoomsService: liveRooms, findPresentationById: async () => deck,
    prepareSemanticOutputResources: async (snapshot, { signal }) => {
      expect(snapshot).toBe(deck)
      receivedSignal = signal
      if (delayed) { started.resolve(); return gate.promise }
      return null
    } })
  const token = liveRooms.createPresenterToken()
  liveRooms.registerRoom('SERVER', token)
  const presenter = new Socket('presenter')
  connect(presenter)
  await presenter.trigger('join-room', { roomId: 'SERVER', role: 'presenter',
    presentationId: 'deck', presenterToken: token })
  delayed = true
  const viewer = new Socket('viewer')
  connect(viewer)
  const joining = viewer.trigger('join-room', { roomId: 'SERVER', role: 'viewer' })
  await started.promise
  return { viewer, presenter, joining, gate, get signal() { return receivedSignal } }
}
describe('live output rechecks authority after asynchronous font preparation', () => {
  it('does not emit HTML before readiness and preserves audience note stripping', async () => {
    const h = await harness()
    expect(h.viewer.emitted.some((event) => event.event === 'presentation-data')).toBe(false)
    h.gate.resolve(null)
    await h.joining
    const payload = h.viewer.emitted.find((event) => event.event === 'presentation-data')
    expect(payload.payload.html).not.toContain('Secret notes')
    const meta = h.viewer.emitted.find((event) => event.event === 'presentation-meta')
    expect(meta.payload.slides[0]).not.toHaveProperty('notes')
  })
  it.each(['generation', 'role', 'room', 'disconnect'])('drops %s-invalidated output after await', async (reason) => {
    const h = await harness()
    if (reason === 'generation') liveRooms.getRoomState('SERVER').presentationGeneration++
    if (reason === 'role') liveRooms.leaveRoom('viewer')
    if (reason === 'room') {
      liveRooms._resetRooms()
      liveRooms.registerRoom('SERVER', liveRooms.createPresenterToken())
    }
    if (reason === 'disconnect') {
      await h.viewer.trigger('disconnect')
      expect(h.signal.aborted).toBe(true)
    }
    h.gate.resolve(null)
    await h.joining
    expect(h.viewer.emitted.some((event) =>
      ['presentation-data', 'presentation-meta'].includes(event.event))).toBe(false)
  })
  it('does not emit a partial payload when font preparation fails', async () => {
    const h = await harness()
    // Promise adoption rejects the pending resource boundary without a timing race.
    h.gate.resolve(Promise.reject(new Error('source-font-unavailable')))
    await h.joining
    expect(h.viewer.emitted.some((event) => event.event === 'presentation-data')).toBe(false)
  })
})
