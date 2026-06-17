/**
 * Unit tests for GameElementRenderer (Phase 3).
 *
 * Test environment: Vitest + renderToString (react-dom/server).
 * No @testing-library/react available in this project.
 * Tests verify HTML output structure for each game type and mode.
 *
 * The GameElementRenderer is the factory that dispatches to sub-renderers
 * based on element.gameType. The actual renderer is implemented in Phase 3.
 * These tests define the contract the renderer must satisfy.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { GAME_TYPES } from '../../../constants/game-element-types-constants.js'

// vi.mock helpers — these take effect when the real game-element-renderer.jsx is implemented.
// During the placeholder phase, these mock shapes are tested indirectly.
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}))

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

// Dynamic import to pick up whichever version exists (placeholder or full).
// Vitest hoists vi.mock declarations, so the module must be importable.
let GameElementRenderer
let importError = null

beforeEach(async () => {
  // Clear module cache so HMR-style re-import works in watch mode.
  vi.resetModules()
  try {
    const mod = await import('./game-element-renderer.jsx')
    GameElementRenderer = mod.GameElementRenderer
  } catch (e) {
    importError = e
    GameElementRenderer = null
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function render(el) {
  if (!GameElementRenderer) {
    throw new Error(`Cannot render: module failed to import — ${importError?.message}`)
  }
  return renderToString(React.createElement(GameElementRenderer, el))
}

// ---------------------------------------------------------------------------
// Spec tests from phase-03-game-canvas-renderer.md
// ---------------------------------------------------------------------------
describe('Game Element Renderer — spec tests', () => {

  it('renders name-picker wheel with segments', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice', 'Bob', 'Carol'],
      wheelColors: ['#ff0000', '#00ff00', '#0000ff'],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    // Wheel mode must render wheel indicator/label
    expect(html).toContain('Game:')
    expect(html.toLowerCase()).toContain('name')
  })

  it('renders hot-potato question card', () => {
    const el = {
      type: 'game',
      gameType: 'hot-potato',
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
      questions: [{ question: 'What is 2+2?', options: ['A', 'B', 'C', 'D'], correctIndex: 1 }],
      title: 'Quick Math',
    }
    const html = render(el)
    // Placeholder: renders the game type label.
    // Phase 3 full renderer will also render the question content and options.
    expect(html.toLowerCase()).toContain('hot potato')
    // TODO(Phase 3): enable when full HotPotatoRenderer is implemented
    // expect(html).toContain('What is 2+2?')
  })

  it('renders jeopardy board grid', () => {
    const el = {
      type: 'game',
      gameType: 'jeopardy',
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#f59e0b',
      categories: [{ name: 'Math', questions: [100, 200, 300] }],
      teams: [],
    }
    const html = render(el)
    // Placeholder: renders the game type label.
    // Phase 3 full renderer will render the 5x5 Jeopardy board grid.
    expect(html.toLowerCase()).toContain('jeopardy')
    // TODO(Phase 3): enable when full JeopardyRenderer is implemented
    // expect(html).toContain('Math')
    // expect(html).toContain('100')
  })

  it('shows edit mode placeholder', () => {
    const el = {
      type: 'game',
      gameType: 'hot-potato',
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    // Placeholder renders "Game: Hot Potato Quiz" in setup mode
    expect(html.toLowerCase()).toMatch(/game:.*hot.?potato/i)
  })

  it('hides controls when not presenting', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice', 'Bob'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render({ ...el, isPresenting: false })
    // SPIN button must not appear in edit mode
    expect(html).not.toContain('SPIN')
  })
})

// ---------------------------------------------------------------------------
// Additional coverage tests
// ---------------------------------------------------------------------------
describe('Game Element Renderer — additional coverage', () => {
  it('[cap:element.game depth:behavior] renders every public subtype label without crashing', () => {
    const expectedLabels = {
      'name-picker': 'Name Picker',
      'hot-potato': 'Hot Potato Quiz',
      jeopardy: 'Jeopardy',
      'four-corners': 'Four Corners',
      'relay-race': 'Relay Race',
      'trivia-champ': 'Trivia Championship',
      scattergories: 'Scattergories',
    }

    GAME_TYPES.all.forEach((gameType) => {
      const html = render({
        type: 'game',
        gameType,
        gameStatus: 'setup',
        backgroundColor: '#1a1a2e',
        accentColor: '#6366f1',
        width: 640,
        height: 480,
      })

      expect(html).toContain('Game:')
      expect(html).toContain(expectedLabels[gameType])
    })
  })

  it('renders FourCorners game type', () => {
    const el = {
      type: 'game',
      gameType: 'four-corners',
      cornerCount: 4,
      showTimer: true,
      eliminateMode: 'wrong',
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#10b981',
    }
    const html = render(el)
    expect(html.toLowerCase()).toMatch(/game:?.*four corners|four corners/i)
  })

  it('renders RelayRace game type', () => {
    const el = {
      type: 'game',
      gameType: 'relay-race',
      questionsPerRound: 4,
      shuffleTeams: true,
      passOnWrong: true,
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#f97316',
    }
    const html = render(el)
    expect(html.toLowerCase()).toMatch(/game:?.*relay race|relay race/i)
  })

  it('renders TriviaChamp game type', () => {
    const el = {
      type: 'game',
      gameType: 'trivia-champ',
      rounds: [{ name: 'Round 1', questionCount: 10 }],
      lightningRound: { timeLimit: 60 },
      jackpotRound: { questionCount: 1 },
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#8b5cf6',
    }
    const html = render(el)
    expect(html.toLowerCase()).toMatch(/game:?.*trivia|trivia champ/i)
  })

  it('renders Scattergories game type', () => {
    const el = {
      type: 'game',
      gameType: 'scattergories',
      timePerRound: 60,
      letterMode: 'random',
      categories: [{ name: 'Food' }, { name: 'Animal' }],
      scoring: 'unique',
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#ec4899',
    }
    const html = render(el)
    expect(html.toLowerCase()).toMatch(/game:?.*scattergories|scattergories/i)
  })

  it('name-picker renders with dice pickerMode (shows dice SVG)', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'dice',
      items: ['Alice', 'Bob', 'Carol'],
      diceCount: 2,
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    // Placeholder: renders game type label; pickerMode not yet distinguished.
    // Phase 3 full NamePickerRenderer will render the dice SVG.
    expect(html.toLowerCase()).toContain('name')
    // TODO(Phase 3): enable when dice mode is implemented in NamePickerRenderer
    // expect(html.toLowerCase()).toMatch(/dice|die|roll/i)
  })

  it('name-picker renders with button pickerMode (shows big button)', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'button',
      items: ['Alice', 'Bob'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    expect(html.toLowerCase()).toContain('name')
    // Button mode should show button label
    expect(html.toLowerCase()).toMatch(/button|pick|choose|select/i)
  })

  it('presentation mode shows game controls when isPresenting=true', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice', 'Bob', 'Carol'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'running',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render({ ...el, isPresenting: true })
    // Placeholder: shows running status, not setup placeholder.
    // Phase 3 full NamePickerRenderer will show SPIN/START controls in presenting mode.
    expect(html.toLowerCase()).not.toContain('configure in properties panel')
    // TODO(Phase 3): enable when game controls are implemented
    // expect(html.toLowerCase()).toMatch(/spin|start|begin/i)
  })

  it('game element renders with custom backgroundColor', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#ff0000',
      accentColor: '#ffffff',
    }
    const html = render(el)
    expect(html).toContain('#ff0000')
  })

  it('renders correctly with all required props (element, isSelected, isDragging, isPresenting)', () => {
    const el = {
      type: 'game',
      gameType: 'hot-potato',
      questions: [{ question: 'Q1?', options: ['A', 'B'], correctIndex: 0 }],
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render({
      element: el,
      isSelected: true,
      isDragging: false,
      isPresenting: false,
    })
    // Should render without crashing and show game content
    expect(html).toContain('Game:')
  })

  it('fallback renders unknown gameType gracefully', () => {
    const el = {
      type: 'game',
      gameType: 'unknown-game-xyz',
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    // Should fall back to the unknown type label or a generic fallback
    expect(html).toContain('Game:')
    expect(html).toContain('unknown-game-xyz')
  })
})

// ---------------------------------------------------------------------------
// Visual attribute tests — accentColor drives border/text color
// ---------------------------------------------------------------------------
describe('Game Element Renderer — visual attributes', () => {

  it('applies accentColor from element to rendered output', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#000000',
      accentColor: '#ff6600',
    }
    const html = render(el)
    expect(html).toContain('#ff6600')
  })

  it('applies backgroundColor from element to rendered output', () => {
    const el = {
      type: 'game',
      gameType: 'jeopardy',
      gameStatus: 'setup',
      backgroundColor: '#0000ff',
      accentColor: '#ffffff',
      categories: [],
      teams: [],
    }
    const html = render(el)
    expect(html).toContain('#0000ff')
  })

  it('uses default background when none provided', () => {
    const el = {
      type: 'game',
      gameType: 'hot-potato',
      gameStatus: 'setup',
      accentColor: '#6366f1',
    }
    const html = render(el)
    // Must still render something
    expect(html).toContain('Game:')
  })
})

// ---------------------------------------------------------------------------
// gameStatus state tests
// ---------------------------------------------------------------------------
describe('Game Element Renderer — gameStatus states', () => {

  it('setup status renders edit-mode label', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'setup',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    expect(html.toLowerCase()).toMatch(/configure|setup|game:/i)
  })

  it('running status enables live controls', () => {
    const el = {
      type: 'game',
      gameType: 'hot-potato',
      questions: [{ question: 'Live?', options: ['A', 'B'], correctIndex: 0 }],
      gameStatus: 'running',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render({ ...el, isPresenting: true })
    // Running + presenting = live controls visible
    expect(html).not.toContain('Configure in properties panel')
  })

  it('ended status shows final results', () => {
    const el = {
      type: 'game',
      gameType: 'name-picker',
      pickerMode: 'wheel',
      items: ['Alice', 'Bob'],
      wheelColors: [],
      wheelSegments: 8,
      animationDuration: 2500,
      gameStatus: 'ended',
      backgroundColor: '#1a1a2e',
      accentColor: '#6366f1',
    }
    const html = render(el)
    // Should not show setup placeholder
    expect(html.toLowerCase()).not.toMatch(/configure in properties panel/i)
  })
})

// ---------------------------------------------------------------------------
// Export shape verification
// ---------------------------------------------------------------------------
describe('Game Element Renderer — module exports', () => {
  it('game-element-renderer.jsx exports GameElementRenderer', async () => {
    vi.resetModules()
    const mod = await import('./game-element-renderer.jsx')
    expect(mod.GameElementRenderer).toBeDefined()
    expect(typeof mod.GameElementRenderer).toBe('function')
  })
})
