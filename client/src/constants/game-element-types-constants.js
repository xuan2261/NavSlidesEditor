/**
 * Game element type constants for NavSlides editor.
 */

// All 7 game types as constants
export const GAME_TYPES = {
  'name-picker': 'name-picker',
  'hot-potato': 'hot-potato',
  'jeopardy': 'jeopardy',
  'four-corners': 'four-corners',
  'relay-race': 'relay-race',
  'trivia-champ': 'trivia-champ',
  'scattergories': 'scattergories',
}
GAME_TYPES.all = Object.values(GAME_TYPES)

// Default color palette for game elements
export const DEFAULT_GAME_COLORS = {
  wheelColors: [
    '#FF5722', '#2196F3', '#4CAF50', '#FFC107',
    '#9C27B0', '#00BCD4', '#FF9800', '#795548',
  ],
  accentColors: [
    '#6366f1', '#ec4899', '#10b981', '#f59e0b',
    '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316',
  ],
}

// Factory: create a question object for quiz games
export function createQuestion(overrides = {}) {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: 'Enter question here?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    timeLimit: 30,
    points: 10,
    ...overrides,
  }
}

// Factory: create a team object for team-based games
let _teamCounter = 0
const TEAM_COLORS = ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4']

export function createTeam(overrides = {}) {
  const idx = _teamCounter % TEAM_COLORS.length
  _teamCounter++
  return {
    id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Team',
    color: TEAM_COLORS[idx],
    score: 0,
    ...overrides,
  }
}

// Reset counter for testing
export function resetTeamCounter() { _teamCounter = 0 }

// Factory: create a game element with defaults merged
export function createGameElement(gameType = 'name-picker', overrides = {}) {
  const base = {
    type: 'game',
    gameType,
    width: 640,
    height: 480,
    zIndex: 5,
    backgroundColor: '#1a1a2e',
    accentColor: '#6366f1',
    fontFamily: 'sans-serif',
    showSoundEffects: true,
    gameStatus: 'setup',
  }

  const typeDefaults = {
    'name-picker': {
      pickerMode: 'wheel',
      items: ['Học sinh 1', 'Học sinh 2', 'Học sinh 3', 'Học sinh 4',
              'Học sinh 5', 'Học sinh 6', 'Học sinh 7', 'Học sinh 8'],
      wheelSegments: 8,
      wheelColors: [...DEFAULT_GAME_COLORS.wheelColors],
      diceCount: 2,
      weighted: false,
      excludeAfterPick: true,
      animationDuration: 2500,
    },
    'hot-potato': {
      title: 'Hot Potato Quiz',
      questions: [],
      currentQuestion: 0,
      allowLate: false,
      showLeaderboard: true,
      shuffleQuestions: false,
    },
    'jeopardy': {
      title: 'Jeopardy',
      teams: [],
      categories: [],
      questions: {},
      dailyDouble: [],
    },
    'four-corners': {
      cornerCount: 4,
      eliminateMode: 'wrong',
      showTimer: true,
    },
    'relay-race': {
      questionsPerRound: 4,
      shuffleTeams: true,
      passOnWrong: true,
    },
    'trivia-champ': {
      rounds: [],
      lightningRound: { enabled: false, timePerQ: 10 },
      jackpotRound: { enabled: false, multiplier: 2 },
    },
    'scattergories': {
      timePerRound: 60,
      letterMode: 'random',
      categories: [],
      scoring: 'unique',
    },
  }

  return {
    ...base,
    ...(typeDefaults[gameType] || typeDefaults['name-picker']),
    ...overrides,
  }
}
