import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('game handlers in the editor keyboard controller', () => {
  const src = readFileSync(
    'client/src/hooks/editor-controller/use-editor-keyboard-controller.js',
    'utf8',
  )

  it('G is a real HUD state toggle', () => {
    expect(src).toMatch(
      /onGameHud:\s*\(\)\s*=>\s*c\.setShowGameHud\s*\(\s*\(?v\)?\s*=>\s*!v\s*\)/,
    )
  })

  it('L is a real leaderboard state toggle when configured for the active game', () => {
    expect(src).toMatch(
      /onGameLeaderboard:\s*\(\)\s*=>\s*\{\s*if \(getGameShortcut\(c, 'leaderboard'\)\) c\.setShowGameLeaderboard\s*\(\s*\(?v\)?\s*=>\s*!v\s*\)/,
    )
  })

  it('Enter, R, P, and team handlers dispatch their configured actions', () => {
    expect(src).not.toMatch(/onGameNext:\s*\(\)\s*=>\s*console\.log/)
    expect(src).not.toMatch(/onGameReveal:\s*\(\)\s*=>\s*console\.log/)
    expect(src).not.toMatch(/onGamePause:\s*\(\)\s*=>\s*console\.log/)
    expect(src).not.toMatch(/onTeamSelect[1-4]:\s*\(\)\s*=>\s*console\.log/)
    expect(src).toContain("emitConfiguredGameShortcut(c, 'nextPhase')")
    expect(src).toContain("emitConfiguredGameShortcut(c, 'teamSelect', { teamIndex: 0 })")
  })
})
