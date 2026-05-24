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

  it('Enter, R, and P handlers remain console stubs', () => {
    expect(src).toMatch(/onGameNext:\s*\(\)\s*=>\s*console\.log\(['"]\[game\] next phase['"]\)/)
    expect(src).toMatch(/onGameReveal:\s*\(\)\s*=>\s*console\.log\(['"]\[game\] reveal['"]\)/)
    expect(src).toMatch(/onGamePause:\s*\(\)\s*=>\s*console\.log\(['"]\[game\] pause['"]\)/)
  })
})
