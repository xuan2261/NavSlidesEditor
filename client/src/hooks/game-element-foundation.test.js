/**
 * Unit tests for Game Element Foundation (Phase 1).
 * Tests: game-types constants, ELEMENT_DEFAULTS.game schema, DEFAULT_POSITIONS.game.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { ELEMENT_DEFAULTS, DEFAULT_POSITIONS } from '../data/element-defaults'
import {
  GAME_TYPES,
  DEFAULT_GAME_COLORS,
  GAME_BASE_DEFAULTS,
  GAME_TYPE_DEFAULTS,
  createGameElement,
  createQuestion,
  createTeam,
  resetTeamCounter,
} from '../constants/game-element-types-constants'

describe('GAME_TYPES constants', () => {
  it('exports all 10 game type keys', () => {
    const expected = [
      'name-picker',
      'hot-potato',
      'jeopardy',
      'four-corners',
      'relay-race',
      'trivia-champ',
      'scattergories',
      'poll',
      'word-cloud',
      'matching',
    ]
    expect(GAME_TYPES.all).toHaveLength(10)
    expected.forEach(gt => {
      expect(GAME_TYPES).toHaveProperty(gt)
      expect(GAME_TYPES[gt]).toBe(gt)
    })
  })

  it('GAME_TYPES values match their keys', () => {
    Object.entries(GAME_TYPES)
      .filter(([key]) => key !== 'all')
      .forEach(([key, value]) => {
        expect(value).toBe(key)
      })
  })
})

describe('DEFAULT_GAME_COLORS', () => {
  it('has wheelColors array with at least 8 colors', () => {
    expect(DEFAULT_GAME_COLORS.wheelColors).toBeInstanceOf(Array)
    expect(DEFAULT_GAME_COLORS.wheelColors.length).toBeGreaterThanOrEqual(8)
  })

  it('has valid hex color strings', () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/
    DEFAULT_GAME_COLORS.wheelColors.forEach(color => {
      expect(color).toMatch(hexRegex)
    })
  })
})

describe('ELEMENT_DEFAULTS.game — base schema', () => {
  it('game element has type "game"', () => {
    expect(ELEMENT_DEFAULTS.game.type).toBe('game')
  })

  it('game has all 10 gameTypes', () => {
    GAME_TYPES.all.forEach(gt => {
      expect(ELEMENT_DEFAULTS.game[gt]).toBeDefined()
    })
  })

  it('has display properties', () => {
    expect(ELEMENT_DEFAULTS.game.width).toBeDefined()
    expect(ELEMENT_DEFAULTS.game.height).toBeDefined()
    expect(ELEMENT_DEFAULTS.game.zIndex).toBeDefined()
    expect(ELEMENT_DEFAULTS.game.backgroundColor).toBeDefined()
    expect(ELEMENT_DEFAULTS.game.accentColor).toBeDefined()
    expect(ELEMENT_DEFAULTS.game.showSoundEffects).toBeDefined()
    expect(ELEMENT_DEFAULTS.game.gameStatus).toBeDefined()
  })

  it('gameStatus defaults to "setup"', () => {
    expect(ELEMENT_DEFAULTS.game.gameStatus).toBe('setup')
  })
})

describe('ELEMENT_DEFAULTS.game.name-picker', () => {
  const np = ELEMENT_DEFAULTS.game['name-picker']

  it('has pickerMode defaults to "wheel"', () => {
    expect(np.pickerMode).toBe('wheel')
  })

  it('has wheelSegments defaults to 8', () => {
    expect(np.wheelSegments).toBe(8)
  })

  it('has wheelColors matching DEFAULT_GAME_COLORS', () => {
    expect(np.wheelColors).toEqual(DEFAULT_GAME_COLORS.wheelColors)
  })

  it('has items array with sample names', () => {
    expect(np.items).toBeInstanceOf(Array)
    expect(np.items.length).toBeGreaterThan(0)
  })

  it('has animationDuration defaults to 2500', () => {
    expect(np.animationDuration).toBe(2500)
  })

  it('has excludeAfterPick defaults to true', () => {
    expect(np.excludeAfterPick).toBe(true)
  })

  it('has diceCount defaults to 2', () => {
    expect(np.diceCount).toBe(2)
  })

  it('has weighted defaults to false', () => {
    expect(np.weighted).toBe(false)
  })
})

describe('ELEMENT_DEFAULTS.game.hot-potato', () => {
  const hp = ELEMENT_DEFAULTS.game['hot-potato']

  it('has title default', () => {
    expect(hp.title).toBeDefined()
  })

  it('has questions array (empty by default)', () => {
    expect(hp.questions).toBeInstanceOf(Array)
  })

  it('has showLeaderboard defaults to true', () => {
    expect(hp.showLeaderboard).toBe(true)
  })

  it('has shuffleQuestions defaults to false', () => {
    expect(hp.shuffleQuestions).toBe(false)
  })

  it('has allowLate defaults to false', () => {
    expect(hp.allowLate).toBe(false)
  })
})

describe('ELEMENT_DEFAULTS.game.jeopardy', () => {
  const jp = ELEMENT_DEFAULTS.game.jeopardy

  it('has teams array (empty by default)', () => {
    expect(jp.teams).toBeInstanceOf(Array)
  })

  it('has categories array (empty by default)', () => {
    expect(jp.categories).toBeInstanceOf(Array)
  })

  it('has dailyDouble array (empty by default)', () => {
    expect(jp.dailyDouble).toBeInstanceOf(Array)
  })
})

describe('ELEMENT_DEFAULTS.game.four-corners', () => {
  const fc = ELEMENT_DEFAULTS.game['four-corners']

  it('has cornerCount defaults to 4', () => {
    expect(fc.cornerCount).toBe(4)
  })

  it('has showTimer defaults to true', () => {
    expect(fc.showTimer).toBe(true)
  })

  it('has eliminateMode defaults to "wrong"', () => {
    expect(fc.eliminateMode).toBe('wrong')
  })
})

describe('ELEMENT_DEFAULTS.game.relay-race', () => {
  const rr = ELEMENT_DEFAULTS.game['relay-race']

  it('has questionsPerRound defaults to 4', () => {
    expect(rr.questionsPerRound).toBe(4)
  })

  it('has shuffleTeams defaults to true', () => {
    expect(rr.shuffleTeams).toBe(true)
  })

  it('has passOnWrong defaults to true', () => {
    expect(rr.passOnWrong).toBe(true)
  })
})

describe('ELEMENT_DEFAULTS.game.trivia-champ', () => {
  const tc = ELEMENT_DEFAULTS.game['trivia-champ']

  it('has rounds array', () => {
    expect(tc.rounds).toBeInstanceOf(Array)
  })

  it('has lightningRound object', () => {
    expect(tc.lightningRound).toBeDefined()
  })

  it('has jackpotRound object', () => {
    expect(tc.jackpotRound).toBeDefined()
  })
})

describe('ELEMENT_DEFAULTS.game.scattergories', () => {
  const sc = ELEMENT_DEFAULTS.game.scattergories

  it('has timePerRound defaults to 60', () => {
    expect(sc.timePerRound).toBe(60)
  })

  it('has letterMode defaults to "random"', () => {
    expect(sc.letterMode).toBe('random')
  })

  it('has categories array', () => {
    expect(sc.categories).toBeInstanceOf(Array)
  })

  it('has scoring defaults to "unique"', () => {
    expect(sc.scoring).toBe('unique')
  })
})

describe('DEFAULT_POSITIONS.game', () => {
  it('exists', () => {
    expect(DEFAULT_POSITIONS.game).toBeDefined()
  })

  it('has x and y coordinates', () => {
    expect(DEFAULT_POSITIONS.game).toHaveProperty('x')
    expect(DEFAULT_POSITIONS.game).toHaveProperty('y')
    expect(typeof DEFAULT_POSITIONS.game.x).toBe('number')
    expect(typeof DEFAULT_POSITIONS.game.y).toBe('number')
  })

  it('is positioned reasonably on canvas', () => {
    expect(DEFAULT_POSITIONS.game.x).toBeGreaterThan(0)
    expect(DEFAULT_POSITIONS.game.y).toBeGreaterThan(0)
  })
})

describe('createGameElement factory', () => {
  it('creates element with type "game"', () => {
    const el = createGameElement('name-picker')
    expect(el.type).toBe('game')
  })

  it('creates element with correct gameType', () => {
    GAME_TYPES.all.forEach(gt => {
      const el = createGameElement(gt)
      expect(el.gameType).toBe(gt)
    })
  })

  it('defaults to name-picker gameType', () => {
    const el = createGameElement()
    expect(el.gameType).toBe('name-picker')
  })

  it('name-picker element has wheel/dice/button modes', () => {
    const el = createGameElement('name-picker')
    expect(['wheel', 'dice', 'button']).toContain(el['name-picker'].pickerMode)
  })

  it('name-picker element has nested items array', () => {
    const el = createGameElement('name-picker')
    expect(el['name-picker'].items).toBeInstanceOf(Array)
  })

  it('hot-potato element has nested questions array', () => {
    const el = createGameElement('hot-potato')
    expect(el['hot-potato'].questions).toBeInstanceOf(Array)
  })

  it('hot-potato element has nested showLeaderboard', () => {
    const el = createGameElement('hot-potato')
    expect(el['hot-potato'].showLeaderboard).toBe(true)
  })

  it('jeopardy element has nested teams and categories arrays', () => {
    const el = createGameElement('jeopardy')
    expect(el.jeopardy.teams).toBeInstanceOf(Array)
    expect(el.jeopardy.categories).toBeInstanceOf(Array)
  })

  it('four-corners element has nested cornerCount of 4', () => {
    const el = createGameElement('four-corners')
    expect(el['four-corners'].cornerCount).toBe(4)
  })

  it('relay-race element has nested passOnWrong', () => {
    const el = createGameElement('relay-race')
    expect(el['relay-race'].passOnWrong).toBe(true)
  })

  it('trivia-champ element has nested rounds array', () => {
    const el = createGameElement('trivia-champ')
    expect(el['trivia-champ'].rounds).toBeInstanceOf(Array)
  })

  it('scattergories element has nested timePerRound of 60', () => {
    const el = createGameElement('scattergories')
    expect(el.scattergories.timePerRound).toBe(60)
  })

  it('gameStatus defaults to "setup"', () => {
    const el = createGameElement('name-picker')
    expect(el.gameStatus).toBe('setup')
  })

  it('has display properties (width, height, backgroundColor, accentColor)', () => {
    const el = createGameElement('name-picker')
    expect(el.width).toBeGreaterThan(0)
    expect(el.height).toBeGreaterThan(0)
    expect(el.backgroundColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(el.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('merges overrides into base element', () => {
    const el = createGameElement('name-picker', { width: 800, height: 600 })
    expect(el.width).toBe(800)
    expect(el.height).toBe(600)
    expect(el.gameType).toBe('name-picker')
    expect(el.gameStatus).toBe('setup')
  })

  it('matches base defaults plus subtype defaults plus overrides', () => {
    for (const gameType of GAME_TYPES.all) {
      const overrides = { width: 777 }
      expect(createGameElement(gameType, overrides)).toEqual({
        ...structuredClone(GAME_BASE_DEFAULTS),
        gameType,
        [gameType]: structuredClone(GAME_TYPE_DEFAULTS[gameType]),
        ...overrides,
      })
    }
  })

  it('does not share mutable nested defaults between created elements', () => {
    const firstNamePicker = createGameElement('name-picker')
    const secondNamePicker = createGameElement('name-picker')
    firstNamePicker['name-picker'].items.push('Mutated')
    firstNamePicker['name-picker'].wheelColors.push('#000000')
    expect(secondNamePicker['name-picker'].items).not.toContain('Mutated')
    expect(secondNamePicker['name-picker'].wheelColors).not.toContain('#000000')

    const firstTrivia = createGameElement('trivia-champ')
    const secondTrivia = createGameElement('trivia-champ')
    firstTrivia['trivia-champ'].lightningRound.enabled = true
    expect(secondTrivia['trivia-champ'].lightningRound.enabled).toBe(false)
    expect(GAME_TYPE_DEFAULTS['trivia-champ'].lightningRound.enabled).toBe(false)
  })
})

describe('createQuestion factory', () => {
  beforeEach(() => { /* reset not needed — each call generates unique id */ })

  it('creates a valid question object', () => {
    const q = createQuestion()
    expect(q).toHaveProperty('id')
    expect(q).toHaveProperty('question')
    expect(q).toHaveProperty('options')
    expect(q).toHaveProperty('correctIndex')
    expect(q).toHaveProperty('timeLimit')
    expect(q).toHaveProperty('points')
  })

  it('has 4 default options', () => {
    const q = createQuestion()
    expect(q.options).toHaveLength(4)
  })

  it('correctIndex defaults to 0', () => {
    const q = createQuestion()
    expect(q.correctIndex).toBe(0)
  })

  it('timeLimit defaults to 30', () => {
    const q = createQuestion()
    expect(q.timeLimit).toBe(30)
  })

  it('points defaults to 10', () => {
    const q = createQuestion()
    expect(q.points).toBe(10)
  })

  it('generates unique IDs', () => {
    const q1 = createQuestion()
    const q2 = createQuestion()
    expect(q1.id).not.toBe(q2.id)
  })

  it('merges overrides correctly', () => {
    const q = createQuestion({ question: 'What is 2+2?', correctIndex: 1, points: 20 })
    expect(q.question).toBe('What is 2+2?')
    expect(q.correctIndex).toBe(1)
    expect(q.points).toBe(20)
    expect(q.options).toHaveLength(4)
  })
})

describe('createTeam factory', () => {
  beforeEach(() => { resetTeamCounter() })

  it('creates a valid team object', () => {
    const t = createTeam()
    expect(t).toHaveProperty('id')
    expect(t).toHaveProperty('name')
    expect(t).toHaveProperty('color')
    expect(t).toHaveProperty('score')
  })

  it('score defaults to 0', () => {
    const t = createTeam()
    expect(t.score).toBe(0)
  })

  it('color is a valid hex color', () => {
    const t = createTeam()
    expect(t.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })

  it('cycles through team colors deterministically', () => {
    const t1 = createTeam()
    const t2 = createTeam()
    const t3 = createTeam()
    expect(t1.color).not.toBe(t2.color)
    expect(t2.color).not.toBe(t3.color)
  })

  it('generates unique IDs', () => {
    const t1 = createTeam()
    const t2 = createTeam()
    expect(t1.id).not.toBe(t2.id)
  })

  it('merges overrides correctly', () => {
    const t = createTeam({ name: 'Red Dragons', score: 50, color: '#ff0000' })
    expect(t.name).toBe('Red Dragons')
    expect(t.score).toBe(50)
    expect(t.color).toBe('#ff0000')
  })
})
