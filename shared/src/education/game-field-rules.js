const timers = { timerDuration: [1, 86400, true] }
const picker = { animationDuration: [0, 60000, true], weighted: 'boolean', showConfetti: 'boolean' }
const FIELD_RULES = {
  'name-picker': {
    ...picker,
    pickerMode: ['wheel', 'dice', 'button'],
    wheelSegments: [1, 100, true],
    diceCount: [1, 6, true],
    excludeAfterPick: 'boolean',
  },
  'hot-potato': { allowLate: 'boolean', showLeaderboard: 'boolean', shuffleQuestions: 'boolean' },
  jeopardy: { ...timers, showTimer: 'boolean', negativePoints: 'boolean', wagerLimit: [0, 1e9] },
  'four-corners': {
    ...timers,
    cornerCount: [2, 4, true],
    eliminateMode: ['wrong', 'none'],
    showTimer: 'boolean',
  },
  'relay-race': {
    ...timers,
    questionsPerRound: [1, 1000, true],
    shuffleTeams: 'boolean',
    passOnWrong: 'boolean',
  },
  'trivia-champ': { buzzPoints: [0, 1e9] },
  scattergories: {
    timePerRound: [1, 86400, true],
    letterMode: ['random', 'manual'],
    scoring: ['unique', 'all'],
  },
  poll: { ...timers, showResults: 'boolean', allowVoteChange: 'boolean' },
  'word-cloud': {
    ...timers,
    maxPhraseLength: [1, 40, true],
    maxSubmissionsPerPlayer: [1, 5, true],
    displayLimit: [1, 50, true],
  },
  matching: timers,
  quiz: {
    attemptLimit: [1, 10, true],
    shuffleQuestions: 'boolean',
    feedbackMode: ['immediate', 'after-question'],
    showScore: 'boolean',
  },
  'lucky-wheel': { ...picker, removeAfterPick: 'boolean' },
  countdown: { durationSeconds: [1, 86400, true], autoStart: 'boolean' },
  scoreboard: {
    step: [Number.MIN_VALUE, 1e9],
    minScore: [-1e9, 1e9],
    maxScore: [-1e9, 1e9],
    resetBoundVariables: 'boolean',
  },
  memory: {
    shuffleOnStart: 'boolean',
    mismatchDelayMs: [0, 5000, true],
    matchPoints: [1, 1000, true],
  },
  flashcards: { shuffleOnStart: 'boolean' },
  sorting: { attemptLimit: [1, 100, true], points: [0, 1e9] },
  crossword: { rows: [2, 20, true], columns: [2, 20, true], seed: [0, 4294967295, true] },
  'word-search': { rows: [2, 20, true], columns: [2, 20, true], seed: [0, 4294967295, true] },
}
function validateFields(type, config, v) {
  if (type !== 'name-picker') v.text(config.title, ['title'])
  for (const [key, rule] of Object.entries(FIELD_RULES[type])) {
    if (rule === 'boolean') v.boolean(config[key], [key])
    else if (typeof rule[0] === 'number') v.number(config[key], [key], ...rule)
    else v.choice(config[key], [key], rule)
  }
  if (['poll', 'word-cloud', 'matching'].includes(type)) v.text(config.prompt, ['prompt'])
  if (type === 'countdown') v.text(config.expiryMessage, ['expiryMessage'])
  if (
    type === 'scattergories' &&
    (typeof config.letter !== 'string' || !/^\p{L}$/u.test(config.letter.normalize('NFC')))
  )
    v.add(['letter'], 'Choose a single letter')
}
module.exports = { validateFields }
