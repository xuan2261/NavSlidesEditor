const { validateCanonicalQuestion } = require('./question-schema.js')
const {
  isRecord,
  checkKeys,
  addError,
  result,
  cloneValue,
  validationError,
} = require('./question-shape.js')

const QUIZ_DEFAULTS = Object.freeze({
  title: '',
  attemptLimit: 1,
  shuffleQuestions: false,
  feedbackMode: 'immediate',
  showScore: true,
})
const QUIZ_FIELDS = [
  'title',
  'questions',
  'attemptLimit',
  'shuffleQuestions',
  'feedbackMode',
  'showScore',
]

function validateQuizConfig(config) {
  const errors = []
  if (!checkKeys(config, QUIZ_FIELDS, [], errors)) return result(errors)
  if (typeof config.title !== 'string') addError(errors, ['title'], 'Provide a quiz title as text.')
  if (
    !Number.isInteger(config.attemptLimit) ||
    config.attemptLimit < 1 ||
    config.attemptLimit > 10
  ) {
    addError(errors, ['attemptLimit'], 'Attempt limit must be an integer from 1 to 10.')
  }
  for (const field of ['shuffleQuestions', 'showScore']) {
    if (typeof config[field] !== 'boolean') addError(errors, [field], 'Provide a boolean.')
  }
  if (!['immediate', 'after-question'].includes(config.feedbackMode))
    addError(errors, ['feedbackMode'], 'Choose immediate or after-question feedback.')
  if (!Array.isArray(config.questions)) addError(errors, ['questions'], 'Provide a question array.')
  else {
    const ids = new Set()
    config.questions.forEach((question, index) => {
      const validation = validateCanonicalQuestion(question)
      for (const error of validation.errors)
        addError(errors, ['questions', index, ...error.path], error.message)
      if (isRecord(question)) {
        if (ids.has(question.id))
          addError(errors, ['questions', index, 'id'], 'Question IDs must be unique.')
        ids.add(question.id)
      }
    })
  }
  return result(errors)
}

function normalizeQuizConfig(config = {}) {
  if (!isRecord(config))
    throw validationError('Invalid quiz', [{ path: [], message: 'Expected a quiz object.' }])
  const normalized = { ...QUIZ_DEFAULTS, questions: [], ...config }
  const validation = validateQuizConfig(normalized)
  if (!validation.isValid) throw validationError('Invalid quiz', validation.errors)
  return cloneValue(normalized)
}

module.exports = { QUIZ_DEFAULTS, validateQuizConfig, normalizeQuizConfig }
