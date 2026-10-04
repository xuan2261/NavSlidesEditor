const {
  QUESTION_KINDS,
  isRecord,
  checkKeys,
  addError,
  result,
  validateQuestionShape,
  cloneValue,
  validationError,
} = require('./question-shape.js')
const { validateAnswerKey } = require('./question-answer-key.js')
const { createCanonicalQuestion } = require('./question-factory.js')

function validateCanonicalQuestion(question) {
  const errors = []
  validateQuestionShape(question, errors, true)
  if (isRecord(question)) {
    if (QUESTION_KINDS.includes(question.kind)) validateAnswerKey(question, errors)
    if (
      checkKeys(question.feedback, ['correct', 'incorrect', 'explanation'], ['feedback'], errors)
    ) {
      for (const field of ['correct', 'incorrect', 'explanation']) {
        if (typeof question.feedback[field] !== 'string')
          addError(errors, ['feedback', field], 'Provide feedback text as a string.')
      }
    }
  }
  return result(errors)
}

function clampLegacyInteger(value, min, max, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function normalizeLegacyOption(option, questionId, index) {
  if (!isRecord(option))
    return {
      id: `${questionId}/option-${index + 1}`,
      text:
        typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean'
          ? String(option)
          : option,
    }
  const normalized = {
    id: option.id ?? `${questionId}/option-${index + 1}`,
    text: option.text ?? option.label ?? option.value,
  }
  if (typeof normalized.text === 'number') normalized.text = String(normalized.text)
  if (option.media !== undefined) normalized.media = cloneValue(option.media)
  return normalized
}

function normalizeLegacyQuestion(question, contextId = 'question-1') {
  if (!isRecord(question))
    throw validationError('Cannot migrate question', [
      { path: [], message: 'Expected a question object.' },
    ])
  if (question.kind !== undefined || question.answerKey !== undefined) {
    const validation = validateCanonicalQuestion(question)
    if (!validation.isValid) throw validationError('Invalid canonical question', validation.errors)
    return cloneValue(question)
  }
  const id = question.id ?? contextId
  const options = Array.isArray(question.options)
    ? question.options.map((option, index) => normalizeLegacyOption(option, id, index))
    : question.options
  if (
    !Number.isInteger(question.correctIndex) ||
    !Array.isArray(options) ||
    question.correctIndex < 0 ||
    question.correctIndex >= options.length
  ) {
    throw validationError('Cannot migrate question', [
      {
        path: ['correctIndex'],
        message:
          'Provide an unambiguous integer correctIndex referring to an existing option; repair the legacy question before migration.',
      },
    ])
  }
  const canonical = {
    id,
    kind: 'single-choice',
    prompt: question.prompt ?? question.question,
    points: clampLegacyInteger(question.points, 1, 1000, 10),
    timeLimit:
      question.timeLimit == null ? null : clampLegacyInteger(question.timeLimit, 5, 300, 30),
    options,
    answerKey: { optionId: options[question.correctIndex].id },
    feedback: {
      correct: question.feedback?.correct ?? '',
      incorrect: question.feedback?.incorrect ?? '',
      explanation: question.feedback?.explanation ?? question.explanation ?? '',
    },
  }
  if (question.media !== undefined) canonical.media = cloneValue(question.media)
  const validation = validateCanonicalQuestion(canonical)
  if (!validation.isValid) throw validationError('Cannot migrate question', validation.errors)
  return canonical
}

module.exports = { validateCanonicalQuestion, normalizeLegacyQuestion, createCanonicalQuestion }
