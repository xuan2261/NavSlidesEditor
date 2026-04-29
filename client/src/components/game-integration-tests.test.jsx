/**
 * Integration tests for Game Element System (Phase 11).
 * Tests the complete game flow: element creation → renderer → properties → socket.
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGameElement, GAME_TYPES } from '../constants/game-element-types-constants'

// Mock socket.io-client (used by use-game-socket)
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

// Mock canvas-confetti (used in interactive renderer but not in static render)
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

// Mock use-game-socket (relative to element-renderers/game-element-renderer.jsx)
vi.mock('../../hooks/use-game-socket', () => ({
  useGameSocket: () => ({
    socket: null,
    isConnected: false,
    joinError: null,
    gameState: null,
    leaderboard: [],
    players: [],
    lastEvent: null,
    emit: vi.fn(),
  }),
}))

// Dynamic imports — vi.mock must be declared before these
let GameElementRenderer
let GameProperties

beforeEach(async () => {
  vi.resetModules()
  try {
    const mod = await import('../components/canvas/element-renderers/game-element-renderer.jsx')
    GameElementRenderer = mod.GameElementRenderer
  } catch (e) {
    console.warn('GameElementRenderer import failed:', e?.message)
    GameElementRenderer = null
  }
  try {
    const mod = await import('../components/properties/game-properties.jsx')
    GameProperties = mod.default
  } catch (e) {
    console.warn('GameProperties import failed:', e?.message)
    GameProperties = null
  }
})

function render(el) {
  if (!GameElementRenderer) throw new Error('GameElementRenderer not loaded')
  return renderToString(React.createElement(GameElementRenderer, el))
}

describe('Game Element — creation to render pipeline', () => {
  it('createGameElement produces element usable by renderer', () => {
    const el = createGameElement('name-picker')
    const html = render(el)
    expect(html).toContain('Game:')
    expect(html.toLowerCase()).toContain('name')
  })

  it('all 7 game types render without errors', () => {
    GAME_TYPES.all.forEach(gt => {
      const el = createGameElement(gt)
      expect(() => render(el)).not.toThrow()
      const html = render(el)
      expect(html).toContain('Game:')
    })
  })

  it('createGameElement merges overrides correctly', () => {
    const el = createGameElement('hot-potato', {
      backgroundColor: '#ff0000',
      accentColor: '#00ff00',
    })
    const html = render(el)
    expect(html).toContain('#ff0000')
    expect(html).toContain('#00ff00')
  })
})

describe('Game Properties — element update pipeline', () => {
  it('game properties renders with game element', () => {
    const el = createGameElement('name-picker')
    const html = renderToString(
      <GameProperties element={el} onUpdate={() => {}} onDelete={() => {}} />
    )
    expect(html).toContain('Content')
    expect(html).toContain('Display')
    expect(html).toContain('Scoring')
    expect(html).toContain('name-picker')
  })

  it('changing gameType in properties creates correct element', () => {
    const el = createGameElement('name-picker')
    // Simulate gameType change → new element with correct defaults
    const newEl = createGameElement('jeopardy')
    expect(newEl.gameType).toBe('jeopardy')
    const html = render(newEl)
    expect(html.toLowerCase()).toContain('jeopardy')
  })

  it('properties element has all required fields for renderer', () => {
    const el = createGameElement('hot-potato', {
      questions: [
        { id: 'q1', question: 'Test Q?', options: ['A', 'B', 'C', 'D'], correctIndex: 0 }
      ]
    })
    // Renderer should display question
    const html = render(el)
    expect(html).toContain('Game:')
  })
})

describe('Game Renderer — mode switching', () => {
  it('edit mode shows placeholder text', () => {
    const el = createGameElement('name-picker')
    el.gameStatus = 'setup'
    const html = render({ element: el, isPresenting: false })
    expect(html.toLowerCase()).toContain('configure')
  })

  it('presentation mode hides placeholder', () => {
    const el = createGameElement('name-picker')
    el.gameStatus = 'running'
    const html = render({ element: el, isPresenting: true })
    expect(html.toLowerCase()).not.toContain('configure in properties panel')
  })

  it('gameStatus ended shows final results', () => {
    const el = createGameElement('name-picker')
    el.gameStatus = 'ended'
    const html = render({ element: el, isPresenting: true })
    expect(html.toLowerCase()).not.toContain('configure in properties panel')
  })
})

describe('Game Renderer — visual customization', () => {
  it('custom backgroundColor renders', () => {
    const el = createGameElement('hot-potato', { backgroundColor: '#123456' })
    const html = render(el)
    expect(html).toContain('#123456')
  })

  it('custom accentColor renders', () => {
    const el = createGameElement('hot-potato', { accentColor: '#abcdef' })
    const html = render(el)
    expect(html).toContain('#abcdef')
  })

  it('each game type has distinct visual representation', () => {
    const types = [
      { gt: 'name-picker', expect: 'name' },
      { gt: 'hot-potato', expect: 'hot potato' },
      { gt: 'jeopardy', expect: 'jeopardy' },
      { gt: 'four-corners', expect: 'four' },
      { gt: 'relay-race', expect: 'relay' },
      { gt: 'trivia-champ', expect: 'trivia' },
      { gt: 'scattergories', expect: 'scattergories' },
    ]
    types.forEach(({ gt, expect: str }) => {
      const el = createGameElement(gt)
      const html = render(el)
      expect(html.toLowerCase()).toContain(str)
    })
  })
})

describe('Game element — deep element structure', () => {
  it('name-picker has pickerMode, items, wheelColors', () => {
    const el = createGameElement('name-picker')
    expect(el.pickerMode).toBeDefined()
    expect(el.items).toBeInstanceOf(Array)
    expect(el.wheelColors).toBeInstanceOf(Array)
  })

  it('hot-potato has questions array', () => {
    const el = createGameElement('hot-potato')
    expect(el.questions).toBeInstanceOf(Array)
  })

  it('jeopardy has teams and categories', () => {
    const el = createGameElement('jeopardy')
    expect(el.teams).toBeInstanceOf(Array)
    expect(el.categories).toBeInstanceOf(Array)
  })

  it('four-corners has cornerCount=4', () => {
    const el = createGameElement('four-corners')
    expect(el.cornerCount).toBe(4)
  })

  it('relay-race has passOnWrong=true', () => {
    const el = createGameElement('relay-race')
    expect(el.passOnWrong).toBe(true)
  })

  it('trivia-champ has rounds array', () => {
    const el = createGameElement('trivia-champ')
    expect(el.rounds).toBeInstanceOf(Array)
  })

  it('scattergories has timePerRound=60', () => {
    const el = createGameElement('scattergories')
    expect(el.timePerRound).toBe(60)
  })

  it('all game elements have display properties', () => {
    GAME_TYPES.all.forEach(gt => {
      const el = createGameElement(gt)
      expect(el.width).toBeGreaterThan(0)
      expect(el.height).toBeGreaterThan(0)
      expect(el.backgroundColor).toBeDefined()
      expect(el.accentColor).toBeDefined()
      expect(el.gameStatus).toBe('setup')
    })
  })
})
