const { GAME_CATALOG, CANONICAL_GAME_TYPES } = require('./game-registry.js')
const COMMON_TRANSIENTS = [
  'answers',
  'progress',
  'currentQuestion',
  'remainingTime',
  'remainingMs',
  'exclusions',
  'excludedIds',
  'reveals',
  'scores',
  'score',
  'gameStatus',
]
const TYPE_TRANSIENTS = {
  'name-picker': [
    'spinning',
    'pickedItem',
    'pickedItems',
    'selectedItem',
    'availableItems',
    'rotation',
  ],
  'hot-potato': ['status', 'questionStartedAt', 'leaderboard', 'timeLeft'],
  jeopardy: [
    'usedCells',
    'selectedCell',
    'showAnswer',
    'activeTeam',
    'isDailyDouble',
    'wager',
    'showWagerModal',
    'timeLeft',
    'gameEnded',
  ],
  'four-corners': [
    'selectedCorner',
    'eliminatedPlayers',
    'timeLeft',
    'round',
    'phase',
    'leaderboard',
  ],
  'relay-race': ['currentTeam', 'currentRound', 'batonTeam', 'teamProgress', 'phase', 'timeLeft'],
  'trivia-champ': [
    'currentRound',
    'buzzerPlayer',
    'buzzerLocked',
    'lightningActive',
    'lightningQIndex',
    'jackpotActive',
    'gamePhase',
    'winner',
  ],
  scattergories: ['currentLetter', 'spinning', 'timeLeft', 'round', 'phase', 'scoringVisible'],
  poll: ['votes', 'pollVotes', 'totalVotes', 'aggregate', 'status', 'timeLeft'],
  'word-cloud': ['counts', 'submissions', 'aggregate', 'status', 'timeLeft'],
  matching: [
    'assignments',
    'matchingRevealed',
    'targetOrder',
    'submissions',
    'phase',
    'selectedPrompt',
    'results',
  ],
  quiz: ['attempts', 'submittedAnswers', 'feedbackState', 'phase', 'generation'],
  'lucky-wheel': ['pool', 'result', 'spinning', 'phase', 'generation'],
  countdown: ['phase', 'deadline', 'generation'],
  scoreboard: ['generation'],
  memory: [
    'order',
    'faceUpIds',
    'matchedPairIds',
    'attempts',
    'pendingMismatch',
    'revealMode',
    'generation',
  ],
  flashcards: ['order', 'currentIndex', 'side', 'studiedIds', 'generation'],
  sorting: ['assignments', 'attempts', 'pendingSelection', 'feedbackState', 'generation'],
  crossword: [
    'selectedCell',
    'foundWords',
    'completedEntryIds',
    'cellValues',
    'feedbackState',
    'generation',
  ],
  'word-search': ['selectedCell', 'foundWords', 'selectedPath', 'feedbackState', 'generation'],
}
const LEGACY_FLAT_FIELDS = new Set(
  CANONICAL_GAME_TYPES.flatMap((type) => GAME_CATALOG[type].authoringFields)
)
// Jeopardy's old parallel board is obsolete; categories[].questions remains the only source.
LEGACY_FLAT_FIELDS.add('questions')
function stripTransients(value, type) {
  const result = { ...value }
  for (const key of [...COMMON_TRANSIENTS, ...(TYPE_TRANSIENTS[type] || [])]) delete result[key]
  if (type === 'jeopardy') delete result.questions
  const cleanQuestion = (question) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) return question
    const clean = { ...question }
    for (const key of COMMON_TRANSIENTS) delete clean[key]
    return clean
  }
  if (Array.isArray(result.questions)) result.questions = result.questions.map(cleanQuestion)
  if (type === 'jeopardy' && Array.isArray(result.categories))
    result.categories = result.categories.map((category) => ({
      ...category,
      ...(Array.isArray(category.questions)
        ? { questions: category.questions.map(cleanQuestion) }
        : {}),
    }))
  if (Array.isArray(result.teams))
    result.teams = result.teams.map((team) => {
      if (!team || typeof team !== 'object' || Array.isArray(team)) return team
      const clean = { ...team }
      delete clean.score
      return clean
    })
  if (type === 'poll' && Array.isArray(result.options))
    result.options = result.options.map((option) => {
      if (!option || typeof option !== 'object' || Array.isArray(option)) return option
      const clean = { ...option }
      delete clean.votes
      return clean
    })
  return result
}
function stripElementGameFields(element) {
  const result = { ...element }
  for (const key of LEGACY_FLAT_FIELDS) delete result[key]
  for (const key of COMMON_TRANSIENTS) delete result[key]
  for (const keys of Object.values(TYPE_TRANSIENTS))
    for (const key of keys) if (key !== 'rotation') delete result[key]
  return result
}
module.exports = { stripTransients, stripElementGameFields }
