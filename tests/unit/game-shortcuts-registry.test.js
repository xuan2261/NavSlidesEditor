import { describe, expect, it } from 'vitest'
import { DEFAULT_SHORTCUTS } from '../../client/src/utils/default-keyboard-shortcut-definitions-registry.js'

describe('game shortcuts registry', () => {
  const gameShortcuts = DEFAULT_SHORTCUTS.filter((shortcut) =>
    shortcut.scopes.includes('presentation-game')
  )

  it('binds G in presentation-game scope', () => {
    expect(gameShortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gameHud', defaultKey: 'G' }),
      ])
    )
  })

  it('binds L in presentation-game scope', () => {
    expect(gameShortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gameLeaderboard', defaultKey: 'L' }),
      ])
    )
  })
})
