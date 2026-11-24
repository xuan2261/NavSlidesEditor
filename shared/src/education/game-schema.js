const { isGameSubtype } = require('./game-registry.js')
const { createValidation } = require('./game-validation-utils.js')
const { validateFields } = require('./game-field-rules.js')
const {
  validateQuestions,
  validateTeams,
  validateJeopardy,
  validateTrivia,
} = require('./game-question-validation.js')
const {
  validatePicker,
  validateResponses,
  validateCards,
  validateSorting,
} = require('./game-content-validation.js')
const { validateWords } = require('./game-word-validation.js')

function validateGameConfig(gameType, config) {
  const v = createValidation()
  const result = () => ({ isValid: v.errors.length === 0, errors: v.errors })
  if (!isGameSubtype(gameType)) {
    v.add(['gameType'], `Unknown game subtype: ${String(gameType)}`)
    return result()
  }
  if (!v.object(config, [])) return result()
  validateFields(gameType, config, v)
  if (['name-picker', 'lucky-wheel'].includes(gameType))
    validatePicker(config, v, gameType === 'lucky-wheel')
  let questionIds = new Set()
  if (['hot-potato', 'four-corners', 'relay-race', 'trivia-champ', 'quiz'].includes(gameType))
    questionIds = validateQuestions(config.questions, ['questions'], v, gameType === 'quiz' ? 1 : 0)
  if (gameType === 'hot-potato' && Array.isArray(config.questions))
    config.questions.forEach((question, i) => {
      v.number(question?.points, ['questions', i, 'points'], 1, 1000, true)
    })
  if (['jeopardy', 'relay-race', 'trivia-champ', 'scattergories', 'scoreboard'].includes(gameType))
    validateTeams(config.teams, v, gameType === 'scoreboard', config)
  if (gameType === 'jeopardy') validateJeopardy(config, v)
  if (gameType === 'trivia-champ') validateTrivia(config, v, questionIds)
  if (gameType === 'four-corners' && Array.isArray(config.questions))
    config.questions.forEach((question, i) => {
      if (question?.kind !== 'single-choice')
        v.add(
          ['questions', i, 'kind'],
          'Four Corners needs single-choice questions with stable corner option IDs'
        )
      if (!Array.isArray(question?.options) || question.options.length !== config.cornerCount)
        v.add(
          ['questions', i, 'options'],
          'The number of options must match cornerCount; update options and answer references explicitly'
        )
    })
  if (gameType === 'scattergories') {
    const rows = v.list(config.categories, ['categories'], 1, 100)
    v.unique(rows, ['categories'])
    rows.forEach((row, i) => {
      if (row && typeof row === 'object') v.text(row.label, ['categories', i, 'label'])
    })
  }
  if (['poll', 'matching'].includes(gameType)) validateResponses(gameType, config, v)
  if (gameType === 'scoreboard' && config.maxScore < config.minScore)
    v.add(['maxScore'], 'maxScore must be greater than or equal to minScore')
  if (['memory', 'flashcards'].includes(gameType)) validateCards(gameType, config, v)
  if (gameType === 'sorting') validateSorting(config, v)
  if (['crossword', 'word-search'].includes(gameType))
    validateWords(config, v, gameType === 'crossword')
  return result()
}
module.exports = { validateGameConfig }
