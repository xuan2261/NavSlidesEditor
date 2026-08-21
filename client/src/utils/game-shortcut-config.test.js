import { describe, expect, it } from 'vitest'
import { GAME_SHORTCUT_CONFIG, GAME_TYPES } from './game-shortcut-config'

describe('GAME_SHORTCUT_CONFIG', () => {
  it('exports config for all known game types', () => {
    expect(GAME_SHORTCUT_CONFIG).toBeDefined()
    expect(typeof GAME_SHORTCUT_CONFIG).toBe('object')
  })

  it('name-picker has timer but no reveal', () => {
    const cfg = GAME_SHORTCUT_CONFIG['name-picker']
    expect(cfg.timer).not.toBeNull()
    expect(cfg.reveal).toBeNull()
    expect(cfg.leaderboard).toBeNull()
  })

  it('hot-potato exposes only implemented remote controls', () => {
    const cfg = GAME_SHORTCUT_CONFIG['hot-potato']
    expect(cfg.timer).not.toBeNull()
    expect(cfg.reveal).toBeNull()
    expect(cfg.leaderboard).not.toBeNull()
    expect(cfg.nextPhase).not.toBeNull()
    expect(cfg.pause).not.toBeNull()
    expect(cfg.timerAdd).not.toBeNull()
    expect(cfg.timerSub).not.toBeNull()
    expect(cfg.teamSelect).toBeNull()
  })

  it('jeopardy omits unsupported reveal and team-selection controls', () => {
    const cfg = GAME_SHORTCUT_CONFIG['jeopardy']
    expect(cfg.teamSelect).toBeNull()
    expect(cfg.reveal).toBeNull()
    expect(cfg.timer).not.toBeNull()
    expect(cfg.nextPhase).not.toBeNull()
  })

  it('relay-race keeps next-team but omits unsupported direct team selection', () => {
    const cfg = GAME_SHORTCUT_CONFIG['relay-race']
    expect(cfg.timer).toBeNull()
    expect(cfg.leaderboard).not.toBeNull()
    expect(cfg.nextPhase).not.toBeNull()
    expect(cfg.teamSelect).toBeNull()
  })

  it('four-corners, trivia, and scattergories hide unsupported remote actions', () => {
    expect(GAME_SHORTCUT_CONFIG['four-corners'].nextPhase).toBeNull()
    expect(GAME_SHORTCUT_CONFIG['trivia-champ'].reveal).toBeNull()
    expect(GAME_SHORTCUT_CONFIG.scattergories.reveal).toBeNull()
  })

  it('scattergories has +30s/-30s timer adjustment', () => {
    const cfg = GAME_SHORTCUT_CONFIG['scattergories']
    expect(cfg.timerAdd).not.toBeNull()
    expect(cfg.timerSub).not.toBeNull()
    expect(cfg.timerAdd.label).toBe('+30s')
    expect(cfg.timerSub.label).toBe('-30s')
  })

  it('each non-null shortcut entry has label, key, and action fields', () => {
    for (const [_gameType, config] of Object.entries(GAME_SHORTCUT_CONFIG)) {
      for (const [_action, entry] of Object.entries(config)) {
        if (entry === null) continue
        if (Array.isArray(entry.keys)) {
          expect(entry).toHaveProperty('label')
          expect(entry).toHaveProperty('action')
          expect(entry.keys.length).toBeGreaterThan(0)
        } else {
          expect(entry).toHaveProperty('label')
          expect(entry).toHaveProperty('key')
          expect(entry).toHaveProperty('action')
        }
      }
    }
  })

  it('GAME_TYPES array contains all game type keys', () => {
    expect(Array.isArray(GAME_TYPES)).toBe(true)
    expect(GAME_TYPES).toContain('name-picker')
    expect(GAME_TYPES).toContain('hot-potato')
    expect(GAME_TYPES).toContain('jeopardy')
    expect(GAME_TYPES).toContain('four-corners')
    expect(GAME_TYPES).toContain('relay-race')
    expect(GAME_TYPES).toContain('trivia-champ')
    expect(GAME_TYPES).toContain('scattergories')
    expect(GAME_TYPES.length).toBe(Object.keys(GAME_SHORTCUT_CONFIG).length)
  })
})
