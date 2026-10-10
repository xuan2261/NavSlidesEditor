const PUBLIC_DISPLAY_FIELDS = Object.fromEntries(
  Object.entries({
    'name-picker':
      'pickerMode wheelSegments wheelColors diceCount weighted excludeAfterPick animationDuration showConfetti',
    'hot-potato': 'title allowLate showLeaderboard shuffleQuestions',
    jeopardy: 'title showTimer timerDuration negativePoints wagerLimit',
    'four-corners': 'title cornerCount eliminateMode showTimer timerDuration',
    'relay-race': 'title questionsPerRound shuffleTeams passOnWrong timerDuration',
    'trivia-champ': 'title buzzPoints',
    scattergories: 'title timePerRound letterMode letter scoring',
    poll: 'title prompt showResults allowVoteChange timerDuration',
    'word-cloud': 'title prompt maxPhraseLength maxSubmissionsPerPlayer displayLimit timerDuration',
    matching: 'title prompt timerDuration',
    quiz: 'title attemptLimit shuffleQuestions feedbackMode showScore',
    'lucky-wheel': 'title weighted removeAfterPick animationDuration showConfetti',
    countdown: 'title durationSeconds autoStart expiryMessage',
    scoreboard: 'title step minScore maxScore resetBoundVariables',
    memory: 'title shuffleOnStart mismatchDelayMs matchPoints',
    flashcards: 'title shuffleOnStart',
    sorting: 'title attemptLimit points',
    crossword: 'title rows columns seed',
    'word-search': 'title rows columns seed directions alphabet',
  }).map(([type, fields]) => [type, Object.freeze(fields.split(' '))])
)
const PUBLIC_COLLECTION_FIELDS = {
  'name-picker': ['items'],
  'hot-potato': ['questions'],
  jeopardy: ['teams', 'categories'],
  'four-corners': ['questions'],
  'relay-race': ['teams', 'questions'],
  'trivia-champ': ['teams', 'questions', 'rounds', 'lightningRound', 'jackpotRound'],
  scattergories: ['teams', 'categories'],
  poll: ['options'],
  'word-cloud': [],
  matching: [],
  quiz: ['questions'],
  'lucky-wheel': ['items'],
  countdown: [],
  scoreboard: ['teams'],
  memory: ['cards'],
  flashcards: ['cards'],
  sorting: ['items', 'buckets'],
  crossword: ['entries'],
  'word-search': ['words'],
}
function copyPublicFields(source, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => source?.[field] !== undefined)
      .map((field) => {
        const value = source[field]
        return [field, Array.isArray(value) ? value.slice() : value]
      })
  )
}
function checkPublicFields(value, allowed, path, v) {
  if (!v.object(value, path)) return false
  for (const key of Object.keys(value))
    if (!allowed.includes(key))
      v.add([...path, key], 'Unexpected private or unsupported public field')
  return true
}
function validatePublicMedia(value, path, v) {
  if (checkPublicFields(value, ['src', 'alt'], path, v)) v.media(value, path)
}
function validatePublicContent(value, path, v) {
  if (
    !checkPublicFields(
      value,
      value?.type === 'text' ? ['type', 'text'] : ['type', 'src', 'alt'],
      path,
      v
    )
  )
    return
  v.content(value, path)
}
module.exports = {
  PUBLIC_DISPLAY_FIELDS,
  PUBLIC_COLLECTION_FIELDS,
  copyPublicFields,
  checkPublicFields,
  validatePublicMedia,
  validatePublicContent,
}
