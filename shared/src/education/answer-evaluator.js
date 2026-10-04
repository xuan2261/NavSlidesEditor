const { validateCanonicalQuestion } = require('./question-schema.js')
const { validateAnswerPayload } = require('./question-answer-payload.js')

function normalizeText(text, caseSensitive) {
  const normalized = text.trim().normalize('NFC')
  return caseSensitive ? normalized : normalized.toLowerCase().normalize('NFC')
}

function containsPoint(region, point) {
  if (region.shape === 'rect') {
    return (
      point.x >= region.x &&
      point.x <= region.x + region.width &&
      point.y >= region.y &&
      point.y <= region.y + region.height
    )
  }
  const dx = point.x - region.cx,
    dy = point.y - region.cy
  return dx * dx + dy * dy <= region.r * region.r
}

function evaluateAnswer(question, answer) {
  const validation = validateCanonicalQuestion(question)
  if (!validation.isValid) {
    return {
      valid: false,
      correct: false,
      error: `Invalid question: ${validation.errors.map((item) => `${item.path.join('.')}: ${item.message}`).join('; ')}`,
    }
  }
  const errors = []
  validateAnswerPayload(question, answer, ['answer'], errors)
  if (errors.length)
    return {
      valid: false,
      correct: false,
      error: errors.map((item) => `${item.path.join('.')}: ${item.message}`).join('; '),
    }
  const key = question.answerKey
  let correct = false
  switch (question.kind) {
    case 'single-choice':
      correct = answer.optionId === key.optionId
      break
    case 'multi-choice':
      correct =
        answer.optionIds.length === key.optionIds.length &&
        answer.optionIds.every((id) => key.optionIds.includes(id))
      break
    case 'true-false':
      correct = answer.value === key.value
      break
    case 'fill-blank': {
      const text = normalizeText(answer.text, key.caseSensitive)
      correct = key.accepted.some((accepted) => normalizeText(accepted, key.caseSensitive) === text)
      break
    }
    case 'ordering':
      correct = answer.itemIds.every((id, index) => id === key.itemIds[index])
      break
    case 'matching':
      correct = answer.pairs.every((pair) =>
        key.pairs.some(
          (expected) => pair.leftId === expected.leftId && pair.rightId === expected.rightId
        )
      )
      break
    case 'image-hotspot':
      correct =
        answer.mode === 'region'
          ? key.regions.some((region) => region.id === answer.regionId)
          : key.regions.some((region) => containsPoint(region, answer))
      break
  }
  return { valid: true, correct, error: null }
}

module.exports = { evaluateAnswer }
