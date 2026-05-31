import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('game handlers in EditorPage', () => {
  const src = readFileSync('client/src/pages/EditorPage.jsx', 'utf8')

  it('G is a real HUD state toggle', () => {
    expect(src).toMatch(/onGameHud:\s*\(\)\s*=>\s*setShowGameHud\s*\(\s*\(?v\)?\s*=>\s*!v\s*\)/)
  })

  it('L is a real leaderboard state toggle', () => {
    expect(src).toMatch(/onGameLeaderboard:\s*\(\)\s*=>\s*setShowGameLeaderboard\s*\(\s*\(?v\)?\s*=>\s*!v\s*\)/)
  })

  it('Enter, R, P, and team handlers are not console stubs', () => {
    expect(src).not.toMatch(/onGameNext:\s*\(\)\s*=>\s*console\.log/)
    expect(src).not.toMatch(/onGameReveal:\s*\(\)\s*=>\s*console\.log/)
    expect(src).not.toMatch(/onGamePause:\s*\(\)\s*=>\s*console\.log/)
    expect(src).not.toMatch(/onTeamSelect[1-4]:\s*\(\)\s*=>\s*console\.log/)
    expect(src).toContain("emitGameShortcutAction('next')")
    expect(src).toContain("emitGameShortcutAction('team-select', { teamIndex: 0 })")
  })
})
