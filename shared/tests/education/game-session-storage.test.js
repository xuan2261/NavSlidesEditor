import { describe, expect, it } from 'vitest'
import { createGameSessionStorage } from '../../src/education/browser/game-session-storage.js'
function memory() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key),
    setItem: (key, value) => values.set(key, value),
    values,
  }
}
describe('role and room scoped session persistence', () => {
  it('restores same room identity but isolates rooms, host and learner sessions', () => {
    const storage = memory(),
      sessionStorage = memory()
    let count = 0
    const open = (gameId, role) =>
      createGameSessionStorage({
        storage,
        sessionStorage,
        gameId,
        role,
        randomId: () => `p${++count}`,
      })
    const player = open('a', 'player')
    player.setToken('learner-token')
    expect(open('a', 'player').playerId).toBe(player.playerId)
    expect(open('a', 'player').getToken()).toBe('learner-token')
    expect(open('b', 'player').getToken()).toBe(null)
    const host = open('a', 'host')
    host.setCapability('host-secret')
    expect(open('a', 'host').getCapability()).toBe('host-secret')
    expect(player.getCapability()).toBe(null)
    expect(Array.from(storage.values.values())).not.toContain('host-secret')
    expect(open('a', 'observer').getToken()).toBe(null)
  })
  it('still joins in a storage-denied context without changing another identity', () => {
    const denied = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    }
    const session = createGameSessionStorage({
      storage: denied,
      sessionStorage: denied,
      gameId: 'a',
      role: 'player',
      randomId: () => 'p',
    })
    session.setToken('token')
    expect(session.playerId).toBe('p')
    expect(session.getToken()).toBe(null)
  })
})
