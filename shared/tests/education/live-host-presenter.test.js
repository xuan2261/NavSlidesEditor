// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const engine = require('../../../server/services/game-room-manager-singleton-service')
const {
  createLiveHostBridge,
  dispatchHostCommand,
} = require('../../src/education/browser/live-host-bridge')
const { presentLiveHost } = require('../../src/education/browser/live-host-presenter')
let mounted
function mount(type, options = {}) {
  const room = engine.createRoom('g', type, options),
    hostCapability = engine.peekHostCapability('g')
  const joined = engine.joinRoom('g', 'host', 'Host', {
    socketId: 'host-socket',
    role: 'host',
    hostCapability,
  })
  const actor = {
      playerId: 'host',
      socketId: 'host-socket',
      sessionToken: joined.sessionToken,
      hostCapability,
    },
    listeners = new Map(),
    cleanup = []
  let sequence = 0
  const socket = {
    connected: true,
    on: (event, fn) => listeners.set(event, fn),
    off: (event) => listeners.delete(event),
    emit(event, command) {
      const result = engine.command(event, command, actor)
      listeners.get('game-round-state')?.(engine.getPublicState('g', 'host'))
      listeners.get('game-command-result')?.(result)
    },
  }
  const bridge = createLiveHostBridge({
    socket,
    gameId: 'g',
    createCommandId: () => `host-${++sequence}`,
  })
  const section = document.createElement('section')
  section.dataset.nsEffectiveSlideId = 'slide'
  const root = document.createElement('div')
  root.dataset.nsGameType = type
  root.dataset.nsElementId = 'activity'
  root.innerHTML = '<div data-ns-game-ui></div>'
  section.append(root)
  document.body.append(section)
  const binding = { transportGameId: 'g', gameType: type },
    transport = {
      getHostBinding: () => binding,
      dispatch: (tuple, command) => dispatchHostCommand(binding, bridge, command),
    }
  const presenter = presentLiveHost({
    root,
    config: room.config,
    session: { own: (fn) => cleanup.push(fn), getState: () => ({ generation: 0 }) },
    transport,
  })
  cleanup.push(bridge.subscribe(presenter.render))
  listeners.get('game-session')({ ...engine.getPublicState('g'), isHost: true })
  const hydrate = () => listeners.get('game-round-state')(engine.getPublicState('g', 'host'))
  hydrate()
  mounted = {
    room,
    root,
    actor,
    socket,
    hydrate,
    receive: (event, data) => listeners.get(event)(data),
    close: () => {
      cleanup.reverse().forEach((fn) => fn())
      bridge.destroy()
      section.remove()
    },
  }
  return mounted
}
const click = (root, action) => root.querySelector(`[data-ns-command="${action}"]`).click()
afterEach(() => {
  mounted?.close()
  mounted = null
  engine._reset()
})
describe('generated live host controls with real server authority', () => {
  it('selects a Daily Double, submits editable wager and adjudicates only after server reveal', () => {
    const f = mount('jeopardy', { dailyDouble: ['cell-100'], negativePoints: true })
    click(f.root, 'select')
    expect(f.room.domain.phase).toBe('wager')
    const wager = f.root.querySelector('input[type="number"]')
    wager.value = '500'
    click(f.root, 'wager')
    expect(f.room.domain.currentWager).toBe(500)
    expect(f.root.querySelector('[data-ns-command="adjudicate"]')).toBeNull()
    click(f.root, 'reveal')
    click(f.root, 'adjudicate')
    expect(f.room.domain.scores['team-1']).toBe(500)
    expect(f.room.domain.usedCellIds).toEqual(['cell-100'])
    expect(f.root.querySelector('[data-ns-command="adjudicate"]')).toBeNull()
    f.receive('disconnect')
    expect([...f.root.querySelectorAll('button')].every((button) => button.disabled)).toBe(true)
    expect(f.socket.connected).toBe(true)
  })
  it('uses editable host letter and meaning adjudication to revise shared uniqueness scoring', () => {
    const f = mount('scattergories', { letterMode: 'manual', letter: 'A' })
    const joined = engine.joinRoom('g', 'learner', 'Learner', { socketId: 'learner-socket' })
    f.hydrate()
    click(f.root, 'assignTeam')
    expect(f.room.players.get('learner').teamId).toBe('team-1')
    f.root.querySelector('input[type="text"]').value = 'B'
    const selected = [...f.root.querySelectorAll('button')].find(
      (button) => button.textContent === 'Start selected letter'
    )
    selected.click()
    expect(f.room.domain.letter).toBe('B')
    const answer = engine.command(
      'game-scatter-submit',
      {
        ...engine.getPublicState('g'),
        commandId: 'submission',
        entries: [{ categoryId: 'category-1', text: 'Banana' }],
      },
      { playerId: 'learner', socketId: 'learner-socket', sessionToken: joined.sessionToken }
    )
    expect(answer.accepted).toBe(true)
    f.hydrate()
    expect(f.root.querySelector('[data-ns-command="adjudicate"]')).toBeNull()
    click(f.root, 'reveal')
    expect(f.room.domain.scores['team-1']).toBe(10)
    const invalid = [...f.root.querySelectorAll('button')].find(
      (button) => button.textContent === 'Invalid meaning'
    )
    invalid.click()
    expect(f.room.domain.scores['team-1']).toBe(0)
    expect(engine.getPublicState('g').revealed.rows[0]).toMatchObject({
      text: 'Banana',
      valid: false,
      points: 0,
    })
  })
})
