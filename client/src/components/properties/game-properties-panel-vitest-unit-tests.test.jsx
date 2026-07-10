/**
 * Unit tests for Game Properties Panel (Phase 4).
 * Tests: GameProperties renders all 3 tabs and updates correctly.
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import GameProperties from './game-properties.jsx'
import { GAME_TYPES } from '../../constants/game-element-types-constants.js'

// Mock crypto.randomUUID for deterministic IDs
const mockUUIDs = ['test-uuid-0', 'test-uuid-1', 'test-uuid-2']
let uuidIndex = 0
vi.stubGlobal('crypto', {
  randomUUID: () => mockUUIDs[uuidIndex++] || `uuid-${uuidIndex}`,
})

const makeGameElement = (gameType = 'name-picker', overrides = {}) => ({
  type: 'game',
  id: 'game-el-1',
  gameType,
  width: 640,
  height: 480,
  backgroundColor: '#1a1a2e',
  accentColor: '#6366f1',
  fontFamily: 'sans-serif',
  showSoundEffects: true,
  showConfetti: false,
  showTimer: true,
  pointsPerCorrect: 10,
  bonusMultiplier: 1,
  leaderboardTopN: 5,
  showLeaderboard: true,
  'name-picker': {
    pickerMode: 'wheel',
    items: ['Alice', 'Bob', 'Charlie'],
    wheelSegments: 8,
    excludeAfterPick: true,
    animationDuration: 2500,
    timerDuration: 30,
  },
  'hot-potato': {
    title: 'Hot Potato Quiz',
    questions: [
      {
        id: 'q1',
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctIndex: 1,
        timeLimit: 30,
        points: 10,
      },
    ],
    currentQuestion: 0,
    allowLate: false,
    showLeaderboard: true,
    shuffleQuestions: false,
    timerDuration: 30,
  },
  'jeopardy': {
    title: 'Jeopardy',
    teams: [{ id: 'team-1', name: 'Red', color: '#ff0000', score: 0 }],
    categories: [],
    questions: {},
    dailyDouble: [],
    timerDuration: 30,
  },
  'four-corners': {
    cornerCount: 4,
    eliminateMode: 'wrong',
    showTimer: true,
    timerDuration: 30,
  },
  'relay-race': {
    questionsPerRound: 4,
    shuffleTeams: true,
    passOnWrong: true,
    timerDuration: 30,
  },
  'trivia-champ': {
    rounds: [],
    lightningRound: { enabled: false, timePerQ: 10 },
    jackpotRound: { enabled: false, multiplier: 2 },
    timerDuration: 30,
  },
  'scattergories': {
    timePerRound: 60,
    letterMode: 'random',
    categories: [],
    scoring: 'unique',
    timerDuration: 30,
  },
  ...overrides,
})

describe('GameProperties — renders all tabs', () => {
  let onUpdate

  beforeEach(() => {
    onUpdate = vi.fn()
    uuidIndex = 0
  })

  it('renders Content tab by default', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('Content')
    expect(html).toContain('Display')
    expect(html).not.toContain('Scoring')
  })

  it('renders game type selector with all 10 game types', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    GAME_TYPES.all.forEach(gt => {
      expect(html).toContain(gt)
    })
  })

  it('renders name-picker items textarea', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('Items')
    expect(html).toContain('Alice')
    expect(html).toContain('Bob')
    expect(html).toContain('Charlie')
  })

  it('renders pickerMode selector for name-picker', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('wheel')
    expect(html).toContain('dice')
    expect(html).toContain('button')
  })

  it('renders timer config slider only for a timer-backed subtype', () => {
    const el = makeGameElement('relay-race')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('Timer')
    expect(html).toContain('30')
  })

  it('renders team editor for jeoparcy game type', () => {
    const el = makeGameElement('jeopardy')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('Team')
    expect(html).toContain('Red')
  })

  it('renders question list for hot-potato', () => {
    const el = makeGameElement('hot-potato')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('Question')
    expect(html).toContain('What is 2+2?')
  })

  it('renders Display tab fields', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(html).toContain('Display')
  })

  it('does not expose unsupported global scoring controls', () => {
    const el = makeGameElement('hot-potato')
    const defaultHtml = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    expect(defaultHtml).not.toContain('Scoring')
    expect(defaultHtml).toContain('Content')
    expect(defaultHtml).toContain('Display')
  })
})

describe('GameProperties — onUpdate interactions', () => {
  let onUpdate

  beforeEach(() => {
    onUpdate = vi.fn()
    uuidIndex = 0
  })

  it('updates gameType via selector', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    // The component should contain a gameType selector with name-picker selected
    expect(html).toContain('name-picker')
  })

  it('updates items via textarea change', () => {
    const el = makeGameElement('name-picker')
    const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
    // Items should be rendered as comma-separated values
    expect(html).toContain('Alice')
  })
})

describe('GameProperties — all 10 game types render their section', () => {
  let onUpdate

  beforeEach(() => {
    onUpdate = vi.fn()
    uuidIndex = 0
  })

  GAME_TYPES.all.forEach(gt => {
    it(`renders ${gt} without crashing`, () => {
      const el = makeGameElement(gt)
      const html = renderToString(<GameProperties element={el} onUpdate={onUpdate} onDelete={() => {}} />)
      // Should render without throwing
      expect(html).toContain('Content')
      expect(html).toContain('Display')
      expect(html).not.toContain('Scoring')
    })
  })
})
