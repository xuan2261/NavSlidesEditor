const definitions = [
  [
    'name-picker',
    'Name Picker',
    false,
    'pickerMode items wheelSegments wheelColors diceCount weighted excludeAfterPick animationDuration showConfetti',
    { confetti: true },
  ],
  [
    'hot-potato',
    'Hot Potato Quiz',
    true,
    'title questions allowLate showLeaderboard shuffleQuestions',
    { questions: true },
  ],
  [
    'jeopardy',
    'Jeopardy',
    true,
    'title teams categories dailyDouble showTimer timerDuration negativePoints wagerLimit',
    { teams: true, categories: true, timer: true, timerVisibility: true },
  ],
  [
    'four-corners',
    'Four Corners',
    true,
    'title questions cornerCount eliminateMode timerDuration showTimer',
    { questions: true, timer: true, timerVisibility: true },
  ],
  [
    'relay-race',
    'Relay Race',
    true,
    'title teams questions questionsPerRound shuffleTeams passOnWrong timerDuration',
    { questions: true, teams: true, timer: true },
  ],
  [
    'trivia-champ',
    'Trivia Championship',
    true,
    'title teams questions rounds buzzPoints lightningRound jackpotRound',
    { questions: true, teams: true, rounds: true },
  ],
  [
    'scattergories',
    'Scattergories',
    true,
    'title timePerRound letterMode letter categories teams scoring',
    { teams: true, categories: true },
  ],
  [
    'poll',
    'Live Poll',
    true,
    'title prompt options showResults allowVoteChange timerDuration',
    { timer: true },
  ],
  [
    'word-cloud',
    'Word Cloud',
    true,
    'title prompt maxPhraseLength maxSubmissionsPerPlayer displayLimit timerDuration',
    { timer: true },
  ],
  ['matching', 'Matching', true, 'title prompt pairs timerDuration', { pairs: true, timer: true }],
  [
    'quiz',
    'Quiz',
    true,
    'title questions attemptLimit shuffleQuestions feedbackMode showScore',
    { questions: true },
  ],
  [
    'lucky-wheel',
    'Lucky Wheel',
    false,
    'title items weighted removeAfterPick animationDuration showConfetti',
    { confetti: true },
  ],
  ['countdown', 'Countdown', false, 'title durationSeconds autoStart expiryMessage', {}],
  [
    'scoreboard',
    'Scoreboard',
    false,
    'title teams step minScore maxScore resetBoundVariables',
    { teams: true },
  ],
  [
    'memory',
    'Memory',
    false,
    'title pairs shuffleOnStart mismatchDelayMs matchPoints',
    { pairs: true },
  ],
  ['flashcards', 'Flashcards', false, 'title cards shuffleOnStart', {}],
  ['sorting', 'Sorting', false, 'title buckets items answerKey attemptLimit points', {}],
  ['crossword', 'Crossword', false, 'title rows columns entries seed', {}],
  ['word-search', 'Word Search', false, 'title rows columns words seed directions alphabet', {}],
]
const implementedLive = new Set([
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
  'quiz',
])
const implementedLocal = new Set(definitions.map(([type]) => type))
const GAME_CATALOG = Object.freeze(
  Object.fromEntries(
    definitions.map(([type, label, live, fields, capabilities]) => [
      type,
      Object.freeze({
        type,
        label,
        plannedModes: Object.freeze({ local: true, live }),
        runtimeCapabilities: Object.freeze({
          local: implementedLocal.has(type),
          live: implementedLive.has(type),
        }),
        authoringFields: Object.freeze(fields.split(' ')),
        authoringCapabilities: Object.freeze(capabilities),
      }),
    ])
  )
)
const CANONICAL_GAME_TYPES = Object.freeze(Object.keys(GAME_CATALOG))
function isGameSubtype(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(GAME_CATALOG, type)
}
function getGameCapabilities(type) {
  if (!isGameSubtype(type)) throw new Error(`Unknown game subtype: ${String(type)}`)
  return GAME_CATALOG[type].runtimeCapabilities
}
module.exports = { GAME_CATALOG, CANONICAL_GAME_TYPES, isGameSubtype, getGameCapabilities }
